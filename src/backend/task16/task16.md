# Ingestion Pipeline

**Task ID:** BACKEND-016 · **Level:** 2 · **File:** `src/backend/task16/task16.ts` · **Tests:** `npm run test:backend:16`

The background step after an upload: split the document into chunks, turn each chunk into an **embedding** (a list of numbers that represents its meaning), and store them so they can be searched later (BACKEND-017). The document's status tells the user how processing went.

The embedder is the `Embedder` contract from `src/backend/shared.ts`; the tests use a fake one. Documents and chunks are kept in memory (`deps.documents`, `deps.chunks`).

## 1. splitIntoChunks(content)

**REQUIREMENT:** Split the text into paragraphs: parts separated by one or more blank lines. Trim each part and drop empty ones.

| Input | Output |
| --- | --- |
| `"First paragraph.\n\nSecond one.\n\n\n  Third.  "` | `["First paragraph.", "Second one.", "Third."]` |
| `"   \n\n  "` | `[]` |

(RAG-001 covers smarter chunking. Here, paragraphs are enough.)

## 2. ingestDocument(documentId, deps)

**REQUIREMENT:**

1. Find the document in `deps.documents`. If it's missing, throw an `Error`.
2. Split its content. If there are **no** chunks: set `status: "failed"` and `error: "Document has no text"`, then stop.
3. Embed **all** chunk texts with **one** `embedder.embed(texts)` call. One batched call is much faster and cheaper than one call per chunk.
4. Remove the document's old chunks from `deps.chunks` (if any), then add the new ones: `{ id: "<documentId>:<index>", documentId, userId, index, text, vector }`, with `index` starting at 0.
5. Set `status: "ready"` and `chunkCount` to the number of chunks.
6. If embedding throws: set `status: "failed"` and `error` to the error's message, and add **no** chunks. Don't rethrow: the failure is recorded on the document.

Step 4 makes ingestion safe to run twice. Background jobs are retried (BACKEND-019), and a retry must not create duplicate chunks.

**Example:** document `d1` of `u1` with the content `"Cats purr.\n\nDogs bark."`

| After `ingestDocument("d1", deps)` | Value |
| --- | --- |
| `deps.chunks` | `[{ id: "d1:0", documentId: "d1", userId: "u1", index: 0, text: "Cats purr.", vector: […] }, { id: "d1:1", …, index: 1, text: "Dogs bark.", … }]` |
| `deps.documents.get("d1")` | `{ …, status: "ready", chunkCount: 2 }` |

## How to check your work

Run `npm run test:backend:16`.

## Rules

- Edit only `task16.ts`.
