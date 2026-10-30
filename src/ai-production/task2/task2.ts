/**
 * AIOPS-002: LLM Observability: OpenTelemetry Spans and Metrics
 * Specification: ./task2.md (in this folder)
 * Run the tests: npm run test:aiops:2
 *
 * Keep the exported types, class and signatures unchanged; the tests depend on them.
 */
import { context, SpanKind, SpanStatusCode, trace, type Tracer } from "@opentelemetry/api";
import { LLMProviderError, type LLMClient } from "../../ai/shared/llm";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface LLMCallSample {
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  error: boolean;
}

export interface LLMMetricsSnapshot {
  count: number;
  errorCount: number;
  errorRate: number;
  p50Ms: number | null;
  p95Ms: number | null;
  inputTokens: number;
  outputTokens: number;
}

export interface TracedClientOptions {
  tracer: Tracer;
  provider: string;
  metrics?: LLMMetrics;
  now?: () => number;
  recordContent?: boolean;
  redact?: (text: string) => string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class LLMMetrics {
  record(sample: LLMCallSample): void {
    // TODO: see the specification
    throw new Error("AIOPS-002 LLMMetrics.record is not implemented yet");
  }

  snapshot(model?: string): LLMMetricsSnapshot {
    // TODO: see the specification
    throw new Error("AIOPS-002 LLMMetrics.snapshot is not implemented yet");
  }
}

export function createTracedClient(inner: LLMClient, options: TracedClientOptions): LLMClient {
  return {
    async complete(request) {
      // TODO: span creation and context
      // TODO: success and error handling
      // TODO: content recording
      // TODO: metrics
      throw new Error("AIOPS-002 complete is not implemented yet");
    },
  };
}
