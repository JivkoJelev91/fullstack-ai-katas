import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  checkRegression,
  containsAll,
  exactMatch,
  jsonSchema,
  llmJudge,
  runEvalSuite,
  type EvalCase,
  type EvalReport,
  type Scorer,
} from "../../src/ai-production/task4/task4";
import { reply, scriptedLLM } from "../support/mock-llm";

const c = (id: string, extra: Partial<EvalCase> = {}): EvalCase => ({ id, input: `input ${id}`, ...extra });

describe("AIOPS-004", () => {
  describe("Scorers", () => {
    it("exactMatch trims and ignores case by default", async () => {
      const s = exactMatch();
      expect([s.name, s.threshold]).toEqual(["exact_match", 1]);
      expect(await s.score({ case: c("1", { expected: "Paris" }), output: "  paris \n" })).toBe(1);
      expect(await s.score({ case: c("1", { expected: "Paris" }), output: "Paris, France" })).toBe(0);
      expect(await s.score({ case: c("1"), output: "anything" })).toBeNull();
    });

    it("exactMatch supports case-sensitive and untrimmed comparison", async () => {
      expect(await exactMatch({ caseSensitive: true }).score({ case: c("1", { expected: "Paris" }), output: "paris" })).toBe(0);
      expect(await exactMatch({ trim: false }).score({ case: c("1", { expected: "Paris" }), output: " Paris" })).toBe(0);
    });

    it("containsAll scores keyword coverage case-insensitively", async () => {
      const s = containsAll(["refund", "14 days", "receipt"]);
      expect([s.name, s.threshold]).toEqual(["contains_all", 1]);
      expect(await s.score({ case: c("1"), output: "Refunds take 14 DAYS." })).toBeCloseTo(2 / 3, 12);
      expect(await containsAll([]).score({ case: c("1"), output: "x" })).toBe(1);
      const dynamic = containsAll((k) => k.tags ?? []);
      expect(await dynamic.score({ case: c("1", { tags: ["alpha", "beta"] }), output: "ALPHA only" })).toBe(0.5);
    });

    it("jsonSchema checks parseability and shape", async () => {
      const s = jsonSchema(z.object({ category: z.enum(["bug", "billing"]), priority: z.number().int() }));
      expect([s.name, s.threshold]).toEqual(["json_schema", 1]);
      expect(await s.score({ case: c("1"), output: '{"category":"bug","priority":2}' })).toBe(1);
      expect(await s.score({ case: c("1"), output: '{"category":"other","priority":2}' })).toBe(0);
      expect(await s.score({ case: c("1"), output: "not json" })).toBe(0);
    });

    it("llmJudge normalizes the 1-5 score and sends rubric, input, expected and output", async () => {
      const judge = scriptedLLM(reply('{"score": 4, "reason": "mostly correct"}'));
      const s = llmJudge({ judge: judge.llm, rubric: "Grade factual accuracy." });
      expect([s.name, s.threshold]).toEqual(["llm_judge", 0.75]);
      expect(await s.score({ case: c("1", { input: "Capital of France?", expected: "Paris" }), output: "It is Paris." })).toBe(0.75);
      const call = judge.calls[0]!;
      expect(call).toMatchObject({ model: "judge-model", temperature: 0 });
      expect(call.messages[0]).toMatchObject({ role: "system" });
      expect(call.messages[0]!.content).toContain("Grade factual accuracy.");
      const user = call.messages.find((m) => m.role === "user")!.content;
      for (const part of ["Capital of France?", "Paris", "It is Paris."]) expect(user).toContain(part);
    });

    it.each([
      ["a non-integer score", '{"score": 3.5, "reason": "x"}'],
      ["an out-of-range score", '{"score": 6, "reason": "x"}'],
      ["prose", "I would give it a 4."],
    ])("llmJudge returns null for %s", async (_label, text) => {
      const s = llmJudge({ judge: scriptedLLM(reply(text)).llm, rubric: "r", model: "judge-xl", threshold: 0.5 });
      expect(s.threshold).toBe(0.5);
      expect(await s.score({ case: c("1"), output: "x" })).toBeNull();
    });

    it("llmJudge returns null when the judge fails", async () => {
      expect(await llmJudge({ judge: scriptedLLM(new Error("judge down")).llm, rubric: "r" }).score({ case: c("1"), output: "x" })).toBeNull();
    });
  });

  describe("runEvalSuite", () => {
    const answers: Record<string, string | Error | "hang"> = {
      "Capital of France?": " paris ",
      "2+2?": "5",
      "Slow question": "hang",
      "Broken question": new Error("target crashed"),
    };
    const target = vi.fn((input: string, signal: AbortSignal) => {
      const a = answers[input];
      if (a === "hang") return new Promise<string>((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
      if (a instanceof Error) return Promise.reject(a);
      return Promise.resolve(a ?? "");
    });
    const cases: EvalCase[] = [
      { id: "c1", input: "Capital of France?", expected: "Paris", tags: ["geo"] },
      { id: "c2", input: "2+2?", expected: "4", tags: ["math"] },
      { id: "c3", input: "Slow question", expected: "x", tags: ["geo"] },
      { id: "c4", input: "Broken question", expected: "y" },
    ];

    it("runs targets, scores outputs and records failures per case", async () => {
      const report = await runEvalSuite({ cases, target, scorers: [exactMatch()], concurrency: 2, timeoutMs: 50 });
      expect(report.results.map((r) => [r.caseId, r.output, r.error, r.scores])).toEqual([
        ["c1", " paris ", null, { exact_match: 1 }],
        ["c2", "5", null, { exact_match: 0 }],
        ["c3", null, "Timed out after 50 ms", { exact_match: null }],
        ["c4", null, "target crashed", { exact_match: null }],
      ]);
      expect(report.summary).toEqual({ exact_match: { mean: 0.5, passRate: 0.25, scored: 2, errors: 0 } });
      expect(report.errorRate).toBe(0.5);
      expect(report.byTag).toEqual({
        geo: { exact_match: { mean: 1, passRate: 0.5 } },
        math: { exact_match: { mean: 0, passRate: 0 } },
      });
    });

    it("does not call scorers for failed targets and counts scorer errors", async () => {
      const throwing: Scorer = { name: "flaky", threshold: 0.5, score: vi.fn(async ({ output }) => (output === "5" ? Promise.reject(new Error("boom")) : 0.9)) };
      const report = await runEvalSuite({ cases, target, scorers: [throwing], concurrency: 4, timeoutMs: 30 });
      expect(throwing.score).toHaveBeenCalledTimes(2);
      expect(report.summary.flaky).toEqual({ mean: 0.9, passRate: 0.25, scored: 1, errors: 1 });
    });

    it("measures duration with the injected clock", async () => {
      let t = 0;
      const slowTarget = async () => {
        t += 120;
        return "Paris";
      };
      const report = await runEvalSuite({ cases: [cases[0]!], target: slowTarget, scorers: [exactMatch()], concurrency: 1, timeoutMs: 1000, now: () => t });
      expect(report.results[0]!.durationMs).toBe(120);
    });

    it("respects the concurrency limit and keeps input order", async () => {
      let inFlight = 0;
      let peak = 0;
      const delays = [40, 5, 25, 1, 15, 30];
      const many = delays.map((d, i) => c(`k${i}`, { input: String(d) }));
      const report = await runEvalSuite({
        cases: many,
        target: async (input) => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          await new Promise((r) => setTimeout(r, Number(input)));
          inFlight--;
          return input;
        },
        scorers: [containsAll([])],
        concurrency: 3,
        timeoutMs: 1000,
      });
      expect(peak).toBe(3);
      expect(report.results.map((r) => r.caseId)).toEqual(many.map((m) => m.id));
    });

    it("returns an empty report for no cases", async () => {
      const report = await runEvalSuite({ cases: [], target, scorers: [exactMatch()], concurrency: 1, timeoutMs: 10 });
      expect(report).toEqual({ results: [], summary: { exact_match: { mean: null, passRate: 0, scored: 0, errors: 0 } }, byTag: {}, errorRate: 0 });
    });
  });

  describe("checkRegression", () => {
    const report = (summary: Record<string, number | null>, errorRate = 0): EvalReport => ({
      results: [],
      summary: Object.fromEntries(Object.entries(summary).map(([k, mean]) => [k, { mean, passRate: 0, scored: 0, errors: 0 }])),
      byTag: {},
      errorRate,
    });

    it("passes within tolerances", () => {
      expect(checkRegression(report({ exact_match: 0.8, llm_judge: 0.7 }), { summary: { exact_match: { mean: 0.85 }, llm_judge: { mean: 0.7 } }, errorRate: 0 }, { maxMeanDrop: { exact_match: 0.05 }, maxErrorRate: 0.1 })).toEqual({ passed: true, failures: [] });
    });

    it("reports missing scorers, mean drops and error rate in order", () => {
      const result = checkRegression(
        report({ exact_match: 0.5, llm_judge: null }, 0.2),
        { summary: { zeta: { mean: 0.1 }, exact_match: { mean: 0.9 }, llm_judge: { mean: 0.8 } }, errorRate: 0 },
        { maxMeanDrop: { exact_match: 0.1 }, maxErrorRate: 0.05 },
      );
      expect(result).toEqual({ passed: false, failures: ["exact_match.mean", "llm_judge.missing", "zeta.missing", "errorRate"] });
    });

    it("treats a missing tolerance as zero", () => {
      expect(checkRegression(report({ a: 0.79 }), { summary: { a: { mean: 0.8 } }, errorRate: 0 }, { maxMeanDrop: {}, maxErrorRate: 1 }).failures).toEqual(["a.mean"]);
      expect(checkRegression(report({ a: 0.7 }), { summary: { a: { mean: 0.8 } }, errorRate: 0 }, { maxMeanDrop: { a: 0.1 }, maxErrorRate: 1 }).passed).toBe(true);
    });
  });
});
