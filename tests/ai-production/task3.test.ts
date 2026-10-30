import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { CompletionRequest, CompletionResponse } from "../../src/ai/shared/llm";
import { cacheKey, createCachedClient, type CacheEntry, type CacheStore } from "../../src/ai-production/task3/task3";
import { reply, scriptedLLM } from "../support/mock-llm";

class MemoryStore implements CacheStore {
  readonly data = new Map<string, CacheEntry>();
  readonly get = vi.fn(async (key: string) => this.data.get(key));
  readonly set = vi.fn(async (key: string, entry: CacheEntry) => void this.data.set(key, entry));
  readonly delete = vi.fn(async (key: string) => void this.data.delete(key));
}

const req = (content = "How do I reset my password?", overrides: Partial<CompletionRequest> = {}): CompletionRequest => ({
  model: "faq-model",
  maxTokens: 200,
  temperature: 0,
  messages: [
    { role: "system", content: "You answer FAQ questions." },
    { role: "user", content },
  ],
  ...overrides,
});

const VECTORS: Record<string, number[]> = {
  "How do I reset my password?": [1, 0, 0],
  "how can I reset my password": [0.95, 0.31, 0],
  "How do I delete my account?": [0, 1, 0],
  "Password reset steps please": [0.8, 0.6, 0],
};

function setup(opts: { steps?: Parameters<typeof scriptedLLM>; semantic?: { threshold: number; maxEntries: number }; ttlMs?: number } = {}) {
  let now = 1_000;
  const store = new MemoryStore();
  const model = scriptedLLM(...(opts.steps ?? [reply("Go to Settings → Security.")]));
  const embedder = { dimensions: 3, embed: vi.fn(async (texts: string[]) => texts.map((t) => VECTORS[t] ?? [0, 0, 1])) };
  const cached = createCachedClient(model.llm, {
    store,
    ttlMs: opts.ttlMs ?? 60_000,
    promptVersion: "faq-v3",
    now: () => now,
    ...(opts.semantic ? { semantic: { embedder, ...opts.semantic } } : {}),
  });
  return { cached, store, model, embedder, advance: (ms: number) => (now += ms), now: () => now };
}

const acme = { tenantId: "acme" };

