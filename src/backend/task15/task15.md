# Document Upload

**Task ID:** BACKEND-015 · **Level:** 1 · **File:** `src/backend/task15/task15.ts` · **Tests:** `npm run test:backend:15`

The first step of a RAG pipeline: the user uploads a document so the AI can answer questions about it later. Processing a document (chunking, embeddings) takes time, so the upload endpoint only **validates, stores and queues** it, and answers right away with `202 Accepted`, meaning "received, will be processed later". BACKEND-016 does the processing.

The app receives `onUploaded(documentId)`, which stands for "put this document in the processing queue". The caller's id is in `res.locals.userId`.

## 1. POST /documents

**REQUIREMENT:** The body is `{ title, mimeType, content }`.

| Check | Error |
| --- | --- |
| `title` is a string of 1–200 characters | `400` |
| `content` is a non-empty string | `400` |
| `mimeType` is one of `ALLOWED_TYPES` (`text/plain`, `text/markdown`) | `415` Unsupported Media Type |
| `content` has at most `MAX_CONTENT_LENGTH` (100,000) characters | `413` Payload Too Large |

All errors are `{ "error": "<any message>" }`, and nothing is stored or queued. Each test request has only one problem, so the order of the checks doesn't matter.

If everything is valid: store the document with a new id, `status: "pending"` and `createdAt` (ISO), call `deps.onUploaded(id)`, and respond `202` with `{ "id": "<id>", "status": "pending" }`.

## 2. GET /documents/:id

**REQUIREMENT:** Return the caller's document **without** its content (it can be large), plus its size:

```json
{ "id": "…", "title": "Notes", "mimeType": "text/plain", "status": "pending", "size": 11, "createdAt": "…" }
```

`size` is the number of characters in `content`. Another user's document or an unknown id: `404` `{ "error": "<any message>" }`.

## How to check your work

Run `npm run test:backend:15`.

## Rules

- Edit only `task15.ts`.
