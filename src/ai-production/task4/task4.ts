/**
 * AIOPS-004: LLM Evaluation Suite with a CI Regression Gate
 * Specification: ./task4.md (in this folder)
 * Run the tests: npm run test:aiops:4
 *
 * Keep the exported types and signatures unchanged; the tests depend on them.
 */
import type { z } from "zod";
import type { LLMClient } from "../../ai/shared/llm";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface EvalCase {
  id: string;
  input: string;
  expected?: string;
  tags?: string[];
}

export interface Scorer {
  name: string;
  threshold: number;
  score(input: { case: EvalCase; output: string }): Promise<number | null>;
}

export interface CaseResult {
  caseId: string;
  output: string | null;
  error: string | null;
  durationMs: number;
  scores: Record<string, number | null>;
}

export interface ScorerSummary {
  mean: number | null;
  passRate: number;
  scored: number;
  errors: number;
}

export interface EvalReport {
  results: CaseResult[];
  summary: Record<string, ScorerSummary>;
  byTag: Record<string, Record<string, { mean: number | null; passRate: number }>>;
  errorRate: number;
}

export interface EvalSuiteOptions {
  cases: EvalCase[];
  target: (input: string, signal: AbortSignal) => Promise<string>;
  scorers: Scorer[];
  concurrency: number;
  timeoutMs: number;
  now?: () => number;
}

export interface Baseline {
  summary: Record<string, { mean: number | null }>;
  errorRate: number;
}

export interface RegressionGate {
  maxMeanDrop: Record<string, number>;
  maxErrorRate: number;
}

// ---------------------------------------------------------------------------
// Scorers
// ---------------------------------------------------------------------------

export function exactMatch(options: { caseSensitive?: boolean; trim?: boolean } = {}): Scorer {
  // TODO: see the specification
  throw new Error("AIOPS-004 exactMatch is not implemented yet");
}

export function containsAll(keywords: string[] | ((c: EvalCase) => string[])): Scorer {
  // TODO: see the specification
  throw new Error("AIOPS-004 containsAll is not implemented yet");
}

export function jsonSchema(schema: z.ZodType): Scorer {
  // TODO: see the specification
  throw new Error("AIOPS-004 jsonSchema is not implemented yet");
}

export function llmJudge(options: { judge: LLMClient; rubric: string; model?: string; threshold?: number }): Scorer {
  // TODO: see the specification
  throw new Error("AIOPS-004 llmJudge is not implemented yet");
}

// ---------------------------------------------------------------------------
// Suite and gate
// ---------------------------------------------------------------------------

export async function runEvalSuite(options: EvalSuiteOptions): Promise<EvalReport> {
  // TODO: running targets with concurrency and timeouts
  // TODO: scoring
  // TODO: results, summary, byTag, errorRate
  throw new Error("AIOPS-004 runEvalSuite is not implemented yet");
}

export function checkRegression(report: EvalReport, baseline: Baseline, gate: RegressionGate): { passed: boolean; failures: string[] } {
  // TODO: see the specification
  throw new Error("AIOPS-004 checkRegression is not implemented yet");
}
