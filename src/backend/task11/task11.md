# Rate Limiting

**Task ID:** BACKEND-011 · **Level:** 1–2 · **File:** `src/backend/task11/task11.ts` · **Tests:** `npm run test:backend:11`

Every LLM call costs money, so one user (or a buggy script) must not be able to send thousands of requests. A rate limiter allows each user `limit` requests per time window and rejects the rest with `429 Too Many Requests`. Write `rateLimit(options)`, a middleware factory.

## rateLimit({ limit, windowMs, keyOf, now })

This is a **fixed window** limiter. Each key (from `keyOf(req)`, for example the user id) has its own window and counter:

- A key's first request starts its window at `now()`, with count 1.
- Inside the window, every request adds 1 to the count. While the count is at most `limit`, call `next()`.
- Over the limit: respond `429` with `{ "error": "<any message>" }` and the header `Retry-After` set to the number of **seconds** until the window ends, rounded up. Don't call `next()`.
- When `now()` reaches `windowStart + windowMs`, the window is over. The next request starts a new window with count 1.

Use the `now` option (default `Date.now`) for the time, never `Date.now()` directly. The tests pass a fake clock.

**Example:** `limit: 3`, `windowMs: 60000`, all requests from user `u1`

| Time (ms) | Request | Result |
| --- | --- | --- |
| 0 | 1st | allowed (window starts at 0) |
| 1000 | 2nd | allowed |
| 2000 | 3rd | allowed |
| 15000 | 4th | `429`, `Retry-After: 45` (60000 − 15000 = 45000 ms) |
| 60000 | 5th | allowed: a new window starts, count 1 |

User `u2` has their own counter, so `u1` being limited doesn't affect `u2`.

## How to check your work

Run `npm run test:backend:11`.

## Rules

- Edit only `task11.ts`.
