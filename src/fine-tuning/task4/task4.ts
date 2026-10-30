/**
 * FT-004: Fine-Tuning Job Orchestration and Promotion Gate
 * Specification: ./task4.md (in this folder)
 * Run the tests: npm run test:ft:4
 *
 * Keep the exported types, classes and signatures unchanged; the tests depend on them.
 */
import { createHash } from "node:crypto";
import { LLMProviderError } from "../../ai/shared/llm";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface FineTuneJob {
  id: string;
  status: JobStatus;
  fineTunedModel: string | null;
  error: string | null;
  idempotencyKey: string;
}

export interface Hyperparameters {
  nEpochs: number;
  learningRateMultiplier: number;
  batchSize: number;
}

export interface FineTuningProvider {
  uploadFile(name: string, content: string): Promise<{ id: string }>;
  findJobByIdempotencyKey(key: string): Promise<FineTuneJob | null>;
  createJob(input: {
    trainingFileId: string;
    validationFileId: string | null;
    baseModel: string;
    suffix: string;
    hyperparameters: Hyperparameters;
    idempotencyKey: string;
  }): Promise<FineTuneJob>;
  getJob(id: string): Promise<FineTuneJob>;
  cancelJob(id: string): Promise<void>;
}

export interface FineTuneSpec {
  baseModel: string;
  suffix: string;
  trainJsonl: string;
  validationJsonl: string;
  hyperparameters: Hyperparameters;
}

export interface FineTuneRunOptions {
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  pollIntervalMs: number;
  maxWaitMs: number;
  signal?: AbortSignal;
}

export interface FineTuneResult {
  jobId: string;
  model: string;
  reused: boolean;
}

export class FineTuneFailedError extends Error {
  constructor(
    readonly jobId: string,
    message: string,
  ) {
    super(message);
    this.name = "FineTuneFailedError";
  }
}

export class FineTuneTimeoutError extends Error {
  constructor(readonly jobId: string) {
    super(`Fine-tuning job ${jobId} did not finish in time`);
    this.name = "FineTuneTimeoutError";
  }
}

export class FineTuneAbortedError extends Error {
  constructor(readonly jobId: string | null) {
    super("Fine-tuning was aborted");
    this.name = "FineTuneAbortedError";
  }
}

export interface ModelRegistry {
  getAlias(alias: string): Promise<string | null>;
  setAlias(alias: string, model: string): Promise<void>;
}

export interface PromotionInput {
  candidateModel: string;
  baselineModel: string;
  cases: Array<{ id: string; input: string; expected: string }>;
  runModel(model: string, input: string): Promise<string>;
  score(output: string, expected: string): number;
  registry: ModelRegistry;
  alias: string;
  gate: { minScore: number; minImprovement: number; maxRegressionRate: number };
}

export type PromotionReason = "below_min_score" | "insufficient_improvement" | "too_many_regressions";

export interface PromotionResult {
  promoted: boolean;
  candidateScore: number;
  baselineScore: number;
  regressions: string[];
  regressionRate: number;
  previousModel: string | null;
  reasons: PromotionReason[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function runFineTuning(provider: FineTuningProvider, spec: FineTuneSpec, options: FineTuneRunOptions): Promise<FineTuneResult> {
  // TODO: early abort
  // TODO: idempotent submission
  // TODO: polling, transient errors, deadline, cancellation
  throw new Error("FT-004 runFineTuning is not implemented yet");
}

export async function evaluateAndPromote(input: PromotionInput): Promise<PromotionResult> {
  // TODO: see the specification
  throw new Error("FT-004 evaluateAndPromote is not implemented yet");
}
