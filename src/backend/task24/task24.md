# Capstone 1: Chat API

**Task ID:** BACKEND-024 · **Level:** 2 · **File:** `src/backend/task24/task24.ts` · **Tests:** `npm run test:backend:24`

Put the pieces together into one working backend for an AI chat app. Every rule below comes from an earlier task, and you can reuse your code from it. Data is kept in memory (Maps) to keep the focus on the API.

`createAiBackend({ verifier, llm })` builds and returns the Express app.

## Rules for all routes

| Rule | From |
| --- | --- |
| Every route except `GET /health` requires `Authorization: Bearer <token>`, checked with `verifier.verify`. Otherwise `401`. | BACKEND-007 |
| A conversation of another user is treated as not found: `404`. | BACKEND-009 |
| Every error response is `{ "error": "<any message>" }`. An unknown route is `404`. An unexpected error is `500` with `{ "error": "Internal server error" }`. | BACKEND-002 |

## Endpoints

| Endpoint | REQUIREMENT | Success |
| --- | --- | --- |
| `GET /health` | No auth. | `200` `{ "status": "ok" }` |
| `POST /conversations` | Body `{ title }`, 1–100 characters, otherwise `400`. Create a conversation for the caller. | `201` `{ "id", "title", "createdAt" }` |
| `GET /conversations` | The caller's conversations, oldest first. | `200` `{ "data": [ { "id", "title", "messageCount" } ] }` |
| `GET /conversations/:id/messages` | The conversation's messages, oldest first. | `200` `{ "data": [ { "role", "content" } ] }` |
| `POST /conversations/:id/messages` | Body `{ content }`, 1–4000 characters, otherwise `400` without calling the model. Call the model like BACKEND-012: `model: MODEL`, `maxTokens: 500`, messages = system prompt + history + new user message. Save both messages. If the model fails: `502`, save nothing. | `201` `{ "reply" }` |

## Example session

| Request (as Ana) | Response |
| --- | --- |
| `POST /conversations` `{ "title": "Trip" }` | `201` `{ "id": "c-1", "title": "Trip", "createdAt": "…" }` |
| `POST /conversations/c-1/messages` `{ "content": "Where to go?" }` | `201` `{ "reply": "Try Lisbon." }` |
| `GET /conversations` | `200` `{ "data": [ { "id": "c-1", "title": "Trip", "messageCount": 2 } ] }` |
| `GET /conversations/c-1/messages` | `200` `{ "data": [ { "role": "user", "content": "Where to go?" }, { "role": "assistant", "content": "Try Lisbon." } ] }` |
| `GET /conversations/c-1/messages` as Bob | `404` |

## How to check your work

Run `npm run test:backend:24`.

## Rules

- Edit only `task24.ts`. You may copy code from earlier BACKEND tasks.
