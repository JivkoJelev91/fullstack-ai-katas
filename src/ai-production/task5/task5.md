# Canary and Shadow Rollout for a New Model

**Task ID:** AIOPS-005 · **Level:** 3 · **File:** `src/ai-production/task5/task5.ts` · **Tests:** `npm run test:aiops:5`

Roll out a new model (the **canary**) to a share of users next to the current model (**stable**). Watch error rate, latency and user feedback, and either roll back automatically or promote the canary.

## What you export

```ts
export function createRolloutController(options: {
  rolloutId: string; stable: { name, client }; canary: { name, client }; percent: number;
  thresholds: { minSamples, maxErrorRateDelta, maxP95LatencyMs, maxNegativeFeedbackRate };
  mode?: "canary" | "shadow"; windowMs?: number; now?: () => number; generateId?: () => string;
}): RolloutController;
```

Defaults: `mode: "canary"`, `windowMs: 3600000`, `now: Date.now`, `generateId: randomUUID`. The types and `PromotionError` are already in the starter file.

## Methods

### `assign(userId)` → `"stable"` | `"canary"`

```
bucket = first 4 bytes of sha256("<rolloutId>:<userId>") read as an unsigned big-endian int, % 10000
canary if bucket < percent * 100
```

Return `"canary"` only in `canary` mode while the state is `running`. After a rollback it's always `"stable"`, after promotion always `"canary"`, and in `shadow` mode always `"stable"`.

### `complete(userId, request)` → `{ ...response, variant, requestId, fallback }`

| Situation | Action | Returns |
| --------- | ------ | ------- |
| The assigned client works | Record a sample | `variant: <assigned>`, `fallback: false` |
| The canary throws | Record a failed canary sample, then call stable and record its sample | `variant: "stable"`, `fallback: true` |
| Stable throws | Record a failed stable sample and rethrow the error | (throws) |
| `shadow` mode | Stable answers the caller. The canary gets the same request **in the background**: don't wait for it, ignore its errors, and record its sample when it finishes. | `variant: "stable"`, `fallback: false` |

- A sample is `{ variant, ok, latencyMs /* via now() */, at: now() }`.
- `requestId` comes from `generateId()`.
- `flushShadow()` resolves once every background canary call has finished.

### `feedback(requestId, positive)`

Record feedback for the variant that **actually answered** (for a fallback, that's stable). If the `requestId` is unknown, throw `RangeError`.

### `stats(variant)`

Only count samples and feedback with `at > now() - windowMs`.

| Field | Value |
| ----- | ----- |
| `requests` | number of samples |
| `errors` | failed samples |
| `errorRate` | `errors / requests` (`0` if there are no requests) |
| `p95LatencyMs` | nearest rank over **successful** samples: `sorted[Math.ceil(0.95 * n) - 1]` (`null` if there are none) |
| `feedbackCount`, `negativeFeedback` | counts |

### `evaluate()`

| Situation | Result |
| --------- | ------ |
| The state is not `running` | `{ state, decision: state, reasons: [] }` (nothing changes) |
| Fewer than `minSamples` canary samples | `{ state: "running", decision: "insufficient_data", reasons: [] }` |
| Otherwise, collect reasons (in this order): `"error_rate"` if `canary.errorRate - stable.errorRate > maxErrorRateDelta`; `"latency"` if `canary.p95LatencyMs > maxP95LatencyMs`; `"feedback"` if `canary.negativeFeedback / canary.feedbackCount > maxNegativeFeedbackRate` (0 if there is no feedback) | |
| There are reasons | The state becomes `rolled_back` → `{ state: "rolled_back", decision: "rolled_back", reasons }` |
| No reasons | `{ state: "running", decision: "healthy", reasons: [] }` |

### `promote()`

Run `evaluate()`. If the decision is `"healthy"`, the state becomes `promoted`. Otherwise throw `new PromotionError(decision, reasons)`. Also throw `PromotionError` in `shadow` mode or after the rollout has ended.

### `state()` → `"running"` | `"promoted"` | `"rolled_back"`

## Examples

```ts
const rollout = createRolloutController({
  rolloutId: "answer-model-v2", percent: 10,
  stable: { name: "v1", client: v1 }, canary: { name: "v2", client: v2 },
  thresholds: { minSamples: 50, maxErrorRateDelta: 0.02, maxP95LatencyMs: 4000, maxNegativeFeedbackRate: 0.3 },
});
```

**Assign and serve**

```ts
rollout.assign("user-42");                          // → "canary" (always the same for this user and rollout)
await rollout.complete("user-42", request);
// → { text: "...", usage: {...}, stopReason: "end", variant: "canary", requestId: "r-1", fallback: false }
```

**Canary fails**

```ts
// v2 throws
await rollout.complete("user-42", request);
// → { text: <from v1>, ..., variant: "stable", requestId: "r-2", fallback: true }
```

**Feedback and stats**

```ts
rollout.feedback("r-1", false);
rollout.stats("canary");
// → { requests: 2, errors: 1, errorRate: 0.5, p95LatencyMs: 120, feedbackCount: 1, negativeFeedback: 1 }
```

**Evaluate**

```ts
rollout.evaluate();   // fewer than 50 canary samples
// → { state: "running", decision: "insufficient_data", reasons: [] }

rollout.evaluate();   // later: canary error rate 10%, stable 1%
// → { state: "rolled_back", decision: "rolled_back", reasons: ["error_rate"] }
rollout.assign("user-42");   // → "stable" from now on
```

**Promote**

```ts
rollout.promote();    // when healthy → state() === "promoted", every user gets "canary"
rollout.promote();    // when not healthy → throws PromotionError { decision: "insufficient_data", reasons: [] }
```

## Rules

- You may use any npm package.
- Edit only `task5.ts`. Do not change the tests.
