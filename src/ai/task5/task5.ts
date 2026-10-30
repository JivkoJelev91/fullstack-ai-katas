/**
 * AI-005: Model Router with Fallbacks, Rate Limits and Budgets
 * Specification: ./task5.md (in this folder)
 * Run the tests: npm run test:ai:5
 *
 * Keep the exported types, classes and signature unchanged; the tests depend on them.
 */
import { LLMProviderError, type CompletionRequest, type CompletionResponse, type LLMClient } from "../shared/llm";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface ModelRoute {
  id: string;
  model: string;
  client: LLMClient;
  /** USD per million tokens. */
  pricing: { inputPerMTok: number; outputPerMTok: number };
  limits: { requestsPerMinute: number; tokensPerMinute: number };
}

export interface BudgetStore {
  getSpent(tenantId: string, day: string): Promise<number>;
  addSpent(tenantId: string, day: string, usd: number): Promise<void>;
}

export interface RouterOptions {
  routes: ModelRoute[];
  budget: { store: BudgetStore; dailyLimitUsd: number };
  now?: () => number;
  estimateInputTokens?: (request: Omit<CompletionRequest, "model">) => number;
}

export type AttemptOutcome = "success" | "rate_limited" | "error" | "skipped_budget";

export interface RouteAttempt {
  routeId: string;
  outcome: AttemptOutcome;
}

export interface RoutedResponse extends CompletionResponse {
  routeId: string;
  model: string;
  costUsd: number;
  attempts: RouteAttempt[];
}

export interface ModelRouter {
  complete(tenantId: string, request: Omit<CompletionRequest, "model">): Promise<RoutedResponse>;
}

export class BudgetExceededError extends Error {
  constructor(readonly tenantId: string) {
    super(`Daily budget exceeded for tenant ${tenantId}`);
    this.name = "BudgetExceededError";
  }
}

export class AllRoutesFailedError extends Error {
  constructor(
    readonly attempts: RouteAttempt[],
    readonly lastError: unknown,
  ) {
    super("All model routes failed or were unavailable");
    this.name = "AllRoutesFailedError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createModelRouter(options: RouterOptions): ModelRouter {
  // TODO: apply defaults ("Options" section)

  return {
    async complete(tenantId, request) {
      // TODO: routing, skipping and fallbacks
      // TODO: budgets
      // TODO: results and errors
      throw new Error("AI-005 router.complete is not implemented yet");
    },
  };
}
