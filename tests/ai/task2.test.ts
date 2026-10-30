import { afterEach, describe, expect, it, vi } from "vitest";
import { LLMProviderError, type CompletionRequest, type CompletionResponse } from "../../src/ai/shared/llm";
import {
  createResilientClient,
  LLMTimeoutError,
  RequestAbortedError,
  RetryExhaustedError,
  type RetryInfo,
} from "../../src/ai/task2/task2";
import { hangUntilAborted, reply, scriptedLLM } from "../support/mock-llm";

const request = (overrides: Partial<CompletionRequest> = {}): CompletionRequest => ({
  model: "test-model",
  messages: [
    { role: "system", content: "You are helpful." },
    { role: "user", content: "Hello" },
  ],
  maxTokens: 256,
  temperature: 0.2,
  ...overrides,
});

const instantSleep = () => vi.fn(async (_ms: number) => {});
const never = () => new Promise<CompletionResponse>(() => {});
const providerError = (status: number, retryAfterMs?: number) => new LLMProviderError(`HTTP ${status}`, status, retryAfterMs);

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to reject, but it resolved");
}

/** Resolves to "settled" if the promise settles within `ms`, otherwise to "pending". */
async function settlesWithin(promise: Promise<unknown>, ms: number): Promise<"settled" | "pending"> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = new Promise<"pending">((resolve) => {
    timer = setTimeout(() => resolve("pending"), ms);
  });
  const result = await Promise.race([promise.then(() => "settled" as const, () => "settled" as const), pending]);
  clearTimeout(timer);
  return result;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AI-002", () => {
  describe("Configuration", () => {
    it("creates a client with default options", () => {
      const { llm } = scriptedLLM(reply("ok"));
      const client = createResilientClient(llm);
      expect(typeof client.complete).toBe("function");
    });

  });

  describe("Attempts", () => {
    it("returns a successful response unchanged after one call", async () => {
      const response = reply("Hi there", { usage: { inputTokens: 12, outputTokens: 3 } });
      const { llm, complete } = scriptedLLM(response);
      const client = createResilientClient(llm, { sleep: instantSleep() });
      expect(await client.complete(request())).toEqual(response);
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it("passes request fields through and replaces the signal with its own", async () => {
      const { llm, calls, signals } = scriptedLLM(reply("ok"));
      const controller = new AbortController();
      const client = createResilientClient(llm, { sleep: instantSleep() });
      await client.complete(request({ signal: controller.signal }));

      const { signal: _ignored, ...forwarded } = calls[0]!;
      const { signal: _callerSignal, ...expected } = request();
      expect(forwarded).toEqual(expected);
      expect(signals[0]).toBeInstanceOf(AbortSignal);
      expect(signals[0]).not.toBe(controller.signal);
    });

    it("provides a signal even when the caller passes none", async () => {
      const { llm, signals } = scriptedLLM(reply("ok"));
      await createResilientClient(llm, { sleep: instantSleep() }).complete(request());
      expect(signals[0]).toBeInstanceOf(AbortSignal);
      expect(signals[0]!.aborted).toBe(false);
    });

    it("gives every attempt a different signal", async () => {
      const { llm, signals } = scriptedLLM(providerError(503), providerError(503), reply("ok"));
      await createResilientClient(llm, { sleep: instantSleep() }).complete(request());
      expect(signals).toHaveLength(3);
      expect(new Set(signals).size).toBe(3);
    });
  });

  describe("Retries", () => {
    it.each([408, 429, 500, 502, 503, 504, 529])("retries provider status %i", async (status) => {
      const { llm, complete } = scriptedLLM(providerError(status), reply("recovered"));
      const client = createResilientClient(llm, { sleep: instantSleep() });
      expect((await client.complete(request())).text).toBe("recovered");
      expect(complete).toHaveBeenCalledTimes(2);
    });

    it.each([400, 401, 403, 404, 422])("rethrows provider status %i immediately", async (status) => {
      const error = providerError(status);
      const sleep = instantSleep();
      const { llm, complete } = scriptedLLM(error, reply("never"));
      const client = createResilientClient(llm, { sleep });
      expect(await caught(client.complete(request()))).toBe(error);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it("rethrows non-provider errors immediately", async () => {
      const bug = new TypeError("Cannot read properties of undefined");
      const { llm, complete } = scriptedLLM(bug, reply("never"));
      const client = createResilientClient(llm, { sleep: instantSleep() });
      expect(await caught(client.complete(request()))).toBe(bug);
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it("waits using exponential backoff with a cap", async () => {
      const sleep = instantSleep();
      const { llm } = scriptedLLM(providerError(500));
      const client = createResilientClient(llm, { maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 300, random: () => 0, sleep });
      await caught(client.complete(request()));
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([50, 100, 150, 150]);
    });

    it("applies jitter to the upper half of the delay", async () => {
      for (const [random, expected] of [
        [0.5, [75, 150]],
        [0.999, [99, 199]],
      ] as const) {
        const sleep = instantSleep();
        const { llm } = scriptedLLM(providerError(503));
        const client = createResilientClient(llm, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 10_000, random: () => random, sleep });
        await caught(client.complete(request()));
        expect(sleep.mock.calls.map(([ms]) => ms)).toEqual(expected);
      }
    });

    it("calls onRetry before each wait with the attempt, delay and error", async () => {
      const first = providerError(503);
      const second = providerError(502);
      const order: string[] = [];
      const infos: RetryInfo[] = [];
      const sleep = vi.fn(async (ms: number) => {
        order.push(`sleep:${ms}`);
      });
      const { llm } = scriptedLLM(first, second, reply("ok"));
      const client = createResilientClient(llm, {
        baseDelayMs: 200,
        maxDelayMs: 1000,
        random: () => 0,
        sleep,
        onRetry: (info) => {
          infos.push(info);
          order.push(`retry:${info.attempt}`);
        },
      });
      await client.complete(request());
      expect(infos).toEqual([
        { attempt: 1, delayMs: 100, error: first },
        { attempt: 2, delayMs: 200, error: second },
      ]);
      expect(order).toEqual(["retry:1", "sleep:100", "retry:2", "sleep:200"]);
    });

    it("waits exactly retryAfterMs when it is within maxDelayMs", async () => {
      const sleep = instantSleep();
      const { llm } = scriptedLLM(providerError(429, 750), providerError(429, 0), reply("ok"));
      const client = createResilientClient(llm, { baseDelayMs: 100, maxDelayMs: 1000, random: () => 0, sleep });
      await client.complete(request());
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([750, 0]);
    });

    it("rethrows immediately when retryAfterMs exceeds maxDelayMs", async () => {
      const error = providerError(429, 60_000);
      const sleep = instantSleep();
      const onRetry = vi.fn();
      const { llm, complete } = scriptedLLM(error, reply("never"));
      const client = createResilientClient(llm, { maxDelayMs: 8000, sleep, onRetry });
      expect(await caught(client.complete(request()))).toBe(error);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
      expect(onRetry).not.toHaveBeenCalled();
    });

    it("throws RetryExhaustedError with the last error after maxAttempts", async () => {
      const errors = [providerError(500), providerError(502), providerError(503)];
      const sleep = instantSleep();
      const { llm, complete } = scriptedLLM(...errors, reply("too late"));
      const client = createResilientClient(llm, { maxAttempts: 3, sleep });
      const error = await caught(client.complete(request()));
      expect(error).toBeInstanceOf(RetryExhaustedError);
      expect((error as RetryExhaustedError).attempts).toBe(3);
      expect((error as RetryExhaustedError).lastError).toBe(errors[2]);
      expect(complete).toHaveBeenCalledTimes(3);
      expect(sleep).toHaveBeenCalledTimes(2);
    });

    it("does not retry when maxAttempts is 1", async () => {
      const sleep = instantSleep();
      const { llm, complete } = scriptedLLM(providerError(503), reply("never"));
      const client = createResilientClient(llm, { maxAttempts: 1, sleep });
      const error = await caught(client.complete(request()));
      expect(error).toBeInstanceOf(RetryExhaustedError);
      expect((error as RetryExhaustedError).attempts).toBe(1);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    });

    it("uses a real delay when no sleep function is provided", async () => {
      const { llm, complete } = scriptedLLM(providerError(503), reply("ok"));
      const client = createResilientClient(llm, { baseDelayMs: 10, maxDelayMs: 10, random: () => 0 });
      expect((await client.complete(request())).text).toBe("ok");
      expect(complete).toHaveBeenCalledTimes(2);
    });
  });

  describe("Timeouts", () => {
    it("aborts a hung attempt, reports LLMTimeoutError and retries", async () => {
      const infos: RetryInfo[] = [];
      const { llm, signals } = scriptedLLM(hangUntilAborted(), reply("second try"));
      const client = createResilientClient(llm, { timeoutMs: 30, sleep: instantSleep(), onRetry: (i) => infos.push(i) });
      const response = await client.complete(request());
      expect(response.text).toBe("second try");
      expect(signals[0]!.aborted).toBe(true);
      expect(infos).toHaveLength(1);
      expect(infos[0]!.error).toBeInstanceOf(LLMTimeoutError);
      expect((infos[0]!.error as LLMTimeoutError).timeoutMs).toBe(30);
    });

    it("times out even if the inner client ignores the abort signal", async () => {
      const { llm, complete } = scriptedLLM(never);
      const client = createResilientClient(llm, { timeoutMs: 25, maxAttempts: 2, sleep: instantSleep() });
      const error = await caught(client.complete(request()));
      expect(error).toBeInstanceOf(RetryExhaustedError);
      expect((error as RetryExhaustedError).lastError).toBeInstanceOf(LLMTimeoutError);
      expect(complete).toHaveBeenCalledTimes(2);
    });

    it("ignores a result that arrives after its attempt timed out", async () => {
      const late = () => new Promise<CompletionResponse>((resolve) => setTimeout(() => resolve(reply("late")), 80));
      const { llm } = scriptedLLM(late, reply("fresh"));
      const client = createResilientClient(llm, { timeoutMs: 30, sleep: instantSleep() });
      expect((await client.complete(request())).text).toBe("fresh");
    });

  });

  describe("Cancellation", () => {
    it("rejects without calling the inner client when the signal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();
      const { llm, complete } = scriptedLLM(reply("never"));
      const client = createResilientClient(llm, { sleep: instantSleep() });
      expect(await caught(client.complete(request({ signal: controller.signal })))).toBeInstanceOf(RequestAbortedError);
      expect(complete).not.toHaveBeenCalled();
    });

    it("rejects immediately when the caller aborts during an attempt", async () => {
      const controller = new AbortController();
      const { llm, complete, signals } = scriptedLLM(never, reply("never"));
      const client = createResilientClient(llm, { timeoutMs: 5000, sleep: instantSleep() });
      const promise = client.complete(request({ signal: controller.signal }));
      promise.catch(() => {});
      setTimeout(() => controller.abort(), 10);

      expect(await settlesWithin(promise, 1000)).toBe("settled");
      expect(await caught(promise)).toBeInstanceOf(RequestAbortedError);
      expect(signals[0]!.aborted).toBe(true);
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it("does not retry when the inner client rejects because of the caller's abort", async () => {
      const controller = new AbortController();
      const onRetry = vi.fn();
      const { llm, complete } = scriptedLLM(hangUntilAborted(), reply("never"));
      const client = createResilientClient(llm, { timeoutMs: 5000, sleep: instantSleep(), onRetry });
      const promise = client.complete(request({ signal: controller.signal }));
      setTimeout(() => controller.abort(), 10);
      expect(await caught(promise)).toBeInstanceOf(RequestAbortedError);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(onRetry).not.toHaveBeenCalled();
    });

    it("rejects immediately when the caller aborts during a backoff wait", async () => {
      const controller = new AbortController();
      const onRetry = vi.fn();
      const sleep = vi.fn((_ms: number) => {
        setTimeout(() => controller.abort(), 10);
        return new Promise<void>(() => {});
      });
      const { llm, complete } = scriptedLLM(providerError(503), reply("never"));
      const client = createResilientClient(llm, { sleep, onRetry });
      const promise = client.complete(request({ signal: controller.signal }));
      promise.catch(() => {});

      expect(await settlesWithin(promise, 1000)).toBe("settled");
      expect(await caught(promise)).toBeInstanceOf(RequestAbortedError);
      expect(complete).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});
