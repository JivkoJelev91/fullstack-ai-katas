/**
 * AIOPS-005: Canary and Shadow Rollout for a New Model
 * Specification: ./task5.md (in this folder)
 * Run the tests: npm run test:aiops:5
 *
 * Keep the exported types, class and signature unchanged; the tests depend on them.
 */
import { createHash, randomUUID } from "node:crypto";
import type { CompletionRequest, CompletionResponse, LLMClient } from "../../ai/shared/llm";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export type VariantName = "stable" | "canary";
export type RolloutState = "running" | "promoted" | "rolled_back";

export interface Variant {
  name: string;
  client: LLMClient;
}

export interface RolloutThresholds {
  minSamples: number;
  maxErrorRateDelta: number;
  maxP95LatencyMs: number;
  maxNegativeFeedbackRate: number;
}

export interface RolloutOptions {
  rolloutId: string;
  stable: Variant;
  canary: Variant;
  percent: number;
  thresholds: RolloutThresholds;
  mode?: "canary" | "shadow";
  windowMs?: number;
  now?: () => number;
  generateId?: () => string;
}

export interface RolloutResponse extends CompletionResponse {
  variant: VariantName;
  requestId: string;
  fallback: boolean;
}

export interface VariantStats {
  requests: number;
  errors: number;
  errorRate: number;
  p95LatencyMs: number | null;
  feedbackCount: number;
  negativeFeedback: number;
}

export type RolloutReason = "error_rate" | "latency" | "feedback";

export interface RolloutEvaluation {
  state: RolloutState;
  decision: "insufficient_data" | "healthy" | "rolled_back" | "promoted";
  reasons: RolloutReason[];
}

export interface RolloutController {
  assign(userId: string): VariantName;
  complete(userId: string, request: CompletionRequest): Promise<RolloutResponse>;
  feedback(requestId: string, positive: boolean): void;
  stats(variant: VariantName): VariantStats;
  evaluate(): RolloutEvaluation;
  promote(): void;
  state(): RolloutState;
  flushShadow(): Promise<void>;
}

export class PromotionError extends Error {
  constructor(
    readonly decision: string,
    readonly reasons: RolloutReason[],
  ) {
    super(`Cannot promote canary: ${decision}`);
    this.name = "PromotionError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createRolloutController(options: RolloutOptions): RolloutController {
  // TODO: defaults

  return {
    assign(userId) {
      // TODO: see the specification
      throw new Error("AIOPS-005 assign is not implemented yet");
    },
    async complete(userId, request) {
      // TODO: see the specification
      throw new Error("AIOPS-005 complete is not implemented yet");
    },
    feedback(requestId, positive) {
      // TODO: see the specification
      throw new Error("AIOPS-005 feedback is not implemented yet");
    },
    stats(variant) {
      // TODO: see the specification
      throw new Error("AIOPS-005 stats is not implemented yet");
    },
    evaluate() {
      // TODO: see the specification
      throw new Error("AIOPS-005 evaluate is not implemented yet");
    },
    promote() {
      // TODO: see the specification
      throw new Error("AIOPS-005 promote is not implemented yet");
    },
    state() {
      // TODO: see the specification
      throw new Error("AIOPS-005 state is not implemented yet");
    },
    async flushShadow() {
      // TODO: see the specification
      throw new Error("AIOPS-005 flushShadow is not implemented yet");
    },
  };
}
