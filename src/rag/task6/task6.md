# RAG Evaluation: Retrieval Metrics, Faithfulness, Regression Gate

**Task ID:** RAG-006 · **Level:** 2–3 · **File:** `src/rag/task6/task6.ts` · **Tests:** `npm run test:rag:6`

Write three functions for measuring RAG quality:
- **A.** Retrieval metrics (recall, precision, MRR, nDCG).
- **B.** An LLM judge that checks whether answers are backed by their context.
- **C.** A comparison with a baseline that fails on regressions.

The types and `DEFAULT_JUDGE_MODEL` are already in the starter file.

## Part A: `evaluateRetrieval(golden, runs, k)`

- `golden = [{ queryId, relevance: { docId: grade } }]`, where grade `> 0` means relevant.
- `runs = [{ queryId, retrievedIds }]`

**For each golden query:**

| Case | Action |
| ---- | ------ |
| No doc with grade > 0 | Add to `skippedQueries`, and leave it out of `perQuery` and the means |
| No run for it | Add to `missingQueries`, and score 0 on every metric (it still counts in the means) |
| Otherwise | Remove duplicates from `retrievedIds` (keep the first), keep the first `k` (= `topK`), then compute: |

| Metric      | Formula |
| ----------- | ------- |
| `recall`    | `(relevant docs in topK) / (number of relevant docs)` |
| `precision` | `(relevant docs in topK) / k` (always divide by `k`) |
| `mrr`       | `1 / rank` of the first relevant doc in topK (rank starts at 1), else `0` |
| `ndcg`      | `DCG / IDCG` |

```
DCG  = sum over positions i = 1..topK.length of (2^grade(i) - 1) / log2(i + 1)      // grade 0 if not labelled
IDCG = the same formula over the query's grades sorted high → low, first k only
```

Ignore runs for unknown query ids. **Return** `{ k, perQuery, mean, missingQueries, skippedQueries }`. `perQuery` is in golden order. `mean` is the average of each metric over the queries in `perQuery`, or all zeros if there are none.

## Part B: `evaluateFaithfulness(cases, judge, { concurrency, model? })`

- `cases = [{ caseId, question, answer, contexts: string[] }]`
- For each case, call `judge.complete` once with:
  - `model`: `model ?? DEFAULT_JUDGE_MODEL`
  - `temperature: 0`
  - `messages`: a `system` message with your instructions, then a `user` message with the question, the answer and every context.
- At most `concurrency` calls may run at the same time. Return results in input order.
- The judge replies with JSON (plain or fenced): `{ "claims": [{ "claim": string, "supported": boolean }] }`.

| Judge result | Case result |
| ------------ | ----------- |
| Valid JSON | `{ caseId, status: "scored", score: supported / total (1 if there are no claims), unsupportedClaims: [texts of unsupported claims] }` |
| Throws or invalid JSON | `{ caseId, status: "judge_error", score: null, unsupportedClaims: [] }` (no retry, other cases continue) |

**Return** `{ perCase, meanScore, judgeErrors }`. `meanScore` is the average over scored cases, or `null` if none were scored. `judgeErrors` is the count of failed cases.

## Part C: `compareToBaseline(current, baseline, tolerances)`

For each metric in `baseline`, in A→Z order:

| Case | Result |
| ---- | ------ |
| Missing from `current` | regression `{ metric, baseline, current: null, drop: null }` |
| `baseline - current > (tolerances[metric] ?? 0) + 1e-9` | regression `{ metric, baseline, current, drop: baseline - current }` |
| `current > baseline` | add `metric` to `improvements` |

Ignore metrics that are only in `current`. **Return** `{ passed: regressions.length === 0, regressions, improvements }`.

## Examples

**Part A**

```ts
evaluateRetrieval(
  [ { queryId: "q1", relevance: { a: 3, b: 1 } }, { queryId: "q2", relevance: { c: 1 } }, { queryId: "q3", relevance: { z: 0 } } ],
  [ { queryId: "q1", retrievedIds: ["a", "x", "b", "a"] }, { queryId: "q2", retrievedIds: ["x", "y", "c"] } ],
  3,
);
// → { k: 3,
//     perQuery: [
//       { queryId: "q1", recall: 1, precision: 2/3, mrr: 1,   ndcg: (7 + 1/2) / (7 + 1/log2(3)) },   // ≈ 0.9828
//       { queryId: "q2", recall: 1, precision: 1/3, mrr: 1/3, ndcg: 0.5 } ],
//     mean: { recall: 1, precision: 0.5, mrr: 2/3, ndcg: ≈0.7414 },
//     missingQueries: [], skippedQueries: ["q3"] }
```

**Part B**

```ts
await evaluateFaithfulness(
  [ { caseId: "c1", question: "Leave?", answer: "25 days, expires in March.", contexts: ["25 days of leave per year."] },
    { caseId: "c2", question: "Remote?", answer: "Two days.", contexts: ["Remote work two days a week."] } ],
  judge, { concurrency: 2 },
);
// judge for c1: { "claims": [ { "claim": "25 days", "supported": true }, { "claim": "expires in March", "supported": false } ] }
// judge for c2: throws
// → { perCase: [
//       { caseId: "c1", status: "scored", score: 0.5, unsupportedClaims: ["expires in March"] },
//       { caseId: "c2", status: "judge_error", score: null, unsupportedClaims: [] } ],
//     meanScore: 0.5, judgeErrors: 1 }
```

**Part C**

```ts
compareToBaseline({ recall: 0.80, ndcg: 0.70 }, { recall: 0.82, ndcg: 0.69, mrr: 0.5 }, { recall: 0.02 });
// recall drop 0.02 ≤ tolerance 0.02 → ok;  ndcg improved;  mrr missing → regression
// → { passed: false,
//     regressions: [ { metric: "mrr", baseline: 0.5, current: null, drop: null } ],
//     improvements: ["ndcg"] }
```

## Rules

- You may use any npm package.
- Edit only `task6.ts`. Do not change the tests.
