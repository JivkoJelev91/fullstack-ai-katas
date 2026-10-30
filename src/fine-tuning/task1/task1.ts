/**
 * FT-001: Prompting vs RAG vs Fine-Tuning: Decision and Cost Model
 * Specification: ./task1.md (in this folder)
 * Run the tests: npm run test:ft:1
 *
 * Keep the exported types and signatures unchanged; the tests depend on them.
 */

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface UseCase {
  knowledgeChangesFrequently: boolean;
  needsCitations: boolean;
  knowledgeBaseDocuments: number;
  needsStyleConsistency: boolean;
  strictOutputFormat: boolean;
  latencySensitive: boolean;
  labeledExamples: number;
}

export type Approach = "prompting" | "rag" | "fine_tuning" | "rag_plus_fine_tuning";

export type ReasonCode =
  | "fresh_knowledge"
  | "citations_required"
  | "large_knowledge_base"
  | "style_consistency"
  | "strict_format"
  | "latency"
  | "insufficient_examples";

export interface Recommendation {
  approach: Approach;
  reasons: ReasonCode[];
}

export interface TokenPricing {
  inputPerMTok: number;
  outputPerMTok: number;
}

export interface CostInput {
  requestsPerMonth: number;
  basePromptTokens: number;
  ragContextTokens: number;
  outputTokens: number;
  ftPromptTokens: number;
  pricing: TokenPricing;
  ftPricing: TokenPricing & { trainingPerMTok: number };
  trainingTokens: number;
  epochs: number;
  vectorDbMonthlyUsd: number;
  ftHostingMonthlyUsd: number;
}

export interface CostComparison {
  rag: { monthlyUsd: number };
  fineTuning: { trainingUsd: number; monthlyUsd: number };
  breakEvenMonths: number | null;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function recommendApproach(useCase: UseCase): Recommendation {
  // TODO: see the specification
  throw new Error("FT-001 recommendApproach is not implemented yet");
}

export function estimateCosts(input: CostInput): CostComparison {
  // TODO: see the specification
  throw new Error("FT-001 estimateCosts is not implemented yet");
}
