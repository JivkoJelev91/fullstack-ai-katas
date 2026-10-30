# Cursor Pagination

**Task ID:** BACKEND-005 · **Level:** 2 · **File:** `src/backend/task5/task5.ts` · **Tests:** `npm run test:backend:5`

A long conversation can have thousands of messages, so the API returns them in pages. Write `listMessagesPage(db, conversationId, { limit, cursor })`.

This uses a **cursor** instead of `OFFSET`. The cursor says "continue after this message", so the query is `WHERE seq > $cursor`. That stays fast on big tables and doesn't skip or repeat messages when new ones arrive between two page requests.

The tests create the tables from `CHAT_SCHEMA` in `src/backend/shared.ts`. Every message has a `seq` number that increases with every insert.

## listMessagesPage(db, conversationId, { limit, cursor })

**REQUIREMENT:**

- Return the conversation's messages ordered by `seq`, at most `limit` of them, as `{ items, nextCursor }`. Each item is `{ id, seq, role, content }`.
- `limit` defaults to `20` (`DEFAULT_LIMIT`). A value above `50` is treated as `50` (`MAX_LIMIT`).
- Without `cursor`, start at the first message. With `cursor`, return only messages with `seq` greater than it.
- `nextCursor` is the `seq` of the last item, as a string, **only if more messages exist after it**. Otherwise it is `null`.

To know whether more exist, fetch `limit + 1` rows. If you get the extra row, there is a next page; don't return that extra row.

**Example:** a conversation with 5 messages (seq 1–5), `limit: 2`

| Call | Returns |
| --- | --- |
| `{ limit: 2 }` | items seq `1, 2`, `nextCursor: "2"` |
| `{ limit: 2, cursor: "2" }` | items seq `3, 4`, `nextCursor: "4"` |
| `{ limit: 2, cursor: "4" }` | items seq `5`, `nextCursor: null` |
| `{}` | items seq `1–5`, `nextCursor: null` |

With exactly 4 messages, the second page (`cursor: "2"`) returns seq `3, 4` and `nextCursor: null`, because nothing comes after it.

## How to check your work

Run `npm run test:backend:5`.

## Rules

- Edit only `task5.ts`.
