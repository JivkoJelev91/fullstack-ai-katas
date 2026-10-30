# User Isolation

**Task ID:** BACKEND-009 · **Level:** 1 · **File:** `src/backend/task9/task9.ts` · **Tests:** `npm run test:backend:9`

Authentication says **who** is calling. Authorization says **what they may touch**. In a multi-user app, every query must be limited to the caller's own data. Forgetting this is one of the most common security bugs (OWASP calls it "Broken Object Level Authorization"): user B guesses the id `c1` and reads user A's conversation.

The starter reads the caller's id from the `x-user-id` header into `res.locals.userId`, as a stand-in for real authentication. You write the three routes.

## Rule for all routes

A conversation that belongs to someone else is treated exactly like one that doesn't exist: `404`. Never answer `403`, because that tells the caller the id exists.

The examples use these conversations:

| id | userId | title |
| --- | --- | --- |
| `c1` | `u1` | Trip |
| `c2` | `u1` | Work |
| `c3` | `u2` | Bob's notes |

## 1. GET /conversations

**REQUIREMENT:** Return only the caller's conversations as `{ "data": [...] }`.

| Input | Output |
| --- | --- |
| `GET /conversations` with `x-user-id: u1` | `200` `{ "data": [ { "id": "c1", … }, { "id": "c2", … } ] }` |

## 2. GET /conversations/:id

**REQUIREMENT:** Return the conversation if it belongs to the caller. Otherwise `404` with `{ "error": "<any message>" }`.

| Input (as `u1`) | Output |
| --- | --- |
| `GET /conversations/c1` | `200` `{ "id": "c1", "userId": "u1", "title": "Trip" }` |
| `GET /conversations/c3` (belongs to `u2`) | `404` `{ "error": "Conversation not found" }` |
| `GET /conversations/xyz` | `404` `{ "error": "Conversation not found" }` |

## 3. DELETE /conversations/:id

**REQUIREMENT:** Delete the caller's conversation and respond `204` with no body. Someone else's or unknown: `404`, and nothing is deleted.

## How to check your work

Run `npm run test:backend:9`.

## Rules

- Edit only `task9.ts`.
