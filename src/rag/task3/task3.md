# Hybrid Search with Reciprocal Rank Fusion and Reranking

**Task ID:** RAG-003 · **Level:** 2–3 · **File:** `src/rag/task3/task3.ts` · **Tests:** `npm run test:rag:3`

Combine keyword search (Postgres full-text) and vector search (pgvector) with Reciprocal Rank Fusion (RRF), then optionally rerank the top results.

## What you export

```ts
export async function hybridSearch(
  db: SqlDatabase,
  deps: { embedder: Embedder; reranker?: Reranker },
  query: { tenantId: string; text: string; k?: number; candidates?: number; rrfK?: number;
           weights?: { keyword: number; vector: number }; rerankTop?: number },
): Promise<{ results: HybridResult[]; reranked: boolean }>;
```

## The table (the tests create it)

```sql
CREATE TABLE kb_chunks (
  tenant_id text NOT NULL, id text NOT NULL, content text NOT NULL, embedding vector(4) NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  PRIMARY KEY (tenant_id, id));
```

## Defaults

| Option       | Default                              |
| ------------ | ------------------------------------ |
| `k`          | `5` (number of results)              |
| `candidates` | `20` (rows taken from each retriever)|
| `rrfK`       | `60`                                 |
| `weights`    | `{ keyword: 1, vector: 1 }`          |
| `rerankTop`  | `Math.min(3 * k, number of fused candidates)` |

## Steps

Only use rows where `tenant_id = query.tenantId`, and pass all values as `$1, $2, ...` parameters.

**1. Keyword search**

```sql
WHERE tsv @@ websearch_to_tsquery('english', $text)
ORDER BY ts_rank_cd(tsv, websearch_to_tsquery('english', $text)) DESC, id ASC
LIMIT $candidates
```

**2. Vector search.** Embed `text` with one `embed` call, then:

```sql
ORDER BY embedding <=> $vector::vector ASC, id ASC
LIMIT $candidates
```

**3. Fuse.** Ranks start at 1 in each list. For each id found by either search:

```
score = weights.keyword / (rrfK + keywordRank) + weights.vector / (rrfK + vectorRank)
```

A missing rank adds 0. Sort by `score` descending, then `id` A→Z.

**4. Rerank** (only if `deps.reranker` is given):
- Call `reranker.rerank(text, top)` **once**, where `top` = the first `rerankTop` fused items as `{ id, content }`.
- The answer must contain exactly one `{ id, score }` for each item sent, with finite scores. Sort by that score descending; on a tie keep the fused order.
- If the reranker throws or returns a bad answer, keep the fused order and set `reranked: false`.

**5. Return** the first `k` items:

| Field          | Value |
| -------------- | ----- |
| `id`, `content`| from the row |
| `score`        | the fused RRF score |
| `keywordRank`  | rank in the keyword list, or `null` |
| `vectorRank`   | rank in the vector list, or `null` |
| `rerankScore`  | the reranker's score, or `null` if not reranked |

## Examples

Rows for tenant `acme`. The query `"invoice"` embeds to `[1, 0, 0, 0]`.

| id | content | embedding |
| -- | ------- | --------- |
| d1 | invoice invoice invoice payment overdue | [1, 0, 0, 0] |
| d2 | payment methods and invoice copies      | [0, 1, 0, 0] |
| d3 | reset password instructions             | [0.9, 0.1, 0, 0] |
| d4 | shipping times for international orders | [0, 0, 1, 0] |

**Without a reranker**

```ts
await hybridSearch(db, { embedder }, { tenantId: "acme", text: "invoice" });
// keyword ranks: d1 = 1, d2 = 2
// vector ranks:  d1 = 1, d3 = 2, d2 = 3, d4 = 4
// → { reranked: false, results: [
//     { id: "d1", content: "...", score: 2/61,        keywordRank: 1,    vectorRank: 1, rerankScore: null },
//     { id: "d2", content: "...", score: 1/62 + 1/63, keywordRank: 2,    vectorRank: 3, rerankScore: null },
//     { id: "d3", content: "...", score: 1/62,        keywordRank: null, vectorRank: 2, rerankScore: null },
//     { id: "d4", content: "...", score: 1/64,        keywordRank: null, vectorRank: 4, rerankScore: null } ] }
```

**With a reranker** that scores `d3: 0.9, d2: 0.5, d1: 0.1, d4: 0.0`

```ts
// → { reranked: true, results: [
//     { id: "d3", ..., rerankScore: 0.9 }, { id: "d2", ..., rerankScore: 0.5 },
//     { id: "d1", ..., rerankScore: 0.1 }, { id: "d4", ..., rerankScore: 0 } ] }
```

**Reranker throws**

```ts
// → { reranked: false, results: d1, d2, d3, d4 (fused order), all rerankScore: null }
```

**Query with only stop words** (`"the and of"`)

```ts
// keyword search returns nothing, so the results come only from vector search and keywordRank is null for all
```

## Rules

- You may use any npm package.
- Edit only `task3.ts`. Do not change the tests.
