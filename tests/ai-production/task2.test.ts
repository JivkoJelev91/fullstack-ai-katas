import { context, SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor, type ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LLMProviderError, type CompletionRequest } from "../../src/ai/shared/llm";
import { createTracedClient, LLMMetrics } from "../../src/ai-production/task2/task2";
import { reply, scriptedLLM } from "../support/mock-llm";

const exporter = new InMemorySpanExporter();
const provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
const tracer = provider.getTracer("aiops-002-tests");
const contextManager = new AsyncLocalStorageContextManager();

beforeAll(() => {
  context.setGlobalContextManager(contextManager.enable());
});

afterAll(() => {
  contextManager.disable();
  context.disable();
});

beforeEach(() => {
  exporter.reset();
});

const request = (overrides: Partial<CompletionRequest> = {}): CompletionRequest => ({
  model: "claude-x",
  maxTokens: 256,
  messages: [
    { role: "system", content: "You are helpful." },
    { role: "user", content: "My card is 4111 1111 1111 1111, why was I charged twice?" },
  ],
  ...overrides,
});

const spans = () => exporter.getFinishedSpans();
const chatSpan = () => spans().find((s) => s.name.startsWith("chat "))!;
const parentId = (s: ReadableSpan) => s.parentSpanContext?.spanId;

