# Semantic Search

**Task ID:** BACKEND-017 · **Level:** 2 · **File:** `src/backend/task17/task17.ts` · **Tests:** `npm run test:backend:17`

Semantic search finds text by **meaning**, not by exact words: "my cat is sick" can find a chunk about "veterinary care for pets". The query is turned into a vector with the same embedder as the chunks, then compared with every chunk's vector, and the most similar ones win.

The app receives an `Embedder` and the stored chunks (made by BACKEND-016). The caller's id is in `res.locals.userId`. (RAG-002 does the same inside PostgreSQL with pgvector.)

## 1. cosineSimilarity(a, b)

**REQUIREMENT:** Return how similar the directions of two vectors are, from -1 to 1:

```text
cosine(a, b) = (a · b) / (|a| × |b|)
a · b = a[0]×b[0] + a[1]×b[1] + …        |a| = √(a[0]² + a[1]² + …)
```

| Input | Output |
| --- | --- |
| `[1, 0]`, `[1, 0]` | `1` (same direction) |
| `[1, 0]`, `[0, 1]` | `0` (unrelated) |
| `[1, 0]`, `[-1, 0]` | `-1` (opposite) |
| `[1, 1]`, `[2, 2]` | `1` (length doesn't matter) |

## 2. POST /search

**REQUIREMENT:** The body is `{ query, topK }`.

1. `query` must be a non-empty string. `topK` is optional (default `3`) and must be an integer from 1 to 10. Otherwise `400` `{ "error": "<any message>" }`.
2. Embed the query with **one** call: `await deps.embedder.embed([query])`.
3. Compare it with the caller's chunks **only**. Other users' chunks must never appear.
4. Sort by score, highest first, and return the first `topK`:

```json
{ "results": [ { "chunkId": "d1:0", "documentId": "d1", "text": "Cats purr.", "score": 0.98 } ] }
```

## How to check your work

Run `npm run test:backend:17`.

## Rules

- Edit only `task17.ts`.
