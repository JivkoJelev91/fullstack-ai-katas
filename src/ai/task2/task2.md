# Resilient LLM Client: Timeouts, Retries, Cancellation

**Task ID:** AI-002 · **Level:** 2–3 · **File:** `src/ai/task2/task2.ts` · **Tests:** `npm run test:ai:2`

Wrap an `LLMClient` in another `LLMClient` that adds a timeout per attempt, retries with backoff, and cancellation.

## What you export

```ts
export function createResilientClient(inner: LLMClient, options?: ResilienceOptions): LLMClient;
// returns { complete(request) { ... } }
```

The types and error classes are already in the starter file. `LLMClient`, `LLMProviderError` and the request/response types are in `src/ai/shared/llm.ts`.

## Options

| Option        | Default        | Meaning |
| ------------- | -------------- | ------- |
| `maxAttempts` | `3`            | Total attempts, including the first |
| `timeoutMs`   | `30000`        | Time limit for one attempt |
| `baseDelayMs` | `500`          | First backoff delay |
| `maxDelayMs`  | `8000`         | Largest backoff delay |
| `sleep`       | real `setTimeout` delay | Use it for **every** wait (the tests replace it) |
| `random`      | `Math.random`  | Used for jitter |
| `onRetry`     | none           | Called as `onRetry({ attempt, delayMs, error })` before each wait |

## How `complete(request)` works

**Each attempt:**
- Call `inner.complete({ ...request, signal: attemptSignal })`, where `attemptSignal` is a **new** `AbortController().signal` for this attempt only.
- If the attempt hasn't finished after `timeoutMs`, abort `attemptSignal` and count the attempt as failed with `new LLMTimeoutError(timeoutMs)`. Don't wait for `inner` to react. If a result arrives later, ignore it.
- On success, return the response unchanged.

**Which errors are retried:**

| Error | Action |
| ----- | ------ |
| `LLMTimeoutError` | Retry |
| `LLMProviderError` with status `408`, `429`, `500`, `502`, `503`, `504`, `529` | Retry |
| Any other error | Throw that same error right away |

**Wait before the next attempt** (`n` = number of the attempt that just failed, starting at 1):

```
exp   = Math.min(maxDelayMs, baseDelayMs * 2 ** (n - 1))
delay = Math.floor(exp / 2 + random() * exp / 2)
```

If the error is an `LLMProviderError` with `retryAfterMs`:
- if `retryAfterMs <= maxDelayMs`, wait exactly `retryAfterMs`;
- if it is larger, don't retry: throw that error right away.

Call `onRetry` before each wait, then `await sleep(delay)`.

**When all attempts fail:** throw `new RetryExhaustedError(attemptsMade, lastError)`. Don't wait after the last attempt.

**Cancellation** (the caller's `request.signal`):

| When the caller aborts            | Action |
| --------------------------------- | ------ |
| Before the call (already aborted) | Throw `RequestAbortedError` and don't call `inner` |
| During an attempt                 | Abort `attemptSignal`, throw `RequestAbortedError` right away, and don't retry |
| During a wait                     | Throw `RequestAbortedError` right away (don't wait for `sleep`), and make no more attempts |

## Examples

Setup for all examples:

```ts
const client = createResilientClient(inner, { maxAttempts: 3, baseDelayMs: 200, maxDelayMs: 1000, random: () => 0, onRetry, sleep });
```

**Success on the first try**

```ts
// inner: { text: "ok", ... }
await client.complete(req);   // → { text: "ok", ... }  (1 call, no waits)
```

**Retry after errors**

```ts
// attempt 1: LLMProviderError 503           → onRetry({ attempt: 1, delayMs: 100, error }), sleep(100)
// attempt 2: no answer within timeoutMs     → abort its signal, onRetry({ attempt: 2, delayMs: 200, error: LLMTimeoutError }), sleep(200)
// attempt 3: { text: "ok" }
await client.complete(req);   // → { text: "ok", ... }
```

**retryAfterMs**

```ts
// attempt 1: LLMProviderError 429, retryAfterMs = 750   → sleep(750), then retry
// attempt 1: LLMProviderError 429, retryAfterMs = 60000 → throws that 429 error (60000 > maxDelayMs)
```

**Error that is not retried**

```ts
// attempt 1: LLMProviderError 401
await client.complete(req);   // → throws the same 401 error, 1 call total
```

**All attempts fail**

```ts
// attempts 1, 2, 3: LLMProviderError 500
await client.complete(req);   // → throws RetryExhaustedError { attempts: 3, lastError: <the 3rd 500 error> }
```

**Caller cancels**

```ts
const ctrl = new AbortController();
const p = client.complete({ ...req, signal: ctrl.signal });
ctrl.abort();                 // during an attempt or during a wait
await p;                      // → throws RequestAbortedError, and inner is not called again
```

## Rules

- You may use any npm package.
- Edit only `task2.ts`. Do not change the tests.
