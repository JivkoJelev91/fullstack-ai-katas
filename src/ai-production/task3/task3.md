# LLM Response Cache: Exact, Single-Flight and Semantic

**Task ID:** AIOPS-003 · **Level:** 2–3 · **File:** `src/ai-production/task3/task3.ts` · **Tests:** `npm run test:aiops:3`

Put a cache in front of an `LLMClient`. Identical requests are served from the cache, identical requests that run at the same time share one model call, and similar questions can be served by a semantic (embedding) cache.

## What you export

```ts
export function cacheKey(request: CompletionRequest, scope: { tenantId: string; promptVersion: string }): string;

export function createCachedClient(inner: LLMClient, options: {
  store: CacheStore; ttlMs: number; promptVersion: string; now?: () => number;
  semantic?: { embedder: Embedder; threshold: number; maxEntries: number };
}): { complete(request, ctx: { tenantId: string; mode?: "default" | "bypass" | "refresh" }): Promise<CachedResponse> };
// CachedResponse = CompletionResponse + { cache: "hit" | "miss" | "bypass" | "semantic_hit" }
```

`store` has `get(key)`, `set(key, { response, storedAt, expiresAt })` and `delete(key)`, all async.

## `cacheKey`

```ts
sha256hex(JSON.stringify([promptVersion, tenantId, request.model, request.maxTokens, request.temperature,
                          request.messages.map(m => [m.role, m.content])]))
```

## `complete(request, ctx)`

Work through these rules in order:

| # | Rule | Returns |
| - | ---- | ------- |
| 1 | If `request.temperature !== 0` or `mode === "bypass"`: call `inner` and don't touch the cache | `cache: "bypass"` |
| 2 | Mode `default`: if `store.get(key)` exists and `now() < expiresAt`, return it. If it exists but has expired, `store.delete(key)` and continue. | `cache: "hit"` |
| 3 | Mode `default` with `semantic` set: embed the **last user message** (one `embed` call) and find the most similar saved entry with the same tenant, model, `maxTokens` and prompt version. If cosine similarity `>= threshold` and its store entry exists and hasn't expired, return it. | `cache: "semantic_hit"` |
| 4 | Call `inner`. If `stopReason === "end"`, `store.set(key, { response, storedAt: now(), expiresAt: now() + ttlMs })` and add it to the semantic index. | `cache: "miss"` |

Mode `refresh` skips rules 2 and 3, but still calls the model and stores the result (rule 4).

**Single-flight:** while a model call for a key is running, other calls with the same key (mode `default` or `refresh`) wait for it and get the same result (`cache: "miss"`) or the same error. A failed call stores nothing, so later calls try again.

**Semantic index:**
- Keep at most `maxEntries` entries and remove the oldest first. Storing the same key again replaces its entry.
- Reuse the embedding from rule 3 if you have it; otherwise embed once.

**Copies:** always return a copy of the response, so that changing it doesn't change the cache.

## Examples

```ts
const cached = createCachedClient(llm, { store, ttlMs: 60_000, promptVersion: "faq-v3", now });
const req = { model: "faq-model", maxTokens: 200, temperature: 0, messages: [{ role: "user", content: "How do I reset my password?" }] };
```

**Miss, then hit**

```ts
await cached.complete(req, { tenantId: "acme" });
// → { text: "Go to Settings → Reset.", usage: {...}, stopReason: "end", cache: "miss" }   (model called)
await cached.complete(req, { tenantId: "acme" });
// → { text: "Go to Settings → Reset.", usage: {...}, stopReason: "end", cache: "hit" }    (no model call)
```

**Other tenant / not cacheable**

```ts
await cached.complete(req, { tenantId: "globex" });                          // → { ..., cache: "miss" }
await cached.complete({ ...req, temperature: 0.7 }, { tenantId: "acme" });    // → { ..., cache: "bypass" }
await cached.complete(req, { tenantId: "acme", mode: "bypass" });             // → { ..., cache: "bypass" }
```

**Expired** (after 60 seconds)

```ts
await cached.complete(req, { tenantId: "acme" });   // → { ..., cache: "miss" } (old entry deleted, model called)
```

**Same request 5 times at once**

```ts
await Promise.all([1, 2, 3, 4, 5].map(() => cached.complete(req, { tenantId: "acme" })));
// → 1 model call, 5 results with cache: "miss"
```

**Semantic hit** (`semantic: { embedder, threshold: 0.9, maxEntries: 1000 }`)

```ts
await cached.complete(req, { tenantId: "acme" });   // "How do I reset my password?" → miss
await cached.complete({ ...req, messages: [{ role: "user", content: "how can I reset my password" }] }, { tenantId: "acme" });
// cosine similarity 0.95 >= 0.9 → { text: "Go to Settings → Reset.", ..., cache: "semantic_hit" }
```

## Rules

- You may use any npm package.
- Edit only `task3.ts`. Do not change the tests.
