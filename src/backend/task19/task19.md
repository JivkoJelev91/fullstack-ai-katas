# Background Job Queue

**Task ID:** BACKEND-019 · **Level:** 2 · **File:** `src/backend/task19/task19.ts` · **Tests:** `npm run test:backend:19`

Slow or unreliable work (ingesting a document, calling an AI provider, sending an email) shouldn't run inside an HTTP request. The request **enqueues a job** and returns, and a **worker** runs the job later, retrying it if it fails. Real projects use tools like BullMQ with Redis; here you build the core idea in memory.

## createQueue(handler, { maxAttempts = 3 })

The `handler` does the actual work for a job. If it throws, the job failed this time.

**enqueue(type, payload):** create `{ id: randomUUID(), type, payload, status: "queued", attempts: 0, error: null }`, add it to the end of the waiting list, and return it.

**get(id):** return the job, or `undefined`.

**runNext():** take the **oldest** waiting job (first in, first out). If none is waiting, resolve to `false`. Otherwise:

1. Set `status: "running"` and add 1 to `attempts`.
2. `await handler(job)`.
3. Success: `status: "succeeded"`, `error: null`.
4. The handler threw: save the message in `error`. If `attempts < maxAttempts`, set `status: "queued"` and put the job at the **end** of the waiting list (it will be retried). Otherwise, set `status: "failed"`.
5. Resolve to `true`.

**runAll():** call `runNext()` until it returns `false`, and resolve to the number of runs.

**Example:** `maxAttempts: 3`, and the handler fails on the first try of job A

| Step | A | B |
| --- | --- | --- |
| `enqueue("ingest", …)` ×2 | queued, 0 attempts | queued, 0 attempts |
| `runNext()` | fails → queued, 1 attempt, `error` set | queued |
| `runNext()` | queued | succeeded, 1 attempt |
| `runNext()` | succeeded, 2 attempts | |
| `runNext()` | → `false`, nothing waiting | |

A job that keeps failing ends as `failed` with `attempts: 3`, and the handler has run 3 times.

## How to check your work

Run `npm run test:backend:19`.

## Rules

- Edit only `task19.ts`.
