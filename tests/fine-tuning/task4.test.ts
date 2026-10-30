import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { LLMProviderError } from "../../src/ai/shared/llm";
import {
  evaluateAndPromote,
  FineTuneAbortedError,
  FineTuneFailedError,
  FineTuneTimeoutError,
  runFineTuning,
  type FineTuneJob,
  type FineTuneSpec,
  type FineTuningProvider,
  type PromotionInput,
} from "../../src/fine-tuning/task4/task4";
import { expectRejects } from "../support/expect-rejects";

const spec: FineTuneSpec = {
  baseModel: "base-8b",
  suffix: "support-v3",
  trainJsonl: '{"messages":[]}\n',
  validationJsonl: '{"messages":[]}\n',
  hyperparameters: { nEpochs: 3, learningRateMultiplier: 1, batchSize: 16 },
};

const keyOf = (s: FineTuneSpec) =>
  createHash("sha256")
    .update(JSON.stringify([s.baseModel, s.suffix, s.hyperparameters.nEpochs, s.hyperparameters.learningRateMultiplier, s.hyperparameters.batchSize, s.trainJsonl, s.validationJsonl]))
    .digest("hex")
    .slice(0, 32);

const job = (status: FineTuneJob["status"], extra: Partial<FineTuneJob> = {}): FineTuneJob => ({
  id: "ftjob-1",
  status,
  fineTunedModel: status === "succeeded" ? "ft:base-8b:support-v3:abc" : null,
  error: null,
  idempotencyKey: keyOf(spec),
  ...extra,
});

function fakeProvider(polls: Array<FineTuneJob | Error>, existing: FineTuneJob | null = null) {
  let p = 0;
  let file = 0;
  const provider = {
    uploadFile: vi.fn(async (_name: string, _content: string) => ({ id: `file-${++file}` })),
    findJobByIdempotencyKey: vi.fn(async (_k: string) => existing),
    createJob: vi.fn(async (_input: Parameters<FineTuningProvider["createJob"]>[0]) => job("queued")),
    getJob: vi.fn(async (_id: string) => {
      const next = polls[Math.min(p++, polls.length - 1)]!;
      if (next instanceof Error) throw next;
      return next;
    }),
    cancelJob: vi.fn(async (_id: string) => {}),
  } satisfies FineTuningProvider;
  return provider;
}

function clock() {
  let t = 0;
  return { now: () => t, sleep: vi.fn(async (ms: number) => void (t += ms)) };
}

const run = (provider: FineTuningProvider, s: Partial<FineTuneSpec> = {}, o: Partial<Parameters<typeof runFineTuning>[2]> = {}) => {
  const c = clock();
  return { promise: runFineTuning(provider, { ...spec, ...s }, { sleep: c.sleep, now: c.now, pollIntervalMs: 60_000, maxWaitMs: 600_000, ...o }), clock: c };
};

