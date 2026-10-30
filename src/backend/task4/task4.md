# Conversation Repository

**Task ID:** BACKEND-004 · **Level:** 1–2 · **File:** `src/backend/task4/task4.ts` · **Tests:** `npm run test:backend:4`

A repository is the only place that talks SQL. The rest of the app calls its functions and gets back plain TypeScript objects. Write the four functions of `createConversationRepository(db)`.

The tests create the tables from `CHAT_SCHEMA` in `src/backend/shared.ts` and add users `u1` and `u2`. Note the column names: the database uses `snake_case` (`user_id`, `created_at`), and your objects use `camelCase` (`userId`, `createdAt`). Converting between the two is the repository's job.

## 1. createConversation(userId, title)

**REQUIREMENT:** Insert a conversation with a new id (`randomUUID()`) and return it.

| Call | Returns |
| --- | --- |
| `createConversation("u1", "Bob's plan")` | `{ id: "3f2a…", userId: "u1", title: "Bob's plan", createdAt: Date }` |

Always pass values as **parameters** (`$1`, `$2`), never by building the SQL string. A title like `Bob's plan` contains a quote that would break, or attack, a string-built query.

## 2. addMessage(conversationId, role, content)

**REQUIREMENT:** Insert a message with a new id and return it: `{ id, conversationId, role, content, createdAt }`. If the conversation doesn't exist, the database rejects the insert (foreign key), and the promise rejects.

## 3. listMessages(conversationId)

**REQUIREMENT:** Return the conversation's messages, oldest first. Order by the `seq` column, which increases with every insert.

## 4. listConversations(userId)

**REQUIREMENT:** Return the user's conversations, newest first (by `created_at`), each with its message count and the time of its last message. Use one query: `LEFT JOIN` messages, `GROUP BY` the conversation, `COUNT(messages.id)` and `MAX(messages.created_at)`.

| Call | Returns |
| --- | --- |
| `listConversations("u1")` | `[ { id: "c2", title: "Empty", messageCount: 0, lastMessageAt: null }, { id: "c1", title: "Trip", messageCount: 2, lastMessageAt: Date } ]` |

Only `u1`'s conversations are returned. A `LEFT JOIN` (not `JOIN`) keeps conversations that have no messages.

## How to check your work

Run `npm run test:backend:4`.

## Rules

- Edit only `task4.ts`.
