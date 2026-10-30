import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LLMProviderError, type CompletionRequest, type CompletionResponse } from "../../src/ai/shared/llm";
import { createRolloutController, PromotionError, type RolloutOptions } from "../../src/ai-production/task5/task5";
import { expectThrows } from "../support/expect-rejects";
import { reply, scriptedLLM } from "../support/mock-llm";

const request: CompletionRequest = { model: "answer", maxTokens: 100, messages: [{ role: "user", content: "hi" }] };
const thresholds = { minSamples: 4, maxErrorRateDelta: 0.1, maxP95LatencyMs: 1000, maxNegativeFeedbackRate: 0.5 };

const bucket = (rolloutId: string, userId: string) => createHash("sha256").update(`${rolloutId}:${userId}`).digest().readUInt32BE(0) % 10_000;

function usersWhere(rolloutId: string, percent: number, canary: boolean, n: number) {
  const out: string[] = [];
  for (let i = 0; out.length < n; i++) if (bucket(rolloutId, `u${i}`) < percent * 100 === canary) out.push(`u${i}`);
  return out;
}

function setup(opts: Partial<RolloutOptions> & { stableSteps?: Parameters<typeof scriptedLLM>; canarySteps?: Parameters<typeof scriptedLLM>; latency?: { stable?: number; canary?: number } } = {}) {
  let t = 1_000_000;
  let id = 0;
  const lat = { stable: opts.latency?.stable ?? 100, canary: opts.latency?.canary ?? 100 };
  const wrap = (steps: Parameters<typeof scriptedLLM>, ms: number) => {
    const m = scriptedLLM(...steps);
    return { ...m, llm: { complete: async (r: CompletionRequest) => { t += ms; return m.llm.complete(r); } } };
  };
  const stable = wrap(opts.stableSteps ?? [reply("stable answer")], lat.stable);
  const canary = wrap(opts.canarySteps ?? [reply("canary answer")], lat.canary);
  const controller = createRolloutController({
    rolloutId: "answer-v2",
    percent: 50,
    thresholds,
    now: () => t,
    generateId: () => `r-${++id}`,
    ...opts,
    stable: { name: "v1", client: stable.llm },
    canary: { name: "v2", client: canary.llm },
  });
  return { controller, stable, canary, advance: (ms: number) => (t += ms) };
}

const canaryUsers = usersWhere("answer-v2", 50, true, 10);
const stableUsers = usersWhere("answer-v2", 50, false, 10);