describe("FT-004", () => {
  describe("runFineTuning", () => {
    it("uploads files, creates the job, polls and returns the model", async () => {
      const provider = fakeProvider([job("running"), new LLMProviderError("busy", 503), job("succeeded")]);
      const { promise, clock: c } = run(provider);
      expect(await promise).toEqual({ jobId: "ftjob-1", model: "ft:base-8b:support-v3:abc", reused: false });
      expect(provider.findJobByIdempotencyKey).toHaveBeenCalledWith(keyOf(spec));
      expect(provider.uploadFile.mock.calls).toEqual([
        ["train.jsonl", spec.trainJsonl],
        ["validation.jsonl", spec.validationJsonl],
      ]);
      expect(provider.createJob).toHaveBeenCalledWith({
        trainingFileId: "file-1",
        validationFileId: "file-2",
        baseModel: "base-8b",
        suffix: "support-v3",
        hyperparameters: { nEpochs: 3, learningRateMultiplier: 1, batchSize: 16 },
        idempotencyKey: keyOf(spec),
      });
      expect(provider.getJob).toHaveBeenCalledTimes(3);
      expect(c.sleep.mock.calls.map(([ms]) => ms)).toEqual([60_000, 60_000, 60_000]);
    });

    it("skips the validation upload when there is no validation data", async () => {
      const provider = fakeProvider([job("succeeded")]);
      await run(provider, { validationJsonl: "" }).promise;
      expect(provider.uploadFile).toHaveBeenCalledTimes(1);
      expect(provider.createJob.mock.calls[0]![0].validationFileId).toBeNull();
    });

    it("reuses an existing active job with the same idempotency key", async () => {
      const provider = fakeProvider([job("succeeded")], job("running"));
      expect(await run(provider).promise).toEqual({ jobId: "ftjob-1", model: "ft:base-8b:support-v3:abc", reused: true });
      expect(provider.uploadFile).not.toHaveBeenCalled();
      expect(provider.createJob).not.toHaveBeenCalled();
    });

    it("returns immediately for an already succeeded job without polling", async () => {
      const provider = fakeProvider([], job("succeeded"));
      const { promise, clock: c } = run(provider);
      expect((await promise).reused).toBe(true);
      expect(provider.getJob).not.toHaveBeenCalled();
      expect(c.sleep).not.toHaveBeenCalled();
    });

    it.each(["failed", "cancelled"] as const)("resubmits when the existing job is %s", async (status) => {
      const provider = fakeProvider([job("succeeded")], job(status));
      expect((await run(provider).promise).reused).toBe(false);
      expect(provider.createJob).toHaveBeenCalledTimes(1);
    });

    it("derives different keys for different inputs", async () => {
      const provider = fakeProvider([job("succeeded")]);
      await run(provider, { hyperparameters: { ...spec.hyperparameters, nEpochs: 4 } }).promise;
      expect(provider.findJobByIdempotencyKey.mock.calls[0]![0]).toBe(keyOf({ ...spec, hyperparameters: { ...spec.hyperparameters, nEpochs: 4 } }));
      expect(provider.findJobByIdempotencyKey.mock.calls[0]![0]).not.toBe(keyOf(spec));
    });

    it("reports provider failures and cancellations", async () => {
      const failed = await expectRejects(run(fakeProvider([job("failed", { error: "Training file has invalid format" })])).promise, FineTuneFailedError);
      expect(failed.jobId).toBe("ftjob-1");
      expect(failed.message).toBe("Training file has invalid format");
      expect((await expectRejects(run(fakeProvider([job("cancelled")])).promise, FineTuneFailedError)).message).toBe("cancelled");
    });

    it("tolerates up to two consecutive transient errors and fails on the third", async () => {
      const ok = fakeProvider([new LLMProviderError("a", 503), new LLMProviderError("b", 429), job("running"), new LLMProviderError("c", 500), new LLMProviderError("d", 502), job("succeeded")]);
      expect((await run(ok).promise).model).toBe("ft:base-8b:support-v3:abc");

      const third = new LLMProviderError("still down", 503);
      const bad = fakeProvider([new LLMProviderError("a", 503), new LLMProviderError("b", 500), third]);
      await expect(run(bad).promise).rejects.toBe(third);
    });

    it("rethrows non-transient errors immediately", async () => {
      const auth = new LLMProviderError("unauthorized", 401);
      const provider = fakeProvider([auth, job("succeeded")]);
      await expect(run(provider).promise).rejects.toBe(auth);
      expect(provider.getJob).toHaveBeenCalledTimes(1);
    });

    it("cancels the job and throws after the deadline", async () => {
      const provider = fakeProvider([job("running")]);
      const error = await expectRejects(run(provider, {}, { pollIntervalMs: 60_000, maxWaitMs: 180_000 }).promise, FineTuneTimeoutError);
      expect(error.jobId).toBe("ftjob-1");
      expect(provider.cancelJob).toHaveBeenCalledWith("ftjob-1");
      expect(provider.getJob).toHaveBeenCalledTimes(3);
    });

    it("aborts before submitting when the signal is already aborted", async () => {
      const provider = fakeProvider([job("succeeded")]);
      const controller = new AbortController();
      controller.abort();
      const error = await expectRejects(run(provider, {}, { signal: controller.signal }).promise, FineTuneAbortedError);
      expect(error.jobId).toBeNull();
      expect(provider.findJobByIdempotencyKey).not.toHaveBeenCalled();
    });

    it("cancels the job when aborted while polling", async () => {
      const provider = fakeProvider([job("running")]);
      const controller = new AbortController();
      const sleep = vi.fn(async () => {
        if (sleep.mock.calls.length === 2) controller.abort();
      });
      const promise = runFineTuning(provider, spec, { sleep, now: () => 0, pollIntervalMs: 1000, maxWaitMs: 1_000_000, signal: controller.signal });
      const error = await expectRejects(promise, FineTuneAbortedError);
      expect(error.jobId).toBe("ftjob-1");
      expect(provider.cancelJob).toHaveBeenCalledWith("ftjob-1");
      expect(provider.getJob).toHaveBeenCalledTimes(1);
    });
  });

  describe("evaluateAndPromote", () => {
    function promotion(candidate: number[], baseline: number[], gate = { minScore: 0.6, minImprovement: 0.05, maxRegressionRate: 0.25 }) {
      const registry = { getAlias: vi.fn(async (_a: string) => "ft:v2"), setAlias: vi.fn(async (_a: string, _m: string) => {}) };
      const cases = candidate.map((_, i) => ({ id: `c${i}`, input: `q${i}`, expected: `e${i}` }));
      const runModel = vi.fn(async (model: string, input: string) => `${model}|${input}`);
      const score = vi.fn((output: string) => {
        const [model, input] = output.split("|");
        const i = Number(input!.slice(1));
        return (model === "ft:v3" ? candidate : baseline)[i]!;
      });
      const input: PromotionInput = { candidateModel: "ft:v3", baselineModel: "ft:v2", cases, runModel, score, registry, alias: "support-prod", gate };
      return { input, registry, runModel, score };
    }

    it("promotes a better candidate and moves the alias", async () => {
      const { input, registry, runModel } = promotion([1, 0.8, 0.9, 0.5], [0.7, 0.8, 0.6, 0.6]);
      const result = await evaluateAndPromote(input);
      expect(result).toMatchObject({ promoted: true, regressions: ["c3"], regressionRate: 0.25, previousModel: "ft:v2", reasons: [] });
      expect(result.candidateScore).toBeCloseTo(0.8, 12);
      expect(result.baselineScore).toBeCloseTo(0.675, 12);
      expect(registry.setAlias).toHaveBeenCalledWith("support-prod", "ft:v3");
      expect(runModel).toHaveBeenCalledTimes(8);
      expect(runModel).toHaveBeenCalledWith("ft:v3", "q0");
      expect(runModel).toHaveBeenCalledWith("ft:v2", "q3");
    });

    it("blocks promotion and reports every failed rule in order", async () => {
      const { input, registry } = promotion([0.5, 0.4, 0.6, 0.5], [0.6, 0.5, 0.5, 0.6]);
      const result = await evaluateAndPromote(input);
      expect(result.reasons).toEqual(["below_min_score", "insufficient_improvement", "too_many_regressions"]);
      expect(result.promoted).toBe(false);
      expect(registry.setAlias).not.toHaveBeenCalled();
      expect(registry.getAlias).toHaveBeenCalledWith("support-prod");
    });

    it("accepts an improvement exactly equal to the minimum", async () => {
      const { input } = promotion([0.75, 0.75], [0.7, 0.7], { minScore: 0.5, minImprovement: 0.05, maxRegressionRate: 0 });
      expect((await evaluateAndPromote(input)).promoted).toBe(true);
    });
  });
});
