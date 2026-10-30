# Request IDs and Structured Logging

**Task ID:** BACKEND-021 · **Level:** 1 · **File:** `src/backend/task21/task21.ts` · **Tests:** `npm run test:backend:21`

When a user reports "my request failed", you need to find that one request among thousands of log lines. Two middleware make this possible:

- a **request id** that is unique per request, returned to the client in a header and included in every log line;
- **structured logs**: one object per request with fixed fields, instead of free text, so log tools can filter by `status = 500` or by request id.

## 1. requestId()

**REQUIREMENT:**

- If the request has an `X-Request-Id` header that is 1–64 characters of letters, digits and `-`, reuse it. A proxy or another service may already have assigned an id, and reusing it connects their logs with yours.
- Otherwise, create one with `randomUUID()`. Don't trust other values: a client could inject very long or odd text into your logs.
- Save it as `res.locals.requestId` and set the response header `X-Request-Id`. Then call `next()`.

| Incoming `X-Request-Id` | Used id |
| --- | --- |
| none | new UUID, e.g. `9b1c2d3e-…` |
| `abc-123` | `abc-123` |
| `bad id!` (space, `!`) or 65+ characters | new UUID |

## 2. requestLogger(log, now = Date.now)

**REQUIREMENT:** Note the start time with `now()`. When the response is finished (`res.on("finish", …)`), call `log` once with:

```json
{ "requestId": "abc-123", "method": "GET", "path": "/hello", "status": 200, "durationMs": 250 }
```

- `path` is the URL path without the query string: `/hello?name=ana` gives `/hello`.
- `durationMs` is `now()` at finish minus `now()` at start. Use the `now` parameter, because the tests pass a fake clock.
- `requestId` is `res.locals.requestId`. The tests register `requestId()` before `requestLogger`.
- Errors are logged too: a `404` response gives an entry with `status: 404`.

## How to check your work

Run `npm run test:backend:21`.

## Rules

- Edit only `task21.ts`.
