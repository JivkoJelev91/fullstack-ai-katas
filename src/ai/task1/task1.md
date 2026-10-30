# Support Ticket Triage with an LLM

**Task ID:** AI-001 · **Level:** 1–2 · **File:** `src/ai/task1/task1.ts` · **Tests:** `npm run test:ai:1`

Send a support ticket to an LLM. The LLM answers with JSON (category, priority, summary, needsHuman). Check the answer, retry once if it is bad, and apply two business rules.

## What you export

```ts
export async function triageTicket(
  ticket: { subject: string; body: string; customerTier: "free" | "pro" | "enterprise" },
  deps: { llm: LLMClient; model?: string },
): Promise<TriageResult>;
```

The types, error classes and `DEFAULT_TRIAGE_MODEL` are already in the starter file. Call the model with `await deps.llm.complete(request)` (see `src/ai/shared/llm.ts`). The tests use a fake LLM, so you don't need an API key.

## Steps

**1. Validate the ticket.** If it is invalid, throw `new TicketValidationError(fieldName, message)` and don't call the LLM.

| Field          | Rule                                 |
| -------------- | ------------------------------------ |
| `subject`      | 1–200 characters after trimming      |
| `body`         | 1–5000 characters after trimming     |
| `customerTier` | `free`, `pro` or `enterprise`        |

**2. Call the LLM** with:

| Request field | Value |
| ------------- | ----- |
| `model`       | `deps.model ?? DEFAULT_TRIAGE_MODEL` |
| `temperature` | `0` |
| `maxTokens`   | any number from 1 to 500 |
| `messages`    | `[{ role: "system", content: <your instructions> }, { role: "user", content: <trimmed subject + trimmed body + tier> }]` |

The ticket text goes only in the `user` message, never in the `system` message.

**3. Check the answer.** `response.text` must be one JSON object, either plain or inside one ```` ```json ```` fence. Extra whitespace around it is fine, but any other text makes it invalid.

| JSON field   | Rule |
| ------------ | ---- |
| `category`   | `billing`, `bug`, `feature_request`, `account` or `other` |
| `priority`   | `low`, `medium`, `high` or `urgent` |
| `summary`    | string, 1–280 characters after trimming (return it trimmed) |
| `needsHuman` | boolean |

Other JSON fields are dropped. If `response.stopReason` is `"max_tokens"`, the answer is invalid.

**4. Retry once if the answer is invalid.** Call the LLM again with the same request, plus two more messages:

```ts
[...firstMessages,
 { role: "assistant", content: <the invalid text exactly> },
 { role: "user", content: <why it was invalid> }]
```

If the second answer is also invalid, throw `new TriageOutputError(message, 2)`. If `llm.complete` itself throws, don't retry: let the error pass through unchanged.

**5. Apply the business rules** (they override the LLM):

| Tier         | Rule |
| ------------ | ---- |
| `enterprise` | If priority is `high` or `urgent`, set `needsHuman: true` |
| `free`       | If priority is `urgent`, change it to `high` |

**6. Return** `{ category, priority, summary, needsHuman, attempts, usage }`. `attempts` is the number of LLM calls. `usage` is the sum of `inputTokens` and `outputTokens` over all calls.

## Examples

**Valid answer on the first try**

```ts
await triageTicket({ subject: "Charged twice", body: "Billed two times for March.", customerTier: "enterprise" }, { llm });

// LLM returns (text):
// ```json
// { "category": "billing", "priority": "high", "summary": "Double charge for March.", "needsHuman": false, "confidence": 0.9 }
// ```
// usage: { inputTokens: 100, outputTokens: 20 }

// → { category: "billing", priority: "high", summary: "Double charge for March.",
//     needsHuman: true,          // enterprise + high
//     attempts: 1, usage: { inputTokens: 100, outputTokens: 20 } }
```

**Free tier with urgent priority**

```ts
// LLM returns: { "category": "bug", "priority": "urgent", "summary": "App crashes.", "needsHuman": false }
// → { category: "bug", priority: "high", summary: "App crashes.", needsHuman: false, attempts: 1, usage: {...} }
```

**Invalid first answer, valid second**

```ts
// 1st LLM text: Sure! Here it is: { "category": "billing", ... }     ← text around the JSON, so invalid
// 2nd LLM text: { "category": "billing", "priority": "low", "summary": "Refund question.", "needsHuman": false }
// → { category: "billing", priority: "low", summary: "Refund question.", needsHuman: false,
//     attempts: 2, usage: { inputTokens: 200, outputTokens: 40 } }    ← sum of both calls
```

**Two invalid answers**

```ts
// 1st and 2nd LLM text: "I cannot help with that"
// → throws TriageOutputError (attempts = 2)
```

**Invalid ticket**

```ts
await triageTicket({ subject: "   ", body: "x", customerTier: "pro" }, { llm });
// → throws TicketValidationError (field = "subject"), LLM not called
```

**LLM call fails**

```ts
// llm.complete throws LLMProviderError("rate limited", 429)
// → the same LLMProviderError is thrown, with no retry
```

## Rules

- You may use any npm package (`zod` is installed).
- Don't call a real LLM. Use only `deps.llm`.
- Edit only `task1.ts`. Do not change the tests.
