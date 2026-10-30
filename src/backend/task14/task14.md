# Usage and Budget Tracking

**Task ID:** BACKEND-014 · **Level:** 2 · **File:** `src/backend/task14/task14.ts` · **Tests:** `npm run test:backend:14`

LLM providers bill per **token** (roughly ¾ of a word), with different prices for input (what you send) and output (what the model writes). A real AI backend records every call's tokens and cost per user, and stops a user who reaches their budget before they cost more.

The app receives an `LLMClient` and `budgetUsd`, the maximum spend per user. The caller's id is in `res.locals.userId`.

## Cost formula

```text
cost = inputTokens × 0.5 / 1,000,000  +  outputTokens × 1.5 / 1,000,000
```

The prices are in `PRICE`. Example: 1000 input + 2000 output tokens = 0.0005 + 0.003 = **0.0035** USD.

## 1. POST /chat

**REQUIREMENT:**

1. `prompt` must be a non-empty string. Otherwise `400` `{ "error": "<any message>" }`.
2. **Budget check before the call:** if the user's `costUsd` so far is already **at or above** `budgetUsd`, respond `402` `{ "error": "<any message>" }` and don't call the model.
3. Call `deps.llm.complete({ model: MODEL, maxTokens: 500, messages: [{ role: "user", content: prompt }] })`.
4. Add to the user's usage: `requests + 1`, the tokens, and the cost of this call.
5. Respond `200` with `{ "text": <model text>, "costUsd": <cost of this call> }`.
6. If the model fails: `502` `{ "error": "<any message>" }`, and the usage doesn't change.

## 2. GET /usage

**REQUIREMENT:** Return the caller's totals: `{ "requests", "inputTokens", "outputTokens", "costUsd" }`. A user with no calls gets all zeros.

**Example:** `budgetUsd: 0.005`, every call uses 1000 input + 2000 output tokens (0.0035 USD)

| Request (as `u1`) | Output |
| --- | --- |
| `POST /chat` | `200` `{ "text": "…", "costUsd": 0.0035 }` (spent so far: 0.0035) |
| `POST /chat` | `200` (0.0035 < 0.005, so allowed; spent now: 0.007) |
| `POST /chat` | `402` (0.007 ≥ 0.005), the model is not called |
| `GET /usage` | `{ "requests": 2, "inputTokens": 2000, "outputTokens": 4000, "costUsd": 0.007 }` |

`402 Payment Required` is the usual status for "you are out of credit".

## How to check your work

Run `npm run test:backend:14`. Costs are compared with a small tolerance, because decimals like 0.0035 aren't exact in floating point.

## Rules

- Edit only `task14.ts`.
