# Centralized Error Handling

**Task ID:** BACKEND-002 · **Level:** 1 · **File:** `src/backend/task2/task2.ts` · **Tests:** `npm run test:backend:2`

Instead of building an error response in every route, routes just `throw`, and one error handler turns every error into a response. Express 5 also sends errors from `async` handlers to the error handler automatically.

The starter has the error classes (`AppError`, `NotFoundError`, `BadRequestError`) and a `ConversationRepository` the app receives.

## 1. errorHandler

**REQUIREMENT:**

- An `AppError` (or a subclass): respond with its `status` and `{ "error": <its message> }`.
- Any other error: respond `500` with `{ "error": "Internal server error" }`. Never send the real message to the client, because it can contain internal details. Log it with `console.error` instead.

| Thrown | Output |
| --- | --- |
| `new NotFoundError("Conversation not found")` | `404` `{ "error": "Conversation not found" }` |
| `new BadRequestError("Title too long")` | `400` `{ "error": "Title too long" }` |
| `new AppError(409, "Already exists")` | `409` `{ "error": "Already exists" }` |
| `new Error("connection to db-prod-7 failed")` | `500` `{ "error": "Internal server error" }` |

## 2. notFoundHandler

**REQUIREMENT:** For a URL that no route matches, respond `404` with `{ "error": "<any message>" }`.

## 3. GET /conversations/:id

**REQUIREMENT:** Load the conversation with `repo.findById`. Found: `200` with the conversation. Not found: `throw new NotFoundError(...)`. If the repository fails, do nothing special: the error reaches `errorHandler`.

| Input | Output |
| --- | --- |
| `GET /conversations/c1` (exists) | `200` `{ "id": "c1", "title": "Trip ideas" }` |
| `GET /conversations/xyz` | `404` `{ "error": "Conversation not found" }` |
| `GET /conversations/c1` when the repository rejects | `500` `{ "error": "Internal server error" }` |

## Wiring

Register them **after** all routes, in this order: `app.use(notFoundHandler)`, then `app.use(errorHandler)`. Express runs middleware in the order it was added, and an error handler (4 parameters) only receives errors from what came before it.

## How to check your work

Run `npm run test:backend:2`. A failed test names the rule it checks and shows what your app returned.

## Rules

- Edit only `task2.ts`.
