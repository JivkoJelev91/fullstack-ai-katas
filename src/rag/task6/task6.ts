/**
 * RAG-006: RAG Evaluation: Retrieval Metrics, Faithfulness, Regression Gate
 * Specification: ./task6.md (in this folder)
 * Run the tests: npm run test:rag:6
 *
 * Keep the exported types, constant and signatures unchanged; the tests depend on them.
 */
import type { LLMClient } from "../../ai/shared/llm";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export const DEFAULT_JUDGE_MODEL = "judge-model";

export interface GoldenQuery {
  queryId: string;
  /** Document id → relevance grade (0 = not relevant). */
  relevance: Record<string, number>;
}

export interface RetrievalRun {
  queryId: string;
  retrievedIds: string[];
}

export interface RetrievalMetrics {
  recall: number;
  precision: number;
  mrr: number;
  ndcg: number;
}

export interface RetrievalReport {
  k: number;
  perQuery: Array<{ queryId: string } & RetrievalMetrics>;
  mean: RetrievalMetrics;
  missingQueries: string[];
  skippedQueries: string[];
}

export interface AnswerCase {
  caseId: string;
  question: string;
  answer: string;
  contexts: string[];
}

export interface FaithfulnessCaseResult {
  caseId: string;
  status: "scored" | "judge_error";
  score: number | null;
  unsupportedClaims: string[];
}

export interface FaithfulnessReport {
  perCase: FaithfulnessCaseResult[];
  meanScore: number | null;
  judgeErrors: number;
}

export interface BaselineComparison {
  passed: boolean;
  regressions: Array<{ metric: string; baseline: number; current: number | null; drop: number | null }>;
  improvements: string[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function evaluateRetrieval(golden: GoldenQuery[], runs: RetrievalRun[], k: number): RetrievalReport {
  // TODO: see the specification
  throw new Error("RAG-006 evaluateRetrieval is not implemented yet");
}

export async function evaluateFaithfulness(
  cases: AnswerCase[],
  judge: LLMClient,
  options: { concurrency: number; model?: string },
): Promise<FaithfulnessReport> {
  // TODO: see the specification
  throw new Error("RAG-006 evaluateFaithfulness is not implemented yet");
}

export function compareToBaseline(
  current: Record<string, number>,
  baseline: Record<string, number>,
  tolerances: Record<string, number>,
): BaselineComparison {
  // TODO: see the specification
  throw new Error("RAG-006 compareToBaseline is not implemented yet");
}
