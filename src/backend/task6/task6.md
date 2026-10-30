# Transactions

**Task ID:** BACKEND-006 · **Level:** 2 · **File:** `src/backend/task6/task6.ts` · **Tests:** `npm run test:backend:6`

When the AI answers, the app saves two messages (the user's question and the assistant's answer) and updates the conversation's `updated_at`. These three writes must succeed or fail **together**. A conversation with a question but no answer is broken data. A **transaction** guarantees this: if any statement fails, the database undoes all of them (rollback).

The tests create the tables from `CHAT_SCHEMA` in `src/backend/shared.ts`.

## saveExchange(db, { conversationId, userContent, assistantContent })

**REQUIREMENT:** Inside **one** `db.transaction(...)`:

1. Insert the user message (`role: "user"`, new id).
2. Insert the assistant message (`role: "assistant"`, new id).
3. Set the conversation's `updated_at` to `now()`.

Return `{ userMessage, assistantMessage }`, each `{ id, role, content }`.

If any step fails, the promise rejects and **nothing** is saved: no messages, no `updated_at` change.

**Inside the transaction, use `tx`, not `db`.** Only queries sent through `tx` belong to the transaction. With PGlite, a `db.query` inside the transaction even waits forever, and the test times out.

**Examples:**

| Call | Result |
| --- | --- |
| `saveExchange(db, { conversationId: "c1", userContent: "Hi", assistantContent: "Hello!" })` | 2 messages saved, `updated_at` changed |
| `assistantContent: null` (violates `NOT NULL`) | rejects; no message saved, `updated_at` unchanged |
| `conversationId: "nope"` (no such conversation) | rejects; nothing saved |

## How to check your work

Run `npm run test:backend:6`.

## Rules

- Edit only `task6.ts`.
