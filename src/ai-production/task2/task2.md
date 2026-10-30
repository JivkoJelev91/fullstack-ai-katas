# LLM Observability: OpenTelemetry Spans and Metrics

**Task ID:** AIOPS-002 · **Level:** 2 · **File:** `src/ai-production/task2/task2.ts` · **Tests:** `npm run test:aiops:2`

Wrap an `LLMClient` so that each call creates an OpenTelemetry span with GenAI attributes and records metrics (latency, tokens, errors).

## What you export

```ts
export function createTracedClient(inner: LLMClient, options: {
  tracer: Tracer; provider: string; metrics?: LLMMetrics; now?: () => number; recordContent?: boolean; redact?: (text: string) => string;
}): LLMClient;

export class LLMMetrics {
  record(sample: { model, durationMs, inputTokens, outputTokens, error }): void;
  snapshot(model?: string): { count, errorCount, errorRate, p50Ms, p95Ms, inputTokens, outputTokens };
}
```

`Tracer`, `SpanKind`, `SpanStatusCode`, `context` and `trace` come from `@opentelemetry/api` (installed). The tests use an in-memory span exporter.

## `complete(request)`: the span

Use `tracer.startActiveSpan("chat " + request.model, { kind: SpanKind.CLIENT, attributes }, async (span) => { ... })`. That makes the span a child of the current active span, and `inner.complete` runs inside it.

**Attributes set at the start:**

| Attribute | Value |
| --------- | ----- |
| `gen_ai.operation.name` | `"chat"` |
| `gen_ai.provider.name` | `options.provider` |
| `gen_ai.request.model` | `request.model` |
| `gen_ai.request.max_tokens` | `request.maxTokens` |
| `gen_ai.request.temperature` | `request.temperature`, only if it is set |

**On success:**

| Attribute | Value |
| --------- | ----- |
| `gen_ai.usage.input_tokens` | `response.usage.inputTokens` |
| `gen_ai.usage.output_tokens` | `response.usage.outputTokens` |
| `gen_ai.response.finish_reasons` | `[response.stopReason]` |

Leave the status unset, end the span, and return the response unchanged.

**On error:**
- `span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })`
- `error.type` = `String(error.status)` for an `LLMProviderError` (e.g. `"429"`), otherwise `error.name`
- `span.recordException(error)`, end the span, and rethrow the **same** error.

End every span exactly once.

**Content** (off by default, so no attribute may contain prompt or answer text). When `recordContent: true`:
- `gen_ai.input.messages` = `JSON.stringify(messages)`, with each `content` passed through `redact` (default: no change)
- on success, `gen_ai.output.text` = `redact(response.text)`

## Metrics

If `options.metrics` is set, call `metrics.record(...)` once per call:

```ts
{ model: request.model, durationMs: now() at end - now() at start, inputTokens, outputTokens /* 0 on error */, error: boolean }
```

**`snapshot(model?)`** covers all samples, or only that model's:

| Field | Value |
| ----- | ----- |
| `count`, `errorCount` | number of samples / failed samples |
| `errorRate` | `errorCount / count` (`0` if there are no samples) |
| `p50Ms`, `p95Ms` | nearest rank: sort the durations, take `sorted[Math.ceil(p / 100 * n) - 1]` (`null` if there are no samples) |
| `inputTokens`, `outputTokens` | sums |

## Examples

**Success inside an HTTP span**

```ts
const client = createTracedClient(provider, { tracer, provider: "anthropic", metrics });
await tracer.startActiveSpan("POST /chat", async (http) => {
  await client.complete({ model: "claude-x", maxTokens: 256, temperature: 0, messages });
  http.end();
});
```

Exported spans:

```text
POST /chat
└── chat claude-x   (kind CLIENT, status UNSET)
      gen_ai.operation.name          = "chat"
      gen_ai.provider.name           = "anthropic"
      gen_ai.request.model           = "claude-x"
      gen_ai.request.max_tokens      = 256
      gen_ai.request.temperature     = 0
      gen_ai.usage.input_tokens      = 100
      gen_ai.usage.output_tokens     = 20
      gen_ai.response.finish_reasons = ["end"]
```

```ts
metrics.snapshot("claude-x");
// → { count: 1, errorCount: 0, errorRate: 0, p50Ms: 42, p95Ms: 42, inputTokens: 100, outputTokens: 20 }
```

**Provider error**

```ts
// inner throws new LLMProviderError("rate limited", 429)
await client.complete(req);   // → throws the same error
// span: status ERROR "rate limited", error.type = "429", one "exception" event
// metrics sample: { error: true, inputTokens: 0, outputTokens: 0, ... }
```

**Percentiles**

```ts
// durations 10, 20, 30, ..., 100 (10 samples)
metrics.snapshot();   // → { ..., p50Ms: 50, p95Ms: 100 }

new LLMMetrics().snapshot();
// → { count: 0, errorCount: 0, errorRate: 0, p50Ms: null, p95Ms: null, inputTokens: 0, outputTokens: 0 }
```

## Rules

- You may use any npm package.
- Edit only `task2.ts`. Do not change the tests.
