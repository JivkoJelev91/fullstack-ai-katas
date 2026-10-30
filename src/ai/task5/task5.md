# Model Router with Fallbacks, Rate Limits and Budgets

**Task ID:** AI-005 · **Level:** 3 · **File:** `src/ai/task5/task5.ts` · **Tests:** `npm run test:ai:5`

Build a router that sends each LLM request to the first suitable route. It skips routes that are rate-limited or too expensive for the tenant's daily budget, and falls back to the next route when a call fails.

## What you export

```ts
export function createModelRouter(options: RouterOptions): ModelRouter;
// router.complete(tenantId, request) → Promise<RoutedResponse>
// request is a CompletionRequest without `model`
```

The types and error classes are already in the starter file.

## Options

| Option | Meaning |
| ------ | ------- |
| `routes` | Ordered list, best first. Each route: `{ id, model, client, pricing: { inputPerMTok, outputPerMTok }, limits: { requestsPerMinute, tokensPerMinute } }`. Prices are USD per 1 million tokens. `tokensPerMinute` is not used in this task. |
| `budget` | `{ store, dailyLimitUsd }`. `store.getSpent(tenantId, day)` and `store.addSpent(tenantId, day, usd)` |
| `now` | Clock, default `Date.now`. Use it for all time checks. |
| `estimateInputTokens` | Default: `Math.ceil(total characters of all message contents / 4)` |

`day` is the UTC date of `now()`, as `"YYYY-MM-DD"`.

## How `complete(tenantId, request)` works

Go through the routes in order. For each route, do the first matching row:

| Check | Outcome recorded | Then |
| ----- | ---------------- | ---- |
| The route is in cooldown (see 429 below) | `rate_limited` | Next route |
| The route already had `requestsPerMinute` calls in the last 60 seconds (`now - t < 60000`) | `rate_limited` | Next route |
| `spentToday + estimatedCost > dailyLimitUsd` | `skipped_budget` | Next route |
| Otherwise, call `route.client.complete({ ...request, model: route.model })` | see below | |

**Estimated cost** = `estimatedInputTokens × inputPerMTok / 1e6 + request.maxTokens × outputPerMTok / 1e6`

**Result of the call:**

| Result | Outcome recorded | Then |
| ------ | ---------------- | ---- |
| Success | `success` | Add the **actual cost** to the store with `addSpent`, then return |
| `LLMProviderError` with status `429` | `rate_limited` | Cooldown until `now + (retryAfterMs ?? 60000)`, then next route |
| `LLMProviderError` with status `408`, `500`, `502`, `503`, `504` or `529`, or an error with `name === "LLMTimeoutError"` | `error` | Next route |
| Any other error | none | Throw that same error right away |

**Actual cost** = `usage.inputTokens × inputPerMTok / 1e6 + usage.outputTokens × outputPerMTok / 1e6`

**Return value on success:** `{ ...providerResponse, routeId, model, costUsd, attempts }`, where `attempts` is a list of `{ routeId, outcome }` for every route you looked at, in order.

**When no route succeeds:**
- If every route was `skipped_budget`, throw `new BudgetExceededError(tenantId)`.
- Otherwise throw `new AllRoutesFailedError(attempts, lastError)`. `lastError` is `undefined` if no call threw.

## Examples

Routes: `primary` ($10 / $30 per M tokens, 2 requests per minute) and `backup` ($0.5 / $1.5 per M tokens). Daily limit is $1.00. Requests are 400 characters (100 estimated tokens) with `maxTokens: 100`.

**Normal**

```ts
await router.complete("acme", req);
// → { text: "from primary", usage: { inputTokens: 120, outputTokens: 50 }, stopReason: "end",
//     routeId: "primary", model: "primary-model", costUsd: 0.0027,      // 120×10/1e6 + 50×30/1e6
//     attempts: [ { routeId: "primary", outcome: "success" } ] }
```

**Third request within a minute**

```ts
// → { ..., routeId: "backup",
//     attempts: [ { routeId: "primary", outcome: "rate_limited" }, { routeId: "backup", outcome: "success" } ] }
```

**Primary fails with 503**

```ts
// → { ..., routeId: "backup",
//     attempts: [ { routeId: "primary", outcome: "error" }, { routeId: "backup", outcome: "success" } ] }
```

**Primary returns 429 with retryAfterMs = 30000**

```ts
// → backup answers. Primary is skipped (rate_limited) for the next 30 seconds.
```

**Primary returns 400**

```ts
// → throws the same LLMProviderError 400. Backup is not tried.
```

**Budget almost used up** (spent $0.9975; primary estimate is $0.004, backup estimate is $0.0002)

```ts
// → { ..., routeId: "backup",
//     attempts: [ { routeId: "primary", outcome: "skipped_budget" }, { routeId: "backup", outcome: "success" } ] }
```

**Budget fully used** (spent $1.00)

```ts
// → throws BudgetExceededError { tenantId: "acme" }
```

**Every route fails with 500**

```ts
// → throws AllRoutesFailedError { attempts: [ {primary, "error"}, {backup, "error"} ], lastError: <backup's 500 error> }
```

## Rules

- You may use any npm package.
- Edit only `task5.ts`. Do not change the tests.
