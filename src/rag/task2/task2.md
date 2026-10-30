# Incremental Ingestion and Semantic Search with pgvector

**Task ID:** RAG-002 · **Level:** 2 · **File:** `src/rag/task2/task2.ts` · **Tests:** `npm run test:rag:2`

Store document chunks and their embeddings in PostgreSQL (pgvector), re-embed only the documents that changed, and search by cosine similarity.

## Setup

- `db` has `db.query(sql, params)` and `db.transaction(async (tx) => ...)` (see `src/rag/shared.ts`). The tests use PGlite (Postgres in memory), so you don't need a database server.
- `embedder.embed(texts)` returns one vector per text. `embedder.dimensions` is the vector length.
- Always use `$1, $2, ...` parameters. Never put values straight into the SQL string.
- Send a vector to SQL as the string `"[0.1,0.2,...]"` (`JSON.stringify(vector)`) and cast it with `$1::vector`.

## Functions

### `migrate(db, { dimensions })`

Create the extension, tables and index, using `IF NOT EXISTS` so it can run again.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

rag_documents (tenant_id text, id text, title text, content_hash text, updated_at timestamptz DEFAULT now(),
               PRIMARY KEY (tenant_id, id))           -- all columns NOT NULL

rag_chunks (tenant_id text, id text, document_id text, chunk_index integer, content text,
            metadata jsonb DEFAULT '{}', embedding vector(<dimensions>),
            PRIMARY KEY (tenant_id, id),
            FOREIGN KEY (tenant_id, document_id) REFERENCES rag_documents (tenant_id, id) ON DELETE CASCADE)
                                                      -- all columns NOT NULL

HNSW index on rag_chunks.embedding USING hnsw (embedding vector_cosine_ops)
```

### `ingestDocuments(db, embedder, documents, { tenantId, batchSize = 16, deleteMissing = false })`

Input: `documents = [{ id, title, chunks: [{ text, metadata? }] }]`

| Step | Action |
| ---- | ------ |
| 1. Validate | Throw `ValidationError` (from `src/shared/errors.ts`) before any embedding or write if: `tenantId` is empty, a document id is empty or repeated, a document has no chunks, a chunk text is blank, or `batchSize` is not an integer 1–256 |
| 2. Hash | `contentHash = sha256 hex of JSON.stringify({ title, chunks: chunks.map(c => ({ text: c.text, metadata: c.metadata ?? {} })) })` |
| 3. Classify | Compare with the stored hash for this tenant: no row → **added**, different hash → **updated**, same hash → **unchanged** |
| 4. Embed | Embed the chunks of added and updated documents, in calls of at most `batchSize` texts, in document then chunk order. One batch may mix documents. |
| 5. Check vectors | Each call must return one vector per text, each of length `embedder.dimensions` and made of finite numbers. Otherwise throw `EmbeddingError`. |
| 6. Write | In **one transaction**, after all embeddings are ready: upsert the document row (title, hash, `updated_at = now()`), delete its old chunks, and insert the new ones (`id = "<docId>#<i>"`, `chunk_index = i`, `metadata` as JSON). |
| 7. Delete | If `deleteMissing`, delete this tenant's documents that are not in `documents`. Their chunks go too, through the cascade. |

If anything fails, the database must stay exactly as it was. Never touch other tenants' rows.

**Returns** `{ added, updated, unchanged, deleted, chunksWritten, embeddingCalls }`. The id lists are in input order, `deleted` is sorted A→Z, and the two counts are numbers.

### `searchChunks(db, embedder, { tenantId, text, k = 5, minScore?, filter? })`

- Embed `text` with one `embed` call.
- Return the tenant's `k` closest chunks: `score = 1 - (embedding <=> queryVector)`.
- Sort by `score` descending, then `chunkId` A→Z.
- `minScore`: drop results with a lower score.
- `filter` (e.g. `{ lang: "en" }`): keep only chunks whose metadata contains all these pairs (`metadata @> $n::jsonb`).
- Each result: `{ chunkId, documentId, title, content, metadata, score }`.

## Examples

**First ingest**

```ts
await migrate(db, { dimensions: 4 });

await ingestDocuments(db, embedder, [
  { id: "refunds", title: "Refund policy", chunks: [{ text: "Refunds are issued within 14 days.", metadata: { lang: "en" } }] },
  { id: "shipping", title: "Shipping", chunks: [{ text: "We ship worldwide." }, { text: "Express takes 2 days." }] },
], { tenantId: "acme", batchSize: 2 });
// → { added: ["refunds", "shipping"], updated: [], unchanged: [], deleted: [], chunksWritten: 3, embeddingCalls: 2 }
```

**Same documents again**

```ts
// → { added: [], updated: [], unchanged: ["refunds", "shipping"], deleted: [], chunksWritten: 0, embeddingCalls: 0 }
```

**One document changed, one removed**

```ts
await ingestDocuments(db, embedder, [
  { id: "refunds", title: "Refund policy", chunks: [{ text: "Refunds are issued within 7 days." }] },
], { tenantId: "acme", deleteMissing: true });
// → { added: [], updated: ["refunds"], unchanged: [], deleted: ["shipping"], chunksWritten: 1, embeddingCalls: 1 }
```

**Search**

```ts
await searchChunks(db, embedder, { tenantId: "acme", text: "how long do refunds take?", k: 2, filter: { lang: "en" } });
// → [ { chunkId: "refunds#0", documentId: "refunds", title: "Refund policy",
//       content: "Refunds are issued within 14 days.", metadata: { lang: "en" }, score: 0.97 } ]
```

**Errors**

```ts
await ingestDocuments(db, embedder, [{ id: "x", title: "X", chunks: [] }], { tenantId: "acme" });
// → throws ValidationError, nothing embedded or written

// embedder returns vectors of the wrong length
// → throws EmbeddingError, nothing written
```

## Rules

- You may use any npm package.
- Edit only `task2.ts`. Do not change the tests.
