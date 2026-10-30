/**
 * AI-002: Resilient LLM Client: Timeouts, Retries, Cancellation
 * Specification: ./task2.md (in this folder)
 * Run the tests: npm run test:ai:2
 *
 * Keep the exported types, classes and signature unchanged; the tests depend on them.
 */
import { LLMProviderError, type CompletionRequest, type CompletionResponse, type LLMClient } from "../shared/llm";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface RetryInfo {
  /** Number of the attempt that just failed (starting at 1). */
  attempt: number;
  delayMs: number;
  error: unknown;
}

export interface ResilienceOptions {
  maxAttempts?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onRetry?: (info: RetryInfo) => void;
}

/** Default option values. */
export const DEFAULT_OPTIONS = {
  maxAttempts: 3,
  timeoutMs: 30_000,
  baseDelayMs: 500,
  maxDelayMs: 8_000,
} as const;

export class LLMTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs} ms`);
    this.name = "LLMTimeoutError";
  }
}

export class RequestAbortedError extends Error {
  constructor() {
    super("LLM request was aborted by the caller");
    this.name = "RequestAbortedError";
  }
}

export class RetryExhaustedError extends Error {
  constructor(
    readonly attempts: number,
    readonly lastError: unknown,
  ) {
    super(`LLM request failed after ${attempts} attempts`, { cause: lastError });
    this.name = "RetryExhaustedError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createResilientClient(inner: LLMClient, options: ResilienceOptions = {}): LLMClient {
  // TODO: apply defaults ("Options" section)
  throw new Error("AI-002 createResilientClient is not implemented yet");

  // The returned object must implement LLMClient:
  //
  // return {
  //   async complete(request: CompletionRequest): Promise<CompletionResponse> {
  //     // TODO: attempts and timeouts
  //     // TODO: retries and backoff
  //     // TODO: cancellation
  //   },
  // };
}
