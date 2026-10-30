# Fine-Tuning Job Orchestration and Promotion Gate

**Task ID:** FT-004 · **Level:** 2–3 · **File:** `src/fine-tuning/task4/task4.ts` · **Tests:** `npm run test:ft:4`

There are two parts:
- **A.** Submit a fine-tuning job without creating duplicates, poll it until it finishes, and handle errors, a deadline and cancellation.
- **B.** Compare the new model with the current one and move the production alias only when it's better.

The types and error classes are already in the starter file. The tests use a fake provider.

## Part A: `runFineTuning(provider, spec, options)`

- `provider`: `uploadFile(name, content)`, `findJobByIdempotencyKey(key)`, `createJob(input)`, `getJob(id)`, `cancelJob(id)`. A job is `{ id, status, fineTunedModel?, error? }`.
- `spec`: `{ baseModel, suffix, trainJsonl, validationJsonl, hyperparameters: { nEpochs, learningRateMultiplier, batchSize } }`
- `options`: `{ sleep(ms), now(), pollIntervalMs, maxWaitMs, signal? }`

| Step | Action |
| ---- | ------ |
| 1 | If `signal` is already aborted, throw `new FineTuneAbortedError(null)` and don't call the provider |
| 2 | `key` = first 32 hex characters of `sha256(JSON.stringify([baseModel, suffix, nEpochs, learningRateMultiplier, batchSize, trainJsonl, validationJsonl]))` |
| 3 | `existing = await findJobByIdempotencyKey(key)`. If it exists and its status isn't `failed` or `cancelled`, **reuse** it (`reused: true`, no uploads, no new job). |
| 4 | Otherwise: `uploadFile("train.jsonl", trainJsonl)`, then `uploadFile("validation.jsonl", validationJsonl)` only if it isn't empty, then `createJob({ trainingFileId, validationFileId /* or null */, baseModel, suffix, hyperparameters, idempotencyKey: key })` |
| 5 | Poll: `start = now()`. While the status isn't final (`succeeded`, `failed`, `cancelled`): check the deadline, `await sleep(pollIntervalMs)`, check the signal, then `job = await getJob(id)` |

**While polling:**

| Situation | Action |
| --------- | ------ |
| `now() - start >= maxWaitMs` (checked after each unfinished poll, before sleeping) | `cancelJob(id)`, throw `new FineTuneTimeoutError(id)` |
| `signal` aborted (checked after each sleep) | `cancelJob(id)`, throw `new FineTuneAbortedError(id)` |
| `getJob` throws `LLMProviderError` with status `429` or `>= 500` | Ignore it and keep polling. After **3 in a row**, throw the last one. A successful `getJob` resets the count. |
| `getJob` throws anything else | Throw it right away |

**Final status:**

| Status | Result |
| ------ | ------ |
| `succeeded` | return `{ jobId, model: job.fineTunedModel, reused }` |
| `failed` | throw `new FineTuneFailedError(jobId, job.error)` |
| `cancelled` | throw `new FineTuneFailedError(jobId, "cancelled")` |

## Part B: `evaluateAndPromote(input)`

`input`: `{ candidateModel, baselineModel, cases: [{ id, input, expected }], runModel(model, input), score(output, expected) → 0..1, registry: { getAlias, setAlias }, alias, gate: { minScore, minImprovement, maxRegressionRate } }`

| Step | Action |
| ---- | ------ |
| 1 | For each case, run both models and score both outputs |
| 2 | `candidateScore` and `baselineScore` = the average scores |
| 3 | `regressions` = ids of cases where the candidate scored **lower** than the baseline. `regressionRate = regressions.length / cases.length` |
| 4 | Reasons, in order: `below_min_score` if `candidateScore < minScore`; `insufficient_improvement` if `candidateScore - baselineScore < minImprovement - 1e-9`; `too_many_regressions` if `regressionRate > maxRegressionRate` |
| 5 | `previousModel = await registry.getAlias(alias)`. If there are no reasons, `await registry.setAlias(alias, candidateModel)`. |

**Return** `{ promoted, candidateScore, baselineScore, regressions, regressionRate, previousModel, reasons }`.

## Examples

**Part A: new job**

```ts
await runFineTuning(provider, {
  baseModel: "base-8b", suffix: "support-v3", trainJsonl, validationJsonl,
  hyperparameters: { nEpochs: 3, learningRateMultiplier: 1, batchSize: 16 },
}, { sleep, now, pollIntervalMs: 60_000, maxWaitMs: 6 * 3_600_000 });
// findJobByIdempotencyKey → null
// uploadFile("train.jsonl") → file-1, uploadFile("validation.jsonl") → file-2
// createJob → { id: "ftjob-1", status: "queued" }
// getJob → running → (throws 503, ignored) → succeeded, fineTunedModel "ft:base-8b:support-v3:abc"
// → { jobId: "ftjob-1", model: "ft:base-8b:support-v3:abc", reused: false }
```

**Part A: same spec again**

```ts
// findJobByIdempotencyKey → { id: "ftjob-1", status: "succeeded", fineTunedModel: "ft:...:abc" }
// → { jobId: "ftjob-1", model: "ft:...:abc", reused: true }   (no uploads, no createJob, no polling)
```

**Part A: errors**

```ts
// job ends as { status: "failed", error: "invalid training file" }
// → throws FineTuneFailedError { jobId: "ftjob-1", message: "invalid training file" }

// still running after maxWaitMs → cancelJob("ftjob-1"), throws FineTuneTimeoutError { jobId: "ftjob-1" }
// getJob throws 503 three times in a row → throws that 503 LLMProviderError
```

**Part B**

```ts
await evaluateAndPromote({
  candidateModel: "ft:base-8b:support-v3:abc", baselineModel: "ft:base-8b:support-v2:xyz",
  cases, runModel, score, registry, alias: "support-prod",
  gate: { minScore: 0.8, minImprovement: 0.02, maxRegressionRate: 0.1 },
});
// → { promoted: true, candidateScore: 0.87, baselineScore: 0.82, regressions: ["c7"], regressionRate: 0.05,
//     previousModel: "ft:base-8b:support-v2:xyz", reasons: [] }
// registry.setAlias("support-prod", "ft:base-8b:support-v3:abc") was called

// a worse candidate:
// → { promoted: false, candidateScore: 0.7, baselineScore: 0.82, regressions: [...], regressionRate: 0.4,
//     previousModel: "...", reasons: ["below_min_score", "insufficient_improvement", "too_many_regressions"] }
// setAlias not called
```

## Rules

- You may use any npm package.
- Edit only `task4.ts`. Do not change the tests.
