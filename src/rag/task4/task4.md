# Qdrant Vector Store Adapter with Hybrid Queries

**Task ID:** RAG-004 · **Level:** 2 · **File:** `src/rag/task4/task4.ts` · **Tests:** `npm run test:rag:4`

Write 5 small functions that call a Qdrant client: create a collection, upsert chunks, run a hybrid (dense + sparse) query, and delete a document. Every read and write is scoped to one tenant.

## Setup

- `client` has the official Qdrant client methods `collectionExists`, `createCollection`, `createPayloadIndex`, `upsert`, `query` and `delete`. The tests pass a fake and check the exact arguments you send.
- Throw `ValidationError` from `src/shared/errors.ts` for bad input, before calling the client.
- Let errors thrown by the client pass through unchanged.
- `RESERVED_PAYLOAD_KEYS` = `["chunkId", "docId", "tenantId", "text"]`.

## Functions

### `toPointId(chunkId)`

Take the SHA-256 hex digest of `chunkId`, keep the first 32 characters, and format them as a UUID `8-4-4-4-12` (lowercase).

### `ensureCollection(client, { name, denseSize })`

| Case | Action | Returns |
| ---- | ------ | ------- |
| `(await client.collectionExists(name)).exists` is `true` | nothing | `{ created: false }` |
| otherwise | 1. `createCollection(name, { vectors: { dense: { size: denseSize, distance: "Cosine" } }, sparse_vectors: { sparse: {} } })` <br> 2. `createPayloadIndex(name, { field_name: "tenantId", field_schema: "keyword", wait: true })` <br> 3. the same call with `field_name: "docId"` | `{ created: true }` |

### `upsertChunks(client, collection, chunks, { denseSize, batchSize = 64 })`

Check **all** chunks first. Throw `ValidationError` if:
- `chunkId`, `docId` or `tenantId` is empty;
- `dense.length !== denseSize`;
- `sparse.indices.length !== sparse.values.length`;
- `metadata` uses a reserved key.

Then call `client.upsert(collection, { wait: true, points })` in batches of at most `batchSize`, keeping the input order. Each point:

```ts
{
  id: toPointId(chunkId),
  vector: { dense, sparse: { indices, values } },        // sparse sorted by index, values reordered to match
  payload: { ...metadata, chunkId, docId, tenantId, text },
}
```

**Returns** the number of points sent.

### `hybridQuery(client, collection, { tenantId, dense, sparse, limit, prefetchLimit = 4 * limit, docIds? })`

```ts
const filter = { must: [ { key: "tenantId", match: { value: tenantId } },
                         /* only if docIds is non-empty: */ { key: "docId", match: { any: docIds } } ] };

client.query(collection, {
  prefetch: [
    { query: dense,                using: "dense",  limit: prefetchLimit, filter },
    { query: { indices, values },  using: "sparse", limit: prefetchLimit, filter },   // sparse sorted by index
  ],
  query: { fusion: "rrf" },
  filter,
  limit,
  with_payload: true,
});
```

Map each returned point to `{ chunkId, docId, text, score, metadata }`. `metadata` is the payload without the reserved keys. **Drop** points that have no payload, or whose `payload.tenantId` isn't the requested tenant.

### `deleteDocument(client, collection, { tenantId, docId })`

Throw `ValidationError` if either value is empty. Otherwise:

```ts
client.delete(collection, { wait: true, filter: { must: [
  { key: "tenantId", match: { value: tenantId } },
  { key: "docId",    match: { value: docId } } ] } });
```

## Examples

**ensureCollection**

```ts
await ensureCollection(client, { name: "kb", denseSize: 3 });   // → { created: true }
await ensureCollection(client, { name: "kb", denseSize: 3 });   // → { created: false } (already exists)
```

**upsertChunks**

```ts
await upsertChunks(client, "kb", [{
  chunkId: "refunds#0", docId: "refunds", tenantId: "acme", text: "Refunds take 14 days.",
  dense: [0.1, 0.2, 0.3], sparse: { indices: [42, 7], values: [0.5, 1.2] }, metadata: { lang: "en" },
}], { denseSize: 3 });
// → 1
// client.upsert("kb", { wait: true, points: [ {
//   id: toPointId("refunds#0"),
//   vector: { dense: [0.1, 0.2, 0.3], sparse: { indices: [7, 42], values: [1.2, 0.5] } },
//   payload: { lang: "en", chunkId: "refunds#0", docId: "refunds", tenantId: "acme", text: "Refunds take 14 days." } } ] })

await upsertChunks(client, "kb", [{ ...chunk, dense: [0.1, 0.2] }], { denseSize: 3 });
// → throws ValidationError, upsert not called
```

**hybridQuery**

```ts
await hybridQuery(client, "kb", { tenantId: "acme", dense: [0.1, 0.2, 0.3], sparse: { indices: [7], values: [1] }, limit: 5 });
// client returns: { points: [
//   { id: "...", score: 0.5, payload: { lang: "en", chunkId: "refunds#0", docId: "refunds", tenantId: "acme", text: "Refunds take 14 days." } },
//   { id: "...", score: 0.4, payload: { chunkId: "x#0", docId: "x", tenantId: "globex", text: "secret" } } ] }   ← other tenant
// → [ { chunkId: "refunds#0", docId: "refunds", text: "Refunds take 14 days.", score: 0.5, metadata: { lang: "en" } } ]
```

**deleteDocument**

```ts
await deleteDocument(client, "kb", { tenantId: "acme", docId: "refunds" });   // → undefined
await deleteDocument(client, "kb", { tenantId: "", docId: "refunds" });       // → throws ValidationError
```

## Rules

- You may use any npm package.
- Edit only `task4.ts`. Do not change the tests.
