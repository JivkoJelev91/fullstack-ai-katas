import { describe, expect, it } from "vitest";
import type { CompletionRequest, CompletionResponse } from "../../src/ai/shared/llm";
import { compareToBaseline, DEFAULT_JUDGE_MODEL, evaluateFaithfulness, evaluateRetrieval, type AnswerCase, type GoldenQuery } from "../../src/rag/task6/task6";
import { reply, scriptedLLM } from "../support/mock-llm";

const log2 = Math.log2;

describe("RAG-006", () => {
  describe("evaluateRetrieval", () => {
    const golden: GoldenQuery[] = [
      { queryId: "q1", relevance: { a: 3, b: 1 } },
      { queryId: "q2", relevance: { c: 1 } },
      { queryId: "q3", relevance: { d: 2, e: 0 } },
      { queryId: "q4", relevance: { f: 1 } },
      { queryId: "q5", relevance: { g: 0 } },
    ];
    const runs = [
      { queryId: "q1", retrievedIds: ["a", "x", "b", "a"] },
      { queryId: "q2", retrievedIds: ["x", "y", "c"] },
      { queryId: "q3", retrievedIds: [] },
      { queryId: "q5", retrievedIds: ["g"] },
      { queryId: "unknown", retrievedIds: ["a"] },
    ];
    const q1ndcg = (7 + 1 / log2(4)) / (7 + 1 / log2(3));

    it("computes recall, precision, MRR and nDCG per query", () => {
      const report = evaluateRetrieval(golden, runs, 3);
      expect(report.k).toBe(3);
      expect(report.perQuery.map((q) => q.queryId)).toEqual(["q1", "q2", "q3", "q4"]);
      const [q1, q2, q3, q4] = report.perQuery;
      expect(q1!.recall).toBeCloseTo(1, 12);
      expect(q1!.precision).toBeCloseTo(2 / 3, 12);
      expect(q1!.mrr).toBeCloseTo(1, 12);
      expect(q1!.ndcg).toBeCloseTo(q1ndcg, 12);
      expect(q2).toMatchObject({ recall: 1, mrr: expect.closeTo(1 / 3, 12), precision: expect.closeTo(1 / 3, 12), ndcg: expect.closeTo(0.5, 12) });
      expect(q3).toEqual({ queryId: "q3", recall: 0, precision: 0, mrr: 0, ndcg: 0 });
      expect(q4).toEqual({ queryId: "q4", recall: 0, precision: 0, mrr: 0, ndcg: 0 });
    });

    it("reports missing and skipped queries and averages over evaluated ones", () => {
      const report = evaluateRetrieval(golden, runs, 3);
      expect(report.missingQueries).toEqual(["q4"]);
      expect(report.skippedQueries).toEqual(["q5"]);
      expect(report.mean.recall).toBeCloseTo(2 / 4, 12);
      expect(report.mean.precision).toBeCloseTo((2 / 3 + 1 / 3) / 4, 12);
      expect(report.mean.mrr).toBeCloseTo((1 + 1 / 3) / 4, 12);
      expect(report.mean.ndcg).toBeCloseTo((q1ndcg + 0.5) / 4, 12);
    });

    it("applies the k cut-off after de-duplication", () => {
      const report = evaluateRetrieval([{ queryId: "q", relevance: { b: 1, c: 1 } }], [{ queryId: "q", retrievedIds: ["a", "a", "a", "b", "c"] }], 2);
      expect(report.perQuery[0]).toMatchObject({ recall: 0.5, precision: 0.5, mrr: 0.5 });
      expect(report.perQuery[0]!.ndcg).toBeCloseTo(1 / log2(3) / (1 + 1 / log2(3)), 12);
    });

    it("cuts the ideal ranking to k", () => {
      const report = evaluateRetrieval([{ queryId: "q", relevance: { a: 1, b: 2, c: 3 } }], [{ queryId: "q", retrievedIds: ["c"] }], 1);
      expect(report.perQuery[0]!.ndcg).toBeCloseTo(1, 12);
    });

    it("returns zero means when nothing can be evaluated", () => {
      expect(evaluateRetrieval([{ queryId: "q", relevance: { a: 0 } }], [], 5).mean).toEqual({ recall: 0, precision: 0, mrr: 0, ndcg: 0 });
    });
  });

  describe("evaluateFaithfulness", () => {
    const cases: AnswerCase[] = [
      { caseId: "c1", question: "How much leave?", answer: "25 days, rolling over forever.", contexts: ["Employees receive 25 days.", "Unused days expire in March."] },
      { caseId: "c2", question: "Remote work?", answer: "Two days per week.", contexts: ["Remote work is allowed two days per week."] },
      { caseId: "c3", question: "Parking?", answer: "I don't know.", contexts: ["Parking is limited."] },
    ];
    const verdict = (claims: Array<[string, boolean]>) => reply(JSON.stringify({ claims: claims.map(([claim, supported]) => ({ claim, supported })) }));

    it("scores each case with one judge call", async () => {
      const judge = scriptedLLM(verdict([["25 days", true], ["rolls over forever", false]]), verdict([["two days per week", true]]), verdict([]));
      const report = await evaluateFaithfulness(cases, judge.llm, { concurrency: 1 });
      expect(report).toEqual({
        perCase: [
          { caseId: "c1", status: "scored", score: 0.5, unsupportedClaims: ["rolls over forever"] },
          { caseId: "c2", status: "scored", score: 1, unsupportedClaims: [] },
          { caseId: "c3", status: "scored", score: 1, unsupportedClaims: [] },
        ],
        meanScore: expect.closeTo(2.5 / 3, 12),
        judgeErrors: 0,
      });
      expect(judge.complete).toHaveBeenCalledTimes(3);
    });

    it("sends the question, answer and contexts with deterministic settings", async () => {
      const judge = scriptedLLM(verdict([]));
      await evaluateFaithfulness([cases[0]!], judge.llm, { concurrency: 2 });
      const call = judge.calls[0]!;
      expect(call.model).toBe(DEFAULT_JUDGE_MODEL);
      expect(call.temperature).toBe(0);
      expect(call.messages[0]!.role).toBe("system");
      const user = call.messages.find((m) => m.role === "user")!.content;
      for (const part of [cases[0]!.question, cases[0]!.answer, ...cases[0]!.contexts]) expect(user).toContain(part);

      const custom = scriptedLLM(verdict([]));
      await evaluateFaithfulness([cases[0]!], custom.llm, { concurrency: 1, model: "judge-large" });
      expect(custom.calls[0]!.model).toBe("judge-large");
    });

    it("accepts fenced judge output", async () => {
      const judge = scriptedLLM(reply("```json\n" + JSON.stringify({ claims: [{ claim: "x", supported: false }] }) + "\n```"));
      expect((await evaluateFaithfulness([cases[0]!], judge.llm, { concurrency: 1 })).perCase[0]!.score).toBe(0);
    });

    it("isolates judge errors and invalid output per case", async () => {
      const judge = scriptedLLM(new Error("judge timeout"), reply("I think it is faithful."), reply(JSON.stringify({ claims: [{ claim: "x", supported: "yes" }] })), verdict([["ok", true]]));
      const report = await evaluateFaithfulness([...cases, { ...cases[0]!, caseId: "c4" }], judge.llm, { concurrency: 1 });
      expect(report.perCase.map((c) => [c.caseId, c.status, c.score])).toEqual([
        ["c1", "judge_error", null],
        ["c2", "judge_error", null],
        ["c3", "judge_error", null],
        ["c4", "scored", 1],
      ]);
      expect(report.judgeErrors).toBe(3);
      expect(report.meanScore).toBe(1);
      expect(judge.complete).toHaveBeenCalledTimes(4);
    });

    it("returns a null mean when no case could be scored", async () => {
      const judge = scriptedLLM(new Error("down"));
      expect((await evaluateFaithfulness([cases[0]!], judge.llm, { concurrency: 1 })).meanScore).toBeNull();
    });

    it("respects the concurrency limit and preserves input order", async () => {
      let inFlight = 0;
      let maxInFlight = 0;
      const delays = [30, 5, 20, 1, 15, 10];
      let call = 0;
      const judge = scriptedLLM(async (_req: CompletionRequest): Promise<CompletionResponse> => {
        const delay = delays[call++]!;
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, delay));
        inFlight--;
        return verdict([[`claim after ${delay}ms`, true]]);
      });
      const many = delays.map((_, i) => ({ ...cases[0]!, caseId: `case-${i}` }));
      const report = await evaluateFaithfulness(many, judge.llm, { concurrency: 2 });
      expect(maxInFlight).toBe(2);
      expect(report.perCase.map((c) => c.caseId)).toEqual(many.map((c) => c.caseId));
    });
  });

  describe("compareToBaseline", () => {
    it("reports missing metrics as regressions and lists improvements", () => {
      expect(compareToBaseline({ recall: 0.8, ndcg: 0.7 }, { recall: 0.82, ndcg: 0.69, mrr: 0.5 }, { recall: 0.02 })).toEqual({
        passed: false,
        regressions: [{ metric: "mrr", baseline: 0.5, current: null, drop: null }],
        improvements: ["ndcg"],
      });
    });

    it("fails when a drop exceeds its tolerance", () => {
      const result = compareToBaseline({ recall: 0.79, precision: 0.6 }, { recall: 0.82, precision: 0.6 }, { recall: 0.02 });
      expect(result.passed).toBe(false);
      expect(result.regressions).toHaveLength(1);
      expect(result.regressions[0]).toMatchObject({ metric: "recall", baseline: 0.82, current: 0.79 });
      expect(result.regressions[0]!.drop).toBeCloseTo(0.03, 12);
    });

    it("treats a missing tolerance as zero", () => {
      expect(compareToBaseline({ mrr: 0.4999 }, { mrr: 0.5 }, {}).passed).toBe(false);
      expect(compareToBaseline({ mrr: 0.5 }, { mrr: 0.5 }, {}).passed).toBe(true);
    });

    it("passes a drop exactly equal to the tolerance", () => {
      expect(compareToBaseline({ ndcg: 0.7 }, { ndcg: 0.8 }, { ndcg: 0.1 }).passed).toBe(true);
    });

    it("sorts regressions and improvements by metric name and ignores extra current metrics", () => {
      const result = compareToBaseline({ z: 0.1, a: 0.1, m: 0.9, extra: 1 }, { z: 0.5, a: 0.5, m: 0.5 }, {});
      expect(result.regressions.map((r) => r.metric)).toEqual(["a", "z"]);
      expect(result.improvements).toEqual(["m"]);
    });
  });
});
