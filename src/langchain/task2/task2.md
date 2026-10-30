# Tenant Retriever and Conversational RAG Chain

**Task ID:** LC-002 · **Level:** 2 · **File:** `src/langchain/task2/task2.ts` · **Tests:** `npm run test:langchain:2`

There are two parts:
- **A.** A custom LangChain retriever that only searches one tenant's data.
- **B.** A chat chain that rewrites follow-up questions, retrieves documents and answers.

The types and `NO_ANSWER` are already in the starter file. The tests use a fake chat model.

## Part A: `class TenantRetriever extends BaseRetriever`

```ts
new TenantRetriever({ search, tenantId, k = 4, minScore = 0 })
// search(query, { tenantId, k }) → Promise<Array<{ id, text, score, source }>>
```

Set `lc_namespace` to any non-empty array, e.g. `["coding-practice", "retrievers"]`.

**`_getRelevantDocuments(query)`** (called by `retriever.invoke(query)`):

| Step | Action |
| ---- | ------ |
| 1 | Trim `query`. If it's blank, return `[]` and don't call `search`. |
| 2 | Call `search(trimmedQuery, { tenantId, k })` once. |
| 3 | Keep hits with `score >= minScore`, sort by score descending (keep the original order on a tie), and drop repeated `id`s (keep the first). |
| 4 | Return at most `k` items as `new Document({ pageContent: text, metadata: { id, source, score } })`. |

## Part B: `createConversationalRagChain({ model, retriever })`

Returns a `Runnable` with input `{ question, history }` (`history` is a list of LangChain messages) and output `{ answer, standaloneQuestion, sources }`.

| Step | Action |
| ---- | ------ |
| 1. Validate | Trim `question`. If it's blank, throw `ValidationError` (from `src/shared/errors.ts`). |
| 2. Rewrite | If `history` is empty, `standaloneQuestion` = the question, with **no** model call. Otherwise call the model once with `[SystemMessage(rewrite instructions), ...history, HumanMessage(question)]`. The trimmed reply is the standalone question; if it's empty, use the original question. |
| 3. Retrieve | `await retriever.invoke(standaloneQuestion)` once. |
| 4. No docs | If there are no documents, return `{ answer: NO_ANSWER, standaloneQuestion, sources: [] }` with no answer call. |
| 5. Answer | Call the model once with `[SystemMessage(answer instructions), HumanMessage(standalone question + each doc as "[<source>] <pageContent>")]`. Don't put document text in the system message, and don't send the history. |
| 6. Return | `answer` = the trimmed reply. `sources` = the unique `metadata.source` values, in document order. |

## Examples

**Part A**

```ts
const retriever = new TenantRetriever({ search, tenantId: "acme", k: 2, minScore: 0.5 });
// search returns: [ { id: "a", text: "A", score: 0.6, source: "a.md" },
//                   { id: "b", text: "B", score: 0.9, source: "b.md" },
//                   { id: "b", text: "B", score: 0.9, source: "b.md" },
//                   { id: "c", text: "C", score: 0.2, source: "c.md" } ]
await retriever.invoke("  refunds  ");
// search called with ("refunds", { tenantId: "acme", k: 2 })
// → [ Document { pageContent: "B", metadata: { id: "b", source: "b.md", score: 0.9 } },
//     Document { pageContent: "A", metadata: { id: "a", source: "a.md", score: 0.6 } } ]

await retriever.invoke("   ");   // → [] (search not called)
```

**Part B: first question (no history)**

```ts
await chain.invoke({ question: "Can I get a refund?", history: [] });
// no rewrite call
// retriever.invoke("Can I get a refund?")
// model answer → "Yes, within 30 days."
// → { answer: "Yes, within 30 days.", standaloneQuestion: "Can I get a refund?", sources: ["refund-policy.md"] }
```

**Part B: follow-up question**

```ts
await chain.invoke({
  question: "and how long does it take?",
  history: [new HumanMessage("Can I get a refund?"), new AIMessage("Yes, within 30 days of purchase.")],
});
// model call 1 (rewrite) → "How long does a refund take?"
// retriever.invoke("How long does a refund take?")
// model call 2 (answer)  → "Refunds are processed within 5 business days."
// → { answer: "Refunds are processed within 5 business days.",
//     standaloneQuestion: "How long does a refund take?", sources: ["refund-policy.md"] }
```

**Part B: nothing found**

```ts
// → { answer: "I don't know based on the available documents.", standaloneQuestion: "...", sources: [] }
```

**Part B: blank question**

```ts
await chain.invoke({ question: "  ", history: [] });   // → throws ValidationError
```

## Rules

- Use LangChain (`@langchain/core` is installed).
- Edit only `task2.ts`. Do not change the tests.
