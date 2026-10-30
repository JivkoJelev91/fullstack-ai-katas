import { describe, expect, it, vi } from "vitest";
import {
  createAnthropicAdapter,
  createOpenAIAdapter,
  ProviderRequestError,
  UnsupportedContentError,
  type FetchLike,
  type ProviderAdapter,
  type UnifiedRequest,
} from "../../src/ai/task3/task3";
import { expectRejects } from "../support/expect-rejects";

const API_KEY = "sk-secret-key-123456";
const PNG = "iVBORw0KGgo=";

type FakeReply = { status?: number; body?: unknown; headers?: Record<string, string> } | Error;

function fakeFetch(reply: FakeReply) {
  const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: unknown; signal?: AbortSignal }> = [];
  const fetch = vi.fn<FetchLike>(async (url, init) => {
    calls.push({ url, method: init.method, headers: init.headers, body: JSON.parse(init.body), signal: init.signal });
    if (reply instanceof Error) throw reply;
    const headers = Object.fromEntries(Object.entries(reply.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    return {
      status: reply.status ?? 200,
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
      json: async () => reply.body,
      text: async () => JSON.stringify(reply.body),
    };
  });
  return { fetch, calls };
}

const anthropicOk = {
  content: [{ type: "text", text: "A " }, { type: "text", text: "cat." }],
  stop_reason: "end_turn",
  usage: { input_tokens: 1200, output_tokens: 4 },
  model: "claude-x-2026",
};

const openaiOk = {
  choices: [{ message: { role: "assistant", content: "A cat." }, finish_reason: "stop" }],
  usage: { prompt_tokens: 900, completion_tokens: 3 },
  model: "gpt-x-2026",
};

const baseRequest = (overrides: Partial<UnifiedRequest> = {}): UnifiedRequest => ({
  model: "model-a",
  maxTokens: 300,
  messages: [{ role: "user", content: "Hello" }],
  ...overrides,
});

const adapters: Array<[string, (fetch: FetchLike) => ProviderAdapter, unknown]> = [
  ["anthropic", (fetch) => createAnthropicAdapter({ apiKey: API_KEY, fetch }), anthropicOk],
  ["openai", (fetch) => createOpenAIAdapter({ apiKey: API_KEY, fetch }), openaiOk],
];

describe("AI-003", () => {
  describe("Anthropic request translation", () => {
    it("sends the request to the Messages API with the required headers", async () => {
      const { fetch, calls } = fakeFetch({ body: anthropicOk });
      await createAnthropicAdapter({ apiKey: API_KEY, fetch }).complete(baseRequest());
      expect(calls).toHaveLength(1);
      expect(calls[0]!.url).toBe("https://api.anthropic.com/v1/messages");
      expect(calls[0]!.method).toBe("POST");
      const headers = Object.fromEntries(Object.entries(calls[0]!.headers).map(([k, v]) => [k.toLowerCase(), v]));
      expect(headers).toMatchObject({
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      });
    });

    it("uses a custom base URL", async () => {
      const { fetch, calls } = fakeFetch({ body: anthropicOk });
      await createAnthropicAdapter({ apiKey: API_KEY, fetch, baseUrl: "https://proxy.internal" }).complete(baseRequest());
      expect(calls[0]!.url).toBe("https://proxy.internal/v1/messages");
    });

    it("moves system messages into the system field and converts image parts", async () => {
      const { fetch, calls } = fakeFetch({ body: anthropicOk });
      await createAnthropicAdapter({ apiKey: API_KEY, fetch }).complete(
        baseRequest({
          model: "claude-x",
          messages: [
            { role: "system", content: "You describe images." },
            { role: "system", content: "Be brief." },
            {
              role: "user",
              content: [
                { type: "text", text: "What is in this picture?" },
                { type: "image", mediaType: "image/png", data: PNG },
              ],
            },
            { role: "assistant", content: "Let me look." },
          ],
        }),
      );
      expect(calls[0]!.body).toEqual({
        model: "claude-x",
        max_tokens: 300,
        system: "You describe images.\n\nBe brief.",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What is in this picture?" },
              { type: "image", source: { type: "base64", media_type: "image/png", data: PNG } },
            ],
          },
          { role: "assistant", content: "Let me look." },
        ],
      });
    });

    it("includes temperature and stop sequences only when provided", async () => {
      const { fetch, calls } = fakeFetch({ body: anthropicOk });
      const adapter = createAnthropicAdapter({ apiKey: API_KEY, fetch });
      await adapter.complete(baseRequest());
      expect(calls[0]!.body).toEqual({ model: "model-a", max_tokens: 300, messages: [{ role: "user", content: "Hello" }] });

      await adapter.complete(baseRequest({ temperature: 0, stopSequences: ["END"] }));
      expect(calls[1]!.body).toMatchObject({ temperature: 0, stop_sequences: ["END"] });

      await adapter.complete(baseRequest({ stopSequences: [] }));
      expect(calls[2]!.body).not.toHaveProperty("stop_sequences");
    });
  });

  describe("Anthropic response translation", () => {
    it("joins text blocks and normalizes usage, model and provider", async () => {
      const { fetch } = fakeFetch({
        body: { ...anthropicOk, content: [{ type: "text", text: "A " }, { type: "tool_use", id: "x" }, { type: "text", text: "cat." }] },
      });
      const res = await createAnthropicAdapter({ apiKey: API_KEY, fetch }).complete(baseRequest());
      expect(res).toEqual({
        text: "A cat.",
        stopReason: "end",
        usage: { inputTokens: 1200, outputTokens: 4 },
        provider: "anthropic",
        model: "claude-x-2026",
      });
    });

    it.each([
      ["end_turn", "end"],
      ["max_tokens", "max_tokens"],
      ["stop_sequence", "stop_sequence"],
      ["refusal", "end"],
    ])("maps stop_reason %s to %s", async (stop, expected) => {
      const { fetch } = fakeFetch({ body: { ...anthropicOk, stop_reason: stop } });
      expect((await createAnthropicAdapter({ apiKey: API_KEY, fetch }).complete(baseRequest())).stopReason).toBe(expected);
    });
  });

  describe("OpenAI request translation", () => {
    it("sends the request to Chat Completions with a bearer token", async () => {
      const { fetch, calls } = fakeFetch({ body: openaiOk });
      await createOpenAIAdapter({ apiKey: API_KEY, fetch }).complete(baseRequest());
      expect(calls[0]!.url).toBe("https://api.openai.com/v1/chat/completions");
      const headers = Object.fromEntries(Object.entries(calls[0]!.headers).map(([k, v]) => [k.toLowerCase(), v]));
      expect(headers).toMatchObject({ authorization: `Bearer ${API_KEY}`, "content-type": "application/json" });
    });

    it("keeps system messages in place and converts images to data URLs", async () => {
      const { fetch, calls } = fakeFetch({ body: openaiOk });
      await createOpenAIAdapter({ apiKey: API_KEY, fetch, baseUrl: "https://oai.proxy" }).complete(
        baseRequest({
          model: "gpt-x",
          temperature: 0.3,
          stopSequences: ["###"],
          messages: [
            { role: "system", content: "You describe images." },
            {
              role: "user",
              content: [
                { type: "text", text: "Describe" },
                { type: "image", mediaType: "image/jpeg", data: PNG },
              ],
            },
          ],
        }),
      );
      expect(calls[0]!.url).toBe("https://oai.proxy/v1/chat/completions");
      expect(calls[0]!.body).toEqual({
        model: "gpt-x",
        max_completion_tokens: 300,
        temperature: 0.3,
        stop: ["###"],
        messages: [
          { role: "system", content: "You describe images." },
          {
            role: "user",
            content: [
              { type: "text", text: "Describe" },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${PNG}` } },
            ],
          },
        ],
      });
    });

    it("omits optional fields when not provided", async () => {
      const { fetch, calls } = fakeFetch({ body: openaiOk });
      await createOpenAIAdapter({ apiKey: API_KEY, fetch }).complete(baseRequest({ stopSequences: [] }));
      expect(calls[0]!.body).toEqual({ model: "model-a", max_completion_tokens: 300, messages: [{ role: "user", content: "Hello" }] });
    });
  });

  describe("OpenAI response translation", () => {
    it("normalizes the response", async () => {
      const { fetch } = fakeFetch({ body: openaiOk });
      expect(await createOpenAIAdapter({ apiKey: API_KEY, fetch }).complete(baseRequest())).toEqual({
        text: "A cat.",
        stopReason: "end",
        usage: { inputTokens: 900, outputTokens: 3 },
        provider: "openai",
        model: "gpt-x-2026",
      });
    });

    it("maps length to max_tokens and null content to an empty string", async () => {
      const { fetch } = fakeFetch({
        body: { ...openaiOk, choices: [{ message: { role: "assistant", content: null }, finish_reason: "length" }] },
      });
      const res = await createOpenAIAdapter({ apiKey: API_KEY, fetch }).complete(baseRequest());
      expect(res.stopReason).toBe("max_tokens");
      expect(res.text).toBe("");
    });
  });

  describe.each(adapters)("Validation (%s)", (_name, make) => {
    it.each([
      ["no messages", baseRequest({ messages: [] }), RangeError],
      ["maxTokens 0", baseRequest({ maxTokens: 0 }), RangeError],
      ["maxTokens 1.5", baseRequest({ maxTokens: 1.5 }), RangeError],
      [
        "unsupported media type",
        baseRequest({ messages: [{ role: "user", content: [{ type: "image", mediaType: "image/bmp" as never, data: PNG }] }] }),
        UnsupportedContentError,
      ],
      [
        "image in an assistant message",
        baseRequest({ messages: [{ role: "assistant", content: [{ type: "image", mediaType: "image/png", data: PNG }] }] }),
        UnsupportedContentError,
      ],
      [
        "parts in a system message",
        baseRequest({ messages: [{ role: "system", content: [{ type: "text", text: "x" }] }, { role: "user", content: "Hi" }] }),
        UnsupportedContentError,
      ],
    ])("rejects %s before calling fetch", async (_label, request, type) => {
      const { fetch } = fakeFetch({ body: {} });
      await expectRejects(make(fetch).complete(request), type as unknown as typeof Error);
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe.each(adapters)("Errors (%s)", (name, make, okBody) => {
    it("throws ProviderRequestError with the provider's error message", async () => {
      const { fetch } = fakeFetch({ status: 400, body: { error: { type: "invalid_request_error", message: "max_tokens too large" } } });
      const error = await expectRejects(make(fetch).complete(baseRequest()), ProviderRequestError);
      expect(error.status).toBe(400);
      expect(error.provider).toBe(name);
      expect(error.message).toContain("max_tokens too large");
      expect(error.retryAfterMs).toBeUndefined();
    });

    it("parses retry-after seconds", async () => {
      const { fetch } = fakeFetch({ status: 429, body: { error: { message: "slow down" } }, headers: { "Retry-After": "1.5" } });
      expect((await expectRejects(make(fetch).complete(baseRequest()), ProviderRequestError)).retryAfterMs).toBe(1500);
    });

    it("handles an error response without a JSON error body", async () => {
      const { fetch } = fakeFetch({ status: 500, body: "Internal Server Error" });
      expect((await expectRejects(make(fetch).complete(baseRequest()), ProviderRequestError)).status).toBe(500);
    });

    it("throws status 502 for a malformed success body", async () => {
      const { fetch } = fakeFetch({ status: 200, body: { unexpected: true } });
      expect((await expectRejects(make(fetch).complete(baseRequest()), ProviderRequestError)).status).toBe(502);
    });

    it("throws status 0 for network failures", async () => {
      const { fetch } = fakeFetch(new TypeError("fetch failed"));
      expect((await expectRejects(make(fetch).complete(baseRequest()), ProviderRequestError)).status).toBe(0);
    });

    it("passes the signal to fetch and rethrows abort errors unchanged", async () => {
      const controller = new AbortController();
      const abortError = new DOMException("The operation was aborted", "AbortError");
      const { fetch, calls } = fakeFetch({ body: okBody });
      fetch.mockImplementationOnce(async (url, init) => {
        calls.push({ url, method: init.method, headers: init.headers, body: JSON.parse(init.body), signal: init.signal });
        controller.abort();
        throw abortError;
      });
      let caught: unknown;
      try {
        await make(fetch).complete(baseRequest(), { signal: controller.signal });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBe(abortError);
      expect(calls[0]!.signal).toBe(controller.signal);
    });

    it("never includes the API key in error messages", async () => {
      const replies: FakeReply[] = [
        { status: 401, body: { error: { message: `Invalid key ${API_KEY}`.replace(API_KEY, "provided") } } },
        { status: 200, body: null },
        new TypeError(`connect ECONNREFUSED (key=${API_KEY})`),
      ];
      for (const reply of replies) {
        const { fetch } = fakeFetch(reply);
        const error = await expectRejects(make(fetch).complete(baseRequest()), ProviderRequestError);
        expect(error.message).not.toContain(API_KEY);
      }
    });
  });
});
