# Streaming Replies over SSE

**Task ID:** BACKEND-013 · **Level:** 2 · **File:** `src/backend/task13/task13.ts` · **Tests:** `npm run test:backend:13`

A long AI answer can take 20 seconds. Instead of a blank screen, chat apps show the answer while it's being written. The model sends small text pieces, and the backend forwards each one to the browser right away with **Server-Sent Events (SSE)**: one HTTP response that stays open and receives one event after another.

The app receives a `StreamingLLM` (its `stream()` yields text pieces) and a `MessageStore`.

## SSE format

The response has the header `Content-Type: text/event-stream`. Each event is two lines followed by an empty line:

```text
event: token
data: {"text":"Hel"}

```

## POST /conversations/:id/stream

**REQUIREMENT:**

1. `content` must be a non-empty string. Otherwise respond with normal JSON: `400` `{ "error": "<any message>" }`. Don't start a stream or call the model.
2. Save the user message: `await store.save(id, "user", content)`.
3. Set `Content-Type: text/event-stream` and `Cache-Control: no-cache`.
4. For each piece from `deps.llm.stream({ model: MODEL, messages: [{ role: "user", content }] })`, write a `token` event with `{"text": piece}`.
5. When the stream ends: save the **whole** answer (all pieces joined) with `store.save(id, "assistant", fullText)`, then write `event: done` with `data: {}` and end the response.
6. If the stream throws: write `event: error` with `data: {"error":"<any message>"}`, end the response, and **don't** save the assistant message. The status is already `200` and can't be changed once streaming has started, so errors are sent as an event.

**Example:** the model yields `"Hel"`, `"lo"`, `"!"`

```text
event: token
data: {"text":"Hel"}

event: token
data: {"text":"lo"}

event: token
data: {"text":"!"}

event: done
data: {}

```

Saved: `("c1", "user", "Hi")`, then `("c1", "assistant", "Hello!")`.

## How to check your work

Run `npm run test:backend:13`.

## Rules

- Edit only `task13.ts`.