describe("AIOPS-003", () => {
  describe("cacheKey", () => {
    it("hashes prompt version, tenant, model, parameters and messages", () => {
      const r = req();
      const expected = createHash("sha256")
        .update(JSON.stringify(["faq-v3", "acme", "faq-model", 200, 0, r.messages.map((m) => [m.role, m.content])]))
        .digest("hex");
      expect(cacheKey(r, { tenantId: "acme", promptVersion: "faq-v3" })).toBe(expected);
    });

    it("changes with every component", () => {
      const base = cacheKey(req(), { tenantId: "acme", promptVersion: "v1" });
      const variants = [
        cacheKey(req(), { tenantId: "globex", promptVersion: "v1" }),
        cacheKey(req(), { tenantId: "acme", promptVersion: "v2" }),
        cacheKey(req(undefined, { model: "other" }), { tenantId: "acme", promptVersion: "v1" }),
        cacheKey(req(undefined, { maxTokens: 201 }), { tenantId: "acme", promptVersion: "v1" }),
        cacheKey(req("How do I reset my password? "), { tenantId: "acme", promptVersion: "v1" }),
      ];
      expect(new Set([base, ...variants]).size).toBe(6);
    });
  });

  describe("Exact cache", () => {
    it("misses, stores and then hits", async () => {
      const { cached, store, model, now } = setup();
      const first = await cached.complete(req(), acme);
      expect(first).toMatchObject({ text: "Go to Settings → Security.", cache: "miss" });
      const key = cacheKey(req(), { tenantId: "acme", promptVersion: "faq-v3" });
      expect(store.data.get(key)).toMatchObject({ storedAt: now(), expiresAt: now() + 60_000, response: { text: "Go to Settings → Security." } });
      expect(store.data.get(key)!.response).not.toHaveProperty("cache");

      const second = await cached.complete(req(), acme);
      expect(second).toEqual({ ...first, cache: "hit" });
      expect(model.complete).toHaveBeenCalledTimes(1);
    });

    it("never shares cached answers between tenants or prompt versions", async () => {
      const { cached, model } = setup();
      await cached.complete(req(), acme);
      expect((await cached.complete(req(), { tenantId: "globex" })).cache).toBe("miss");
      expect(model.complete).toHaveBeenCalledTimes(2);
    });

    it("expires entries after the TTL and deletes them", async () => {
      const { cached, store, model, advance } = setup({ ttlMs: 1000 });
      await cached.complete(req(), acme);
      advance(999);
      expect((await cached.complete(req(), acme)).cache).toBe("hit");
      advance(1);
      expect((await cached.complete(req(), acme)).cache).toBe("miss");
      expect(store.delete).toHaveBeenCalledWith(cacheKey(req(), { tenantId: "acme", promptVersion: "faq-v3" }));
      expect(model.complete).toHaveBeenCalledTimes(2);
    });

    it("bypasses non-deterministic requests and bypass mode without touching the store", async () => {
      const { cached, store, model } = setup();
      expect((await cached.complete(req(undefined, { temperature: 0.7 }), acme)).cache).toBe("bypass");
      expect((await cached.complete(req(undefined, { temperature: undefined }), acme)).cache).toBe("bypass");
      expect((await cached.complete(req(), { tenantId: "acme", mode: "bypass" })).cache).toBe("bypass");
      expect(store.get).not.toHaveBeenCalled();
      expect(store.set).not.toHaveBeenCalled();
      expect(model.complete).toHaveBeenCalledTimes(3);
    });

    it("refresh mode skips the read but stores the new answer", async () => {
      const { cached, model } = setup({ steps: [reply("old answer"), reply("new answer")] });
      await cached.complete(req(), acme);
      const refreshed = await cached.complete(req(), { tenantId: "acme", mode: "refresh" });
      expect(refreshed).toMatchObject({ text: "new answer", cache: "miss" });
      expect((await cached.complete(req(), acme)).text).toBe("new answer");
      expect(model.complete).toHaveBeenCalledTimes(2);
    });

    it("does not cache truncated responses or errors", async () => {
      const { cached, store, model } = setup({ steps: [reply("cut off", { stopReason: "max_tokens" }), new Error("provider down"), reply("full")] });
      expect((await cached.complete(req(), acme)).cache).toBe("miss");
      await expect(cached.complete(req(), acme)).rejects.toThrow("provider down");
      expect(store.set).not.toHaveBeenCalled();
      expect((await cached.complete(req(), acme)).text).toBe("full");
      expect(model.complete).toHaveBeenCalledTimes(3);
    });

    it("returns copies that cannot corrupt the cache", async () => {
      const { cached } = setup();
      const first = await cached.complete(req(), acme);
      first.text = "tampered";
      first.usage.inputTokens = -1;
      const hit = await cached.complete(req(), acme);
      hit.text = "tampered again";
      expect((await cached.complete(req(), acme))).toMatchObject({ text: "Go to Settings → Security.", usage: { inputTokens: 100 } });
    });
  });

  describe("Single-flight", () => {
    it("coalesces concurrent identical requests into one model call", async () => {
      let release!: (r: CompletionResponse) => void;
      const { cached, model } = setup({ steps: [() => new Promise<CompletionResponse>((r) => (release = r))] });
      const calls = Array.from({ length: 5 }, () => cached.complete(req(), acme));
      calls.forEach((p) => p.catch(() => {}));
      await new Promise((r) => setTimeout(r, 10));
      release(reply("shared"));
      const results = await Promise.all(calls);
      expect(model.complete).toHaveBeenCalledTimes(1);
      expect(results.map((r) => [r.text, r.cache])).toEqual(Array.from({ length: 5 }, () => ["shared", "miss"]));
      results[0]!.text = "mutated";
      expect(results[1]!.text).toBe("shared");
    });

    it("shares failures and retries afterwards", async () => {
      let fail!: (e: Error) => void;
      const { cached, model, store } = setup({ steps: [() => new Promise<CompletionResponse>((_, r) => (fail = r)), reply("recovered")] });
      const calls = Array.from({ length: 3 }, () => cached.complete(req(), acme));
      calls.forEach((p) => p.catch(() => {}));
      await new Promise((r) => setTimeout(r, 10));
      fail(new Error("overloaded"));
      const settled = await Promise.allSettled(calls);
      expect(settled.every((s) => s.status === "rejected" && (s.reason as Error).message === "overloaded")).toBe(true);
      expect(store.set).not.toHaveBeenCalled();
      expect((await cached.complete(req(), acme)).text).toBe("recovered");
      expect(model.complete).toHaveBeenCalledTimes(2);
    });

    it("does not coalesce requests for different keys", async () => {
      const { cached, model } = setup({ steps: [reply("a"), reply("b")] });
      await Promise.all([cached.complete(req(), acme), cached.complete(req(), { tenantId: "globex" })]);
      expect(model.complete).toHaveBeenCalledTimes(2);
    });
  });

  describe("Semantic cache", () => {
    it("serves a semantically similar question from the cache", async () => {
      const { cached, model, embedder } = setup({ semantic: { threshold: 0.9, maxEntries: 100 } });
      await cached.complete(req(), acme);
      const similar = await cached.complete(req("how can I reset my password"), acme);
      expect(similar).toMatchObject({ text: "Go to Settings → Security.", cache: "semantic_hit" });
      expect(model.complete).toHaveBeenCalledTimes(1);
      expect(embedder.embed.mock.calls.map(([t]) => t)).toEqual([["How do I reset my password?"], ["how can I reset my password"]]);
    });

    it("misses below the threshold", async () => {
      const { cached, model } = setup({ semantic: { threshold: 0.9, maxEntries: 100 }, steps: [reply("a"), reply("b")] });
      await cached.complete(req(), acme);
      expect((await cached.complete(req("Password reset steps please"), acme)).cache).toBe("miss");
      expect(model.complete).toHaveBeenCalledTimes(2);
    });

    it("scopes semantic matches by tenant, model and maxTokens", async () => {
      const { cached, model } = setup({ semantic: { threshold: 0.9, maxEntries: 100 }, steps: [reply("x")] });
      await cached.complete(req(), acme);
      expect((await cached.complete(req("how can I reset my password"), { tenantId: "globex" })).cache).toBe("miss");
      expect((await cached.complete(req("how can I reset my password", { model: "other" }), acme)).cache).toBe("miss");
      expect((await cached.complete(req("how can I reset my password", { maxTokens: 50 }), acme)).cache).toBe("miss");
      expect(model.complete).toHaveBeenCalledTimes(4);
    });

    it("ignores semantic matches whose entry has expired", async () => {
      const { cached, advance } = setup({ semantic: { threshold: 0.9, maxEntries: 100 }, ttlMs: 1000, steps: [reply("a"), reply("b")] });
      await cached.complete(req(), acme);
      advance(1000);
      expect((await cached.complete(req("how can I reset my password"), acme)).cache).toBe("miss");
    });

    it("evicts the oldest index entry beyond maxEntries", async () => {
      const { cached } = setup({ semantic: { threshold: 0.9, maxEntries: 1 }, steps: [reply("a"), reply("b"), reply("c")] });
      await cached.complete(req(), acme);
      await cached.complete(req("How do I delete my account?"), acme);
      expect((await cached.complete(req("how can I reset my password"), acme)).cache).toBe("miss");
    });

    it("is not used in refresh or bypass mode", async () => {
      const { cached, model } = setup({ semantic: { threshold: 0.9, maxEntries: 100 }, steps: [reply("a"), reply("b"), reply("c")] });
      await cached.complete(req(), acme);
      expect((await cached.complete(req("how can I reset my password"), { tenantId: "acme", mode: "refresh" })).cache).toBe("miss");
      expect((await cached.complete(req("how can I reset my password"), { tenantId: "acme", mode: "bypass" })).cache).toBe("bypass");
      expect(model.complete).toHaveBeenCalledTimes(3);
    });
  });
});
