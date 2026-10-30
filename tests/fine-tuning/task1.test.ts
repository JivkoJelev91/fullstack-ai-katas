import { describe, expect, it } from "vitest";
import { estimateCosts, recommendApproach, type CostInput, type UseCase } from "../../src/fine-tuning/task1/task1";

const none: UseCase = {
  knowledgeChangesFrequently: false,
  needsCitations: false,
  knowledgeBaseDocuments: 0,
  needsStyleConsistency: false,
  strictOutputFormat: false,
  latencySensitive: false,
  labeledExamples: 0,
};

const costs: CostInput = {
  requestsPerMonth: 1_000_000,
  basePromptTokens: 500,
  ragContextTokens: 1500,
  outputTokens: 200,
  ftPromptTokens: 300,
  pricing: { inputPerMTok: 3, outputPerMTok: 15 },
  ftPricing: { inputPerMTok: 3, outputPerMTok: 15, trainingPerMTok: 25 },
  trainingTokens: 20_000_000,
  epochs: 3,
  vectorDbMonthlyUsd: 500,
  ftHostingMonthlyUsd: 0,
};

describe("FT-001", () => {
  describe("recommendApproach", () => {
    it("recommends prompting when nothing applies", () => {
      expect(recommendApproach(none)).toEqual({ approach: "prompting", reasons: [] });
    });

    it.each<[Partial<UseCase>, string]>([
      [{ knowledgeChangesFrequently: true }, "fresh_knowledge"],
      [{ needsCitations: true }, "citations_required"],
      [{ knowledgeBaseDocuments: 51 }, "large_knowledge_base"],
    ])("recommends RAG for %j", (override, reason) => {
      expect(recommendApproach({ ...none, ...override })).toEqual({ approach: "rag", reasons: [reason] });
    });

    it("does not trigger RAG for exactly 50 documents", () => {
      expect(recommendApproach({ ...none, knowledgeBaseDocuments: 50 }).approach).toBe("prompting");
    });

    it.each<[Partial<UseCase>, string]>([
      [{ needsStyleConsistency: true }, "style_consistency"],
      [{ strictOutputFormat: true }, "strict_format"],
      [{ latencySensitive: true }, "latency"],
    ])("recommends fine-tuning for %j with enough examples", (override, reason) => {
      expect(recommendApproach({ ...none, ...override, labeledExamples: 500 })).toEqual({ approach: "fine_tuning", reasons: [reason] });
    });

    it("refuses fine-tuning with fewer than 500 examples", () => {
      expect(recommendApproach({ ...none, strictOutputFormat: true, labeledExamples: 499 })).toEqual({
        approach: "prompting",
        reasons: ["strict_format", "insufficient_examples"],
      });
    });

    it("combines RAG and fine-tuning and lists every reason in order", () => {
      expect(
        recommendApproach({
          knowledgeChangesFrequently: true,
          needsCitations: true,
          knowledgeBaseDocuments: 900,
          needsStyleConsistency: true,
          strictOutputFormat: true,
          latencySensitive: true,
          labeledExamples: 10_000,
        }),
      ).toEqual({
        approach: "rag_plus_fine_tuning",
        reasons: ["fresh_knowledge", "citations_required", "large_knowledge_base", "style_consistency", "strict_format", "latency"],
      });
    });

    it("falls back to RAG when fine-tuning is wanted but not viable", () => {
      expect(recommendApproach({ ...none, knowledgeChangesFrequently: true, needsStyleConsistency: true, labeledExamples: 120 })).toEqual({
        approach: "rag",
        reasons: ["fresh_knowledge", "style_consistency", "insufficient_examples"],
      });
    });

    it("does not report insufficient examples when fine-tuning is not wanted", () => {
      expect(recommendApproach({ ...none, needsCitations: true, labeledExamples: 3 }).reasons).toEqual(["citations_required"]);
    });
  });

  describe("estimateCosts", () => {
    it("computes monthly costs, training cost and break-even", () => {
      const result = estimateCosts(costs);
      expect(result.rag.monthlyUsd).toBeCloseTo(9500, 9);
      expect(result.fineTuning.monthlyUsd).toBeCloseTo(3900, 9);
      expect(result.fineTuning.trainingUsd).toBeCloseTo(1500, 9);
      expect(result.breakEvenMonths).toBeCloseTo(1500 / 5600, 12);
    });

    it("includes hosting costs and returns null when fine-tuning never pays off", () => {
      const result = estimateCosts({ ...costs, ftHostingMonthlyUsd: 6000 });
      expect(result.fineTuning.monthlyUsd).toBeCloseTo(9900, 9);
      expect(result.breakEvenMonths).toBeNull();
      expect(estimateCosts({ ...costs, ftHostingMonthlyUsd: 5600 }).breakEvenMonths).toBeNull();
    });

    it("uses separate prices for the fine-tuned model", () => {
      const result = estimateCosts({ ...costs, ftPricing: { inputPerMTok: 6, outputPerMTok: 30, trainingPerMTok: 10 } });
      expect(result.fineTuning.monthlyUsd).toBeCloseTo(1e6 * (300 * 6 + 200 * 30) / 1e6, 9);
      expect(result.fineTuning.trainingUsd).toBeCloseTo(600, 9);
    });

    it("handles zero traffic", () => {
      const result = estimateCosts({ ...costs, requestsPerMonth: 0 });
      expect(result.rag.monthlyUsd).toBe(500);
      expect(result.fineTuning.monthlyUsd).toBe(0);
      expect(result.breakEvenMonths).toBeCloseTo(3, 12);
    });
  });
});