describe("AIOPS-005", () => {
  describe("Assignment", () => {
    it("assigns users deterministically by SHA-256 bucket", () => {
      const { controller } = setup();
      for (const u of [...canaryUsers, ...stableUsers]) {
        expect(controller.assign(u)).toBe(bucket("answer-v2", u) < 5000 ? "canary" : "stable");
        expect(controller.assign(u)).toBe(controller.assign(u));
      }
    });

    it("honors 0% and 100%", () => {
      expect(canaryUsers.map((u) => setup({ percent: 0 }).controller.assign(u))).toEqual(canaryUsers.map(() => "stable"));
      expect(stableUsers.map((u) => setup({ percent: 100 }).controller.assign(u))).toEqual(stableUsers.map(() => "canary"));
    });

    it("roughly matches the configured percentage", () => {
      const { controller } = setup({ percent: 10 });
      const share = Array.from({ length: 5000 }, (_, i) => controller.assign(`user-${i}`)).filter((v) => v === "canary").length / 5000;
      expect(share).toBeGreaterThan(0.08);
      expect(share).toBeLessThan(0.12);
    });
  });

  describe("Serving", () => {
    it("serves each user from the assigned variant", async () => {
      const { controller } = setup();
      expect(await controller.complete(canaryUsers[0]!, request)).toMatchObject({ text: "canary answer", variant: "canary", fallback: false, requestId: "r-1" });
      expect(await controller.complete(stableUsers[0]!, request)).toMatchObject({ text: "stable answer", variant: "stable", fallback: false, requestId: "r-2" });
    });

    it("falls back to stable when the canary fails and records both samples", async () => {
      const { controller } = setup({ canarySteps: [new LLMProviderError("boom", 500)] });
      expect(await controller.complete(canaryUsers[0]!, request)).toMatchObject({ text: "stable answer", variant: "stable", fallback: true });
      expect(controller.stats("canary")).toMatchObject({ requests: 1, errors: 1, errorRate: 1 });
      expect(controller.stats("stable")).toMatchObject({ requests: 1, errors: 0 });
    });

    it("propagates stable failures and records them", async () => {
      const error = new LLMProviderError("down", 503);
      const { controller } = setup({ stableSteps: [error] });
      await expect(controller.complete(stableUsers[0]!, request)).rejects.toBe(error);
      expect(controller.stats("stable")).toMatchObject({ requests: 1, errors: 1 });
    });

    it("measures latency and computes p95 over successful samples", async () => {
      const { controller } = setup({ latency: { canary: 300 } });
      for (const u of canaryUsers.slice(0, 3)) await controller.complete(u, request);
      expect(controller.stats("canary")).toEqual({ requests: 3, errors: 0, errorRate: 0, p95LatencyMs: 300, feedbackCount: 0, negativeFeedback: 0 });
      expect(controller.stats("stable").p95LatencyMs).toBeNull();
    });
  });

  describe("Shadow mode", () => {
    it("serves stable responses and mirrors requests to the canary in the background", async () => {
      let release!: (r: CompletionResponse) => void;
      const { controller, canary, stable } = setup({ mode: "shadow", canarySteps: [() => new Promise<CompletionResponse>((r) => (release = r))] });
      const res = await controller.complete(canaryUsers[0]!, request);
      expect(res).toMatchObject({ text: "stable answer", variant: "stable", fallback: false });
      expect(controller.assign(canaryUsers[0]!)).toBe("stable");
      expect(stable.complete).toHaveBeenCalledTimes(1);
      expect(canary.complete).toHaveBeenCalledTimes(1);
      expect(canary.calls[0]).toEqual(request);
      expect(controller.stats("canary").requests).toBe(0);
      release(reply("shadow"));
      await controller.flushShadow();
      expect(controller.stats("canary")).toMatchObject({ requests: 1, errors: 0 });
    });

    it("never surfaces shadow failures", async () => {
      const { controller } = setup({ mode: "shadow", canarySteps: [new Error("canary crashed")] });
      expect((await controller.complete("anyone", request)).text).toBe("stable answer");
      await controller.flushShadow();
      expect(controller.stats("canary")).toMatchObject({ requests: 1, errors: 1 });
    });

    it("cannot be promoted", async () => {
      const { controller } = setup({ mode: "shadow" });
      for (let i = 0; i < 4; i++) await controller.complete(`u${i}`, request);
      await controller.flushShadow();
      expectThrows(() => controller.promote(), PromotionError);
    });
  });

  describe("Feedback and evaluation", () => {
    it("attributes feedback to the serving variant and rejects unknown ids", async () => {
      const { controller } = setup({ canarySteps: [new LLMProviderError("x", 500), reply("ok")] });
      const fallback = await controller.complete(canaryUsers[0]!, request);
      const served = await controller.complete(canaryUsers[1]!, request);
      controller.feedback(fallback.requestId, false);
      controller.feedback(served.requestId, true);
      expect(controller.stats("stable")).toMatchObject({ feedbackCount: 1, negativeFeedback: 1 });
      expect(controller.stats("canary")).toMatchObject({ feedbackCount: 1, negativeFeedback: 0 });
      expectThrows(() => controller.feedback("nope", true), RangeError);
    });

    it("reports insufficient data below minSamples", async () => {
      const { controller } = setup();
      for (const u of canaryUsers.slice(0, 3)) await controller.complete(u, request);
      expect(controller.evaluate()).toEqual({ state: "running", decision: "insufficient_data", reasons: [] });
    });

    it("stays running when the canary is healthy and can then be promoted", async () => {
      const { controller } = setup();
      for (const u of [...canaryUsers.slice(0, 4), ...stableUsers.slice(0, 4)]) await controller.complete(u, request);
      expect(controller.evaluate()).toEqual({ state: "running", decision: "healthy", reasons: [] });
      controller.promote();
      expect(controller.state()).toBe("promoted");
      expect(controller.assign(stableUsers[0]!)).toBe("canary");
      expect(controller.evaluate()).toEqual({ state: "promoted", decision: "promoted", reasons: [] });
      expectThrows(() => controller.promote(), PromotionError);
    });

    it("rolls back on error rate, latency and feedback, reporting reasons in order", async () => {
      const { controller } = setup({ latency: { canary: 1500 }, canarySteps: [new LLMProviderError("x", 500), reply("ok"), reply("ok"), reply("ok"), reply("ok")] });
      const ids: string[] = [];
      for (const u of canaryUsers.slice(0, 5)) ids.push((await controller.complete(u, request)).requestId);
      for (const id of ids.slice(1, 4)) controller.feedback(id, false);
      const result = controller.evaluate();
      expect(result).toEqual({ state: "rolled_back", decision: "rolled_back", reasons: ["error_rate", "latency", "feedback"] });
      expect(controller.state()).toBe("rolled_back");
      expect(canaryUsers.map((u) => controller.assign(u))).toEqual(canaryUsers.map(() => "stable"));
      expect((await controller.complete(canaryUsers[0]!, request)).variant).toBe("stable");
      expect(controller.evaluate()).toEqual({ state: "rolled_back", decision: "rolled_back", reasons: [] });
    });

    it("compares the canary error rate against the stable error rate", async () => {
      const { controller } = setup({
        canarySteps: [new LLMProviderError("x", 500), reply("ok"), reply("ok"), reply("ok")],
        stableSteps: [reply("ok"), new LLMProviderError("y", 500), reply("ok"), reply("ok"), reply("ok")],
      });
      for (const u of stableUsers.slice(0, 4)) await controller.complete(u, request).catch(() => {});
      for (const u of canaryUsers.slice(0, 4)) await controller.complete(u, request);
      // canary 1/4 = 0.25; stable: 1 failure in 5 requests (one is the canary fallback) = 0.2 → delta 0.05 ≤ 0.1
      expect(controller.evaluate().decision).toBe("healthy");
    });

    it("refuses promotion when not healthy", async () => {
      const { controller } = setup();
      const error = expectThrows(() => controller.promote(), PromotionError);
      expect(error.decision).toBe("insufficient_data");
      expect(controller.state()).toBe("running");
    });

    it("only considers samples inside the window", async () => {
      const { controller, advance } = setup({ windowMs: 10_000, canarySteps: [new LLMProviderError("x", 500)] });
      for (const u of canaryUsers.slice(0, 4)) await controller.complete(u, request);
      expect(controller.stats("canary").errors).toBe(4);
      advance(10_000);
      expect(controller.stats("canary")).toMatchObject({ requests: 0, errors: 0, errorRate: 0 });
      expect(controller.evaluate().decision).toBe("insufficient_data");
    });
  });
});
