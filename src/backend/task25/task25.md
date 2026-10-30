# Capstone 2: Documents and Q&A

**Task ID:** BACKEND-025 · **Level:** 2 · **File:** `src/backend/task25/task25.ts` · **Tests:** `npm run test:backend:25`

The second half of the AI backend: users upload documents and ask questions about them, and the answers cite their sources. This joins the whole RAG pipeline (BACKEND-015 to 018) behind authentication. Data is kept in memory.

`createAiBackend({ verifier, llm, embedder })` builds and returns the Express app.

## Rules for all routes

Same as BACKEND-024: every route except `GET /health` needs `Authorization: Bearer <token>` (otherwise `401`); other users' documents are treated as not found (`404`); errors are `{ "error": "<any message>" }`; unknown routes are `404`.

## Endpoints

| Endpoint | REQUIREMENT | Success |
| --- | --- | --- |
| `GET /health` | No auth. | `200` `{ "status": "ok" }` |
| `POST /documents` | Body `{ title, content }`: title 1–200 characters, content a non-empty string, otherwise `400`. Split the content into paragraphs like BACKEND-016. **No** paragraphs: `400`. Embed all paragraphs in **one** `embedder.embed` call. If embedding fails: `502`, store nothing. Store the document and its chunks. | `201` `{ "id", "title", "chunkCount" }` |
| `GET /documents` | The caller's documents, oldest first. | `200` `{ "data": [ { "id", "title", "chunkCount" } ] }` |
| `DELETE /documents/:id` | Delete the caller's document **and its chunks**. | `204`, empty body |
| `POST /ask` | Body `{ question }`, a non-empty string, otherwise `400`. See below. | `200` `{ "answer", "citations" }` |

## POST /ask

1. Embed the question (`embedder.embed([question])`) and score it against the caller's chunks only, with cosine similarity (BACKEND-017). Keep the best **3**, highest score first.
2. No chunks: `200` `{ "answer": NO_ANSWER, "citations": [] }`, without calling the model.
3. Otherwise call the model with `model: MODEL`, `maxTokens: 500` and the messages from BACKEND-018's `buildPrompt`: the system message `SYSTEM_PROMPT`, then the user message `"Sources:\n[1] …\n[2] …\n\nQuestion: …"`.
4. Answer `{ "answer": text, "citations": [ { "source": n, "documentId": "…" } ] }`: each valid `[n]` in the text, once, in order of first use. If the model fails: `502`.

## Example session (as Ana)

| Request | Response |
| --- | --- |
| `POST /documents` `{ "title": "Cats", "content": "Cats sleep 16 hours.\n\nCats purr." }` | `201` `{ "id": "d-1", "title": "Cats", "chunkCount": 2 }` |
| `POST /ask` `{ "question": "How long do cats sleep?" }` | `200` `{ "answer": "About 16 hours [1].", "citations": [ { "source": 1, "documentId": "d-1" } ] }` |
| `DELETE /documents/d-1` | `204` |
| `POST /ask` `{ "question": "How long do cats sleep?" }` | `200` `{ "answer": NO_ANSWER, "citations": [] }` |

## How to check your work

Run `npm run test:backend:25`.

## Rules

- Edit only `task25.ts`. You may copy code from earlier BACKEND tasks.
