# Validation Middleware

**Task ID:** BACKEND-001 · **Level:** 1 · **File:** `src/backend/task1/task1.ts` · **Tests:** `npm run test:backend:1`

Write `validateBody(schema)`: an Express middleware that checks `req.body` with a Zod schema before the route handler runs. Every route can then reuse it instead of repeating validation code.

The starter already has the app, the `CreateConversationSchema` and a `POST /conversations` route that uses your middleware and returns `req.body`.

## validateBody(schema)

**REQUIREMENT:**

- If `req.body` is valid: replace `req.body` with the **parsed** data (defaults filled in, unknown fields removed) and call `next()`.
- If it is invalid: respond `400` with `{ "error": "<any message>", "fields": [...] }` and do **not** call `next()`, so the handler never runs.
- `fields` lists each invalid field once. A nested field is written with dots, for example `"user.name"`.

**INPUT:** valid, without `model`

```http
POST /conversations
{ "title": "Trip ideas", "extra": 1 }
```

**OUTPUT:** `model` got its default, `extra` was removed

```http
201 Created
{ "title": "Trip ideas", "model": "fast" }
```

**INPUT:** two invalid fields

```http
POST /conversations
{ "title": "", "model": "huge" }
```

**OUTPUT:**

```http
400 Bad Request
{ "error": "Validation failed", "fields": ["title", "model"] }
```

## How to check your work

Run `npm run test:backend:1`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.

## Rules

- Edit only `task1.ts`.
