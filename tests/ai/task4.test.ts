import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createStreamingApp, parseAnthropicStream, StreamError, type StreamEvent, type StreamSource } from "../../src/ai/task4/task4";
import { expectRejects } from "../support/expect-rejects";

const enc = new TextEncoder();

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const happyStream =
  sse("message_start", { type: "message_start", message: { usage: { input_tokens: 25, output_tokens: 1 } } }) +
  sse("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }) +
  sse("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } }) +
  sse("ping", { type: "ping" }) +
  sse("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "lo ✓ 🚀" } }) +
  sse("content_block_stop", { type: "content_block_stop", index: 0 }) +
  sse("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } }) +
  sse("message_stop", { type: "message_stop" });

const expectedEvents: StreamEvent[] = [
  { type: "text", text: "Hel" },
  { type: "text", text: "lo ✓ 🚀" },
  { type: "done", stopReason: "end", usage: { inputTokens: 25, outputTokens: 2 } },
];

async function* chunksOf(bytes: Uint8Array, size: number) {
  for (let i = 0; i < bytes.length; i += size) yield bytes.slice(i, i + size);
}

async function collect(iterable: AsyncIterable<StreamEvent>) {
  const out: StreamEvent[] = [];
  for await (const e of iterable) out.push(e);
  return out;
}

describe("AI-004", () => {
  describe("parseAnthropicStream", () => {
    it("parses a complete stream", async () => {
      expect(await collect(parseAnthropicStream([happyStream] as unknown as AsyncIterable<string>))).toEqual(expectedEvents);
    });

    it.each([1, 2, 3, 7, 64])("handles byte chunks of size %i, including split UTF-8 characters", async (size) => {
      expect(await collect(parseAnthropicStream(chunksOf(enc.encode(happyStream), size)))).toEqual(expectedEvents);
    });

    it.each([
      ["max_tokens", "max_tokens"],
      ["stop_sequence", "stop_sequence"],
      ["tool_use", "end"],
    ])("maps stop_reason %s to %s", async (stop, expected) => {
      const stream = sse("message_delta", { type: "message_delta", delta: { stop_reason: stop }, usage: { output_tokens: 9 } }) + sse("message_stop", {});
      const events = await collect(parseAnthropicStream([stream] as unknown as AsyncIterable<string>));
      expect(events.at(-1)).toEqual({ type: "done", stopReason: expected, usage: { inputTokens: 0, outputTokens: 9 } });
    });

    it("skips empty text deltas and ignores events after message_stop", async () => {
      const stream =
        sse("content_block_delta", { delta: { type: "text_delta", text: "" } }) +
        sse("content_block_delta", { delta: { type: "input_json_delta", partial_json: "{}" } }) +
        sse("message_stop", {}) +
        sse("content_block_delta", { delta: { type: "text_delta", text: "late" } });
      expect(await collect(parseAnthropicStream([stream] as unknown as AsyncIterable<string>))).toEqual([
        { type: "done", stopReason: "end", usage: { inputTokens: 0, outputTokens: 0 } },
      ]);
    });

    it("yields events before the stream has finished", async () => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      async function* slow() {
        yield sse("content_block_delta", { delta: { type: "text_delta", text: "first" } });
        await gate;
        yield sse("message_stop", {});
      }
      const iterator = parseAnthropicStream(slow())[Symbol.asyncIterator]();
      const first = await Promise.race([iterator.next(), new Promise((r) => setTimeout(() => r("timeout"), 500))]);
      expect(first).toEqual({ value: { type: "text", text: "first" }, done: false });
      release();
      expect((await iterator.next()).value).toMatchObject({ type: "done" });
    });

    it("throws StreamError for provider error events", async () => {
      const stream = sse("content_block_delta", { delta: { type: "text_delta", text: "a" } }) + sse("error", { type: "error", error: { type: "overloaded_error", message: "Overloaded" } });
      const error = await expectRejects(collect(parseAnthropicStream([stream] as unknown as AsyncIterable<string>)), StreamError);
      expect(error.message).toContain("Overloaded");
    });

    it("throws StreamError for invalid JSON", async () => {
      await expectRejects(collect(parseAnthropicStream(["event: content_block_delta\ndata: {nope\n\n"] as unknown as AsyncIterable<string>)), StreamError);
    });

    it("throws StreamError when the stream ends before message_stop", async () => {
      const truncated = happyStream.slice(0, happyStream.indexOf("event: message_delta"));
      await expectRejects(collect(parseAnthropicStream(chunksOf(enc.encode(truncated), 10))), StreamError);
    });
  });

  describe("createStreamingApp", () => {
    let server: Server | undefined;

    afterEach(async () => {
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
      server = undefined;
    });

    async function start(source: StreamSource) {
      server = createServer(createStreamingApp({ source }));
      await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
      const { port } = server.address() as AddressInfo;
      return `http://127.0.0.1:${port}`;
    }

    const post = (url: string, body: unknown, signal?: AbortSignal) =>
      fetch(`${url}/chat/stream`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });

    function sourceOf(events: Array<StreamEvent | Error>, record: { prompt?: string; signal?: AbortSignal; finished?: boolean } = {}): StreamSource {
      return {
        async start(prompt, signal) {
          record.prompt = prompt;
          record.signal = signal;
          return (async function* () {
            try {
              for (const e of events) {
                if (e instanceof Error) throw e;
                yield e;
              }
            } finally {
              record.finished = true;
            }
          })();
        },
      };
    }

    function parseSse(text: string) {
      return text
        .split("\n\n")
        .filter((block) => block.trim())
        .map((block) => {
          const lines = block.split("\n");
          return {
            event: lines.find((l) => l.startsWith("event: "))?.slice(7),
            data: JSON.parse(lines.find((l) => l.startsWith("data: "))!.slice(6)),
          };
        });
    }

    it("streams tokens and a done event with SSE headers", async () => {
      const record: { prompt?: string } = {};
      const url = await start(sourceOf(expectedEvents, record));
      const res = await post(url, { prompt: "  Say hello  " });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/^text\/event-stream/);
      expect(res.headers.get("cache-control")).toContain("no-cache");
      const text = await res.text();
      expect(text).toContain('event: token\ndata: {"text":"Hel"}\n\n');
      expect(parseSse(text)).toEqual([
        { event: "token", data: { text: "Hel" } },
        { event: "token", data: { text: "lo ✓ 🚀" } },
        { event: "done", data: { stopReason: "end", usage: { inputTokens: 25, outputTokens: 2 } } },
      ]);
      expect(record.prompt).toBe("Say hello");
    });

    it("flushes each token immediately", async () => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const source: StreamSource = {
        async start() {
          return (async function* () {
            yield { type: "text" as const, text: "early" };
            await gate;
            yield { type: "done" as const, stopReason: "end" as const, usage: { inputTokens: 1, outputTokens: 1 } };
          })();
        },
      };
      const url = await start(source);
      const res = await post(url, { prompt: "hi" });
      const reader = res.body!.getReader();
      const first = await Promise.race([reader.read(), new Promise<"timeout">((r) => setTimeout(() => r("timeout"), 1000))]);
      expect(first).not.toBe("timeout");
      expect(new TextDecoder().decode((first as { value?: Uint8Array }).value)).toContain("early");
      release();
      while (!(await reader.read()).done);
    });

    it.each([[{}], [{ prompt: "" }], [{ prompt: "   " }], [{ prompt: 42 }], [{ prompt: "x".repeat(4001) }]])(
      "responds 400 for invalid body %j without starting a stream",
      async (body) => {
        const record: { prompt?: string } = {};
        const url = await start(sourceOf(expectedEvents, record));
        const res = await post(url, body);
        expect(res.status).toBe(400);
        expect(((await res.json()) as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
        expect(record.prompt).toBeUndefined();
      },
    );

    it("responds 502 JSON when the upstream stream cannot be started", async () => {
      const url = await start({ start: async () => Promise.reject(new Error("upstream 503 secret-host")) });
      const res = await post(url, { prompt: "hi" });
      expect(res.status).toBe(502);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      const text = await res.text();
      expect(JSON.parse(text).error.code).toBe("UPSTREAM_ERROR");
      expect(text).not.toContain("secret-host");
    });

    it("sends an error event without details when the upstream fails mid-stream", async () => {
      const url = await start(sourceOf([{ type: "text", text: "partial" }, new Error("socket hang up at 10.0.0.7")]));
      const res = await post(url, { prompt: "hi" });
      const text = await res.text();
      expect(parseSse(text)).toEqual([
        { event: "token", data: { text: "partial" } },
        { event: "error", data: { code: "STREAM_ERROR", message: "The response stream failed." } },
      ]);
      expect(text).not.toContain("10.0.0.7");
    });

    it("sends an error event when the upstream ends without a done event", async () => {
      const url = await start(sourceOf([{ type: "text", text: "partial" }]));
      const events = parseSse(await (await post(url, { prompt: "hi" })).text());
      expect(events.at(-1)).toEqual({ event: "error", data: { code: "STREAM_ERROR", message: "The response stream failed." } });
    });

    it("aborts the upstream and stops iterating when the client disconnects", async () => {
      const record: { signal?: AbortSignal; finished?: boolean } = {};
      const source: StreamSource = {
        async start(_prompt, signal) {
          record.signal = signal;
          return (async function* () {
            try {
              for (let i = 0; ; i++) {
                yield { type: "text" as const, text: `t${i} ` };
                await new Promise((r) => setTimeout(r, 20));
              }
            } finally {
              record.finished = true;
            }
          })();
        },
      };
      const url = await start(source);
      const controller = new AbortController();
      const res = await post(url, { prompt: "hi" }, controller.signal);
      const reader = res.body!.getReader();
      await reader.read();
      controller.abort();
      await reader.cancel().catch(() => {});

      const deadline = Date.now() + 2000;
      while (!(record.signal?.aborted && record.finished) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
      expect(record.signal?.aborted).toBe(true);
      expect(record.finished).toBe(true);
    });
  });
});
