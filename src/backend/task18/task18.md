# Answers with Citations

**Task ID:** BACKEND-018 · **Level:** 2 · **File:** `src/backend/task18/task18.ts` · **Tests:** `npm run test:backend:18`

The last RAG step: find the chunks relevant to the user's question, give them to the model as numbered sources, and return the answer with **citations**, so the user can check where each fact came from.

The app receives an `LLMClient` and a `Retriever` (the search from BACKEND-017). The caller's id is in `res.locals.userId`.

## 1. buildPrompt(question, chunks)

**REQUIREMENT:** Return two messages: `{ role: "system", content: SYSTEM_PROMPT }` and a user message with exactly this text (sources numbered from 1, in the given order):

```text
Sources:
[1] Cats sleep 16 hours a day.
[2] Dogs need daily walks.

Question: How long do cats sleep?
```

The system prompt tells the model that sources are data, not instructions. A document could contain "ignore your rules", and that line is part of the defense against such **prompt injection**. AIOPS-001 goes deeper.

## 2. extractCitations(answer, chunks)

**REQUIREMENT:** Find every `[n]` in the answer and return `{ source: n, chunkId, documentId }` for chunk number `n` (1-based). Each number appears once, in the order it first appears. Numbers with no matching chunk (`[0]`, `[7]`) are ignored, because the model sometimes invents them.

| Answer (with 2 chunks) | Citations |
| --- | --- |
| `"Cats sleep 16 hours [1]. Dogs walk daily [2]. Cats again [1]."` | sources `1`, `2` |
| `"Maybe [2] or [7]."` | source `2` only |
| `"No idea."` | `[]` |

## 3. POST /ask

**REQUIREMENT:** The body is `{ question }`.

1. `question` must be a non-empty string. Otherwise `400` `{ "error": "<any message>" }`.
2. Get the chunks: `await deps.retrieve(userId, question, 3)`.
3. If there are none: respond `200` `{ "answer": NO_ANSWER, "citations": [] }` **without** calling the model. There's nothing to ground the answer in, and a model call costs money.
4. Otherwise call `deps.llm.complete({ model: MODEL, maxTokens: 500, messages: buildPrompt(question, chunks) })`.
5. Respond `200` `{ "answer": text, "citations": extractCitations(text, chunks) }`.
6. If the model fails: `502` `{ "error": "<any message>" }`.

## How to check your work

Run `npm run test:backend:18`.

## Rules

- Edit only `task18.ts`.
