# LLM Evaluation Suite with a CI Regression Gate

**Task ID:** AIOPS-004 · **Level:** 2 · **File:** `src/ai-production/task4/task4.ts` · **Tests:** `npm run test:aiops:4`

Build a small evaluation framework. It has scorers (exact match, keywords, JSON schema, LLM judge), a suite runner with concurrency and timeouts, and a gate that fails CI when quality drops.

## Scorers

Each scorer is `{ name, threshold, score({ case, output }) → Promise<number | null> }`. `null` means "could not score".

| Function | `name` | `threshold` | Score |
| -------- | ------ | ----------- | ----- |
| `exactMatch({ caseSensitive = false, trim = true } = {})` | `exact_match` | `1` | `1` if `output` equals `case.expected` (after optional trim and lower-casing), else `0`. `null` if there is no `expected`. |
| `containsAll(keywords)` | `contains_all` | `1` | Share of keywords found in `output`, ignoring case. `1` if the list is empty. `keywords` is an array, or a function `(case) => string[]`. |
| `jsonSchema(zodSchema)` | `json_schema` | `1` | `1` if `JSON.parse(output)` passes the Zod schema, else `0` |
| `llmJudge({ judge, rubric, model = "judge-model", threshold = 0.75 })` | `llm_judge` | `threshold` | See below |

**`llmJudge`:** call `judge.complete` once with:
- `model` and `temperature: 0`;
- a `system` message containing the `rubric`;
- a `user` message containing the case input, `expected` (if any) and the output.

The judge replies `{ "score": <integer 1–5>, "reason": "..." }`. Return `(score - 1) / 4`. If the reply is invalid or the judge throws, return `null`.

## `runEvalSuite({ cases, target, scorers, concurrency, timeoutMs, now = Date.now })`

- `cases = [{ id, input, expected?, tags? }]`
- `target(input, signal)` returns `Promise<string>`.

| Step | Action |
| ---- | ------ |
| 1 | Run `target(case.input, signal)` for each case, at most `concurrency` at a time |
| 2 | If it takes longer than `timeoutMs`, abort its signal; the error is `Timed out after <timeoutMs> ms`. If it throws, the error is its message. |
| 3 | If the target worked, run every scorer (a scorer that throws gives `null`). If the target failed, every score is `null` and no scorer runs. |

**Return:**

```ts
{
  results: [{ caseId, output /* or null */, error /* or null */, durationMs /* via now() */, scores: { [scorerName]: number | null } }],   // input order
  summary: { [scorerName]: { mean, passRate, scored, errors } },
  byTag:   { [tag]: { [scorerName]: { mean, passRate } } },
  errorRate,   // failed targets / number of cases (0 if there are no cases)
}
```

| Summary field | Meaning |
| ------------- | ------- |
| `mean` | Average of the non-null scores (`null` if there are none) |
| `passRate` | Cases with `score >= threshold`, divided by **all** cases |
| `scored` | Number of non-null scores |
| `errors` | Number of `null` scores where the target worked |

## `checkRegression(report, baseline, gate)` → `{ passed, failures }`

1. For each scorer in `baseline.summary`, A→Z:
   - missing from `report.summary`, or its mean is `null` → add `"<scorer>.missing"`;
   - otherwise, if `baselineMean - currentMean > (gate.maxMeanDrop[scorer] ?? 0) + 1e-9` → add `"<scorer>.mean"`.
2. If `report.errorRate > gate.maxErrorRate`, add `"errorRate"`.
3. `passed = failures.length === 0`.

## Examples

**Scorers**

```ts
await exactMatch().score({ case: { id: "1", input: "?", expected: "Paris" }, output: " paris " });   // → 1
await containsAll(["refund", "14 days"]).score({ case, output: "Refunds take 14 days" });            // → 1
await containsAll(["refund", "30 days"]).score({ case, output: "Refunds take 14 days" });            // → 0.5
await jsonSchema(z.object({ ok: z.boolean() })).score({ case, output: '{"ok":true}' });             // → 1
// judge replies { "score": 4, "reason": "good" }
await llmJudge({ judge, rubric: "Is it correct?" }).score({ case, output: "..." });                  // → 0.75
```

**Suite**

```ts
const report = await runEvalSuite({
  cases: [
    { id: "c1", input: "Capital of France?", expected: "Paris", tags: ["geo"] },
    { id: "c2", input: "2+2?", expected: "4", tags: ["math"] },
    { id: "c3", input: "Slow question", expected: "x" },
  ],
  target,                     // c1 → " paris ", c2 → "5", c3 never answers
  scorers: [exactMatch()],
  concurrency: 2,
  timeoutMs: 50,
});
// → { results: [
//       { caseId: "c1", output: " paris ", error: null, durationMs: ..., scores: { exact_match: 1 } },
//       { caseId: "c2", output: "5",       error: null, durationMs: ..., scores: { exact_match: 0 } },
//       { caseId: "c3", output: null, error: "Timed out after 50 ms", durationMs: ..., scores: { exact_match: null } } ],
//     summary: { exact_match: { mean: 0.5, passRate: 1/3, scored: 2, errors: 0 } },
//     byTag: { geo: { exact_match: { mean: 1, passRate: 1 } }, math: { exact_match: { mean: 0, passRate: 0 } } },
//     errorRate: 1/3 }
```

**Gate**

```ts
checkRegression(report, { summary: { exact_match: { mean: 0.9 } }, errorRate: 0 },
                { maxMeanDrop: { exact_match: 0.1 }, maxErrorRate: 0.05 });
// mean dropped 0.4 > 0.1, and errorRate 0.33 > 0.05
// → { passed: false, failures: ["exact_match.mean", "errorRate"] }
```

## Rules

- You may use any npm package (`zod` is installed).
- Edit only `task4.ts`. Do not change the tests.
