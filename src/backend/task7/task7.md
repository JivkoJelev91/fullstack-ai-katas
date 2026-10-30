# Authentication Middleware

**Task ID:** BACKEND-007 · **Level:** 1 · **File:** `src/backend/task7/task7.ts` · **Tests:** `npm run test:backend:7`

Protected routes need to know who is calling. The client sends a token in the `Authorization` header, and a middleware checks it before the route runs. Write `requireAuth(verifier)`.

How a token is checked is not this task's job: the app receives a `TokenVerifier` (BACKEND-008 builds a real one with JWT). The starter has a `GET /me` route that uses your middleware and returns `res.locals.user`.

## requireAuth(verifier)

**REQUIREMENT:**

1. Read the `Authorization` header. It must have the form `Bearer <token>`, with a non-empty token.
2. Call `await verifier.verify(token)`.
3. If it returns a user: save it as `res.locals.user` and call `next()`.
4. In every other case (no header, another scheme such as `Basic`, an empty token, or `verify` returns `null`): respond `401` with `{ "error": "<any message>" }` and don't call `next()`.

`res.locals` is an object Express keeps for one request. Middleware put data there for the handlers that run after them.

**Examples:**

| Request header | Output |
| --- | --- |
| `Authorization: Bearer good-token` (valid) | `200` `{ "id": "u1", "email": "ana@example.com" }` from `/me` |
| no `Authorization` header | `401` `{ "error": "Missing token" }` |
| `Authorization: Basic YW5hOnB3` | `401` `{ "error": "Missing token" }` |
| `Authorization: Bearer ` (empty token) | `401` `{ "error": "Missing token" }` |
| `Authorization: Bearer expired-token` (verify returns null) | `401` `{ "error": "Invalid token" }` |

## How to check your work

Run `npm run test:backend:7`.

## Rules

- Edit only `task7.ts`.