describe("AIOPS-002", () => {
  describe("Tracing", () => {
    it("creates one CLIENT span with GenAI request and usage attributes", async () => {
      const { llm } = scriptedLLM(reply("Here is why.", { usage: { inputTokens: 100, outputTokens: 20 } }));
      const client = createTracedClient(llm, { tracer, provider: "anthropic" });
      const res = await client.complete(request({ temperature: 0 }));
      expect(res.text).toBe("Here is why.");

      expect(spans()).toHaveLength(1);
      const span = chatSpan();
      expect(span.name).toBe("chat claude-x");
      expect(span.kind).toBe(SpanKind.CLIENT);
      expect(span.attributes).toEqual({
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "anthropic",
        "gen_ai.request.model": "claude-x",
        "gen_ai.request.max_tokens": 256,
        "gen_ai.request.temperature": 0,
        "gen_ai.usage.input_tokens": 100,
        "gen_ai.usage.output_tokens": 20,
        "gen_ai.response.finish_reasons": ["end"],
      });
      expect(span.status.code).toBe(SpanStatusCode.UNSET);
      expect(span.ended).toBe(true);
    });

    it("omits the temperature attribute when not set", async () => {
      const { llm } = scriptedLLM(reply("x", { stopReason: "max_tokens" }));
      await createTracedClient(llm, { tracer, provider: "openai" }).complete(request());
      expect(chatSpan().attributes).not.toHaveProperty("gen_ai.request.temperature");
      expect(chatSpan().attributes["gen_ai.response.finish_reasons"]).toEqual(["max_tokens"]);
    });

    it("parents the span to the active span and runs the inner call in its context", async () => {
      const llm = {
        complete: async () => {
          tracer.startSpan("provider.http").end();
          return reply("ok");
        },
      };
      const client = createTracedClient(llm, { tracer, provider: "anthropic" });
      await tracer.startActiveSpan("POST /chat", async (http) => {
        await client.complete(request());
        http.end();
      });
      const http = spans().find((s) => s.name === "POST /chat")!;
      const chat = chatSpan();
      const inner = spans().find((s) => s.name === "provider.http")!;
      expect(parentId(chat)).toBe(http.spanContext().spanId);
      expect(parentId(inner)).toBe(chat.spanContext().spanId);
      expect(chat.spanContext().traceId).toBe(http.spanContext().traceId);
    });

    it("records provider errors with status, error.type and an exception event", async () => {
      const error = new LLMProviderError("Rate limited", 429, 1000);
      const { llm } = scriptedLLM(error);
      const client = createTracedClient(llm, { tracer, provider: "anthropic" });
      await expect(client.complete(request())).rejects.toBe(error);
      const span = chatSpan();
      expect(span.status).toMatchObject({ code: SpanStatusCode.ERROR, message: "Rate limited" });
      expect(span.attributes["error.type"]).toBe("429");
      expect(span.events.some((e) => e.name === "exception")).toBe(true);
      expect(span.attributes).not.toHaveProperty("gen_ai.usage.input_tokens");
      expect(spans()).toHaveLength(1);
    });

    it("uses the error name as error.type for other errors", async () => {
      const { llm } = scriptedLLM(new TypeError("fetch failed"));
      await expect(createTracedClient(llm, { tracer, provider: "openai" }).complete(request())).rejects.toBeInstanceOf(TypeError);
      expect(chatSpan().attributes["error.type"]).toBe("TypeError");
    });

    it("does not record prompt or completion content by default", async () => {
      const { llm } = scriptedLLM(reply("You were charged twice because of a retry."));
      await createTracedClient(llm, { tracer, provider: "anthropic" }).complete(request());
      const dump = JSON.stringify(chatSpan().attributes) + JSON.stringify(chatSpan().events);
      expect(dump).not.toContain("4111");
      expect(dump).not.toContain("charged twice");
    });

    it("records redacted content when enabled", async () => {
      const { llm } = scriptedLLM(reply("Card 4111 1111 1111 1111 was charged twice."));
      const redact = (t: string) => t.replace(/\d{4} \d{4} \d{4} \d{4}/g, "[CARD]");
      await createTracedClient(llm, { tracer, provider: "anthropic", recordContent: true, redact }).complete(request());
      const attrs = chatSpan().attributes;
      expect(JSON.parse(attrs["gen_ai.input.messages"] as string)).toEqual([
        { role: "system", content: "You are helpful." },
        { role: "user", content: "My card is [CARD], why was I charged twice?" },
      ]);
      expect(attrs["gen_ai.output.text"]).toBe("Card [CARD] was charged twice.");
    });

    it("records content unchanged when no redact function is given", async () => {
      const { llm } = scriptedLLM(reply("ok"));
      await createTracedClient(llm, { tracer, provider: "anthropic", recordContent: true }).complete(request());
      expect(chatSpan().attributes["gen_ai.input.messages"]).toContain("4111 1111 1111 1111");
    });

    it("creates one span per call", async () => {
      const { llm } = scriptedLLM(reply("a"), new LLMProviderError("x", 500), reply("c"));
      const client = createTracedClient(llm, { tracer, provider: "anthropic" });
      await client.complete(request());
      await client.complete(request()).catch(() => {});
      await client.complete(request({ model: "claude-y" }));
      expect(spans().map((s) => s.name)).toEqual(["chat claude-x", "chat claude-x", "chat claude-y"]);
    });
  });

  describe("Metrics", () => {
    it("records duration, tokens and errors per call", async () => {
      let t = 0;
      const durations = [40, 15, 90];
      let i = 0;
      const now = () => t;
      const metrics = new LLMMetrics();
      const { llm } = scriptedLLM(
        async () => { t += durations[i++]!; return reply("a", { usage: { inputTokens: 100, outputTokens: 20 } }); },
        async () => { t += durations[i++]!; throw new LLMProviderError("down", 503); },
        async () => { t += durations[i++]!; return reply("c", { usage: { inputTokens: 50, outputTokens: 5 } }); },
      );
      const client = createTracedClient(llm, { tracer, provider: "anthropic", metrics, now });
      await client.complete(request());
      await client.complete(request()).catch(() => {});
      await client.complete(request({ model: "claude-y" }));

      expect(metrics.snapshot()).toEqual({ count: 3, errorCount: 1, errorRate: 1 / 3, p50Ms: 40, p95Ms: 90, inputTokens: 150, outputTokens: 25 });
      expect(metrics.snapshot("claude-x")).toEqual({ count: 2, errorCount: 1, errorRate: 0.5, p50Ms: 15, p95Ms: 40, inputTokens: 100, outputTokens: 20 });
    });

    it("computes nearest-rank percentiles", () => {
      const metrics = new LLMMetrics();
      for (const d of [5, 1, 9, 3, 7, 2, 8, 4, 6, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
        metrics.record({ model: "m", durationMs: d, inputTokens: 1, outputTokens: 1, error: false });
      }
      expect(metrics.snapshot("m")).toMatchObject({ count: 20, p50Ms: 10, p95Ms: 19, inputTokens: 20, outputTokens: 20, errorRate: 0 });
    });

    it("returns an empty snapshot when there are no samples", () => {
      const metrics = new LLMMetrics();
      metrics.record({ model: "a", durationMs: 5, inputTokens: 1, outputTokens: 1, error: true });
      expect(metrics.snapshot("other")).toEqual({ count: 0, errorCount: 0, errorRate: 0, p50Ms: null, p95Ms: null, inputTokens: 0, outputTokens: 0 });
    });
  });
});
