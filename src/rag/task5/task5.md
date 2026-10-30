# Grounded Answers with Verified Citations

**Task ID:** RAG-005 · **Level:** 2–3 · **File:** `src/rag/task5/task5.ts` · **Tests:** `npm run test:rag:5`

Answer a question from retrieved chunks. The LLM must cite its sources, and your code checks that every quote really appears in the cited source.

## What you export

```ts
export async function answerWithCitations(
  question: string,
  deps: { retrieve(question: string): Promise<RetrievedChunk[]>; llm: LLMClient; model?: string },
  options: { minScore: number; maxContextChars: number },
): Promise<CitedAnswer>;
// RetrievedChunk = { chunkId, docId, title, url, text, score }
```

The types, `DEFAULT_ANSWER_MODEL` and `CitationValidationError` are already in the starter file.

## Steps

**1. Validate and retrieve.** Trim `question`. If it isn't 3–1000 characters, throw `ValidationError` (from `src/shared/errors.ts`). Otherwise call `deps.retrieve(trimmedQuestion)` once.

**2. Pick the context.**
- Keep chunks with `score >= minScore`, sorted by score descending (on a tie keep the original order).
- Skip a chunk whose trimmed text equals one you already picked.
- Add chunks in that order while the total `text` length stays `<= maxContextChars`. If a chunk doesn't fit, skip it and try the next one.
- If nothing is picked, return the **insufficient** result (below) without calling the LLM.

**3. Call the LLM.** The picked chunks are sources `1..n`.

| Request field | Value |
| ------------- | ----- |
| `model`       | `deps.model ?? DEFAULT_ANSWER_MODEL` |
| `temperature` | `0` |
| `maxTokens`   | 1–1000 |
| `messages`    | `[{ role: "system", content: <instructions, no source text> }, { role: "user", content: <question + sources> }]` |

In the user message, each source is a block that starts with `[<n>] <title>`, followed by its text.

**4. Check the answer.** The LLM text must be JSON (plain or in one ```` ```json ```` fence):

```json
{ "answer": "string with [n] markers", "citations": [{ "source": 1, "quote": "exact text" }], "insufficient": false }
```

- If `insufficient` is `true`, return the insufficient result.
- Otherwise the answer is **valid** only if all of these hold:

| Rule |
| ---- |
| `answer` is not blank and there is at least one citation |
| every `source` is a number from 1 to `n` |
| every `quote` appears in its source text (case-sensitive), after turning runs of whitespace into one space and trimming both |
| every `[k]` in `answer` is cited, and every cited source has a `[k]` in `answer` |
| `stopReason` is not `"max_tokens"` |

**5. Retry once if invalid.** Add `{ role: "assistant", content: <invalid text> }` and `{ role: "user", content: <what was wrong> }` to the messages and call again. If the second answer is also invalid, throw `new CitationValidationError(message, 2)`. If `llm.complete` itself throws, let the error pass through (no retry).

**6. Return.**

| Status | Result |
| ------ | ------ |
| answered | `{ status: "answered", answer: <trimmed>, citations, sources, attempts, usage }` |
| insufficient | `{ status: "insufficient_context", answer: null, citations: [], sources: [], attempts, usage }` (`attempts: 0` and zero usage if the LLM wasn't called) |

- `citations`: remove duplicates of the same `(source, quote)` pair, then add `chunkId, docId, title, url` from the source.
- `sources`: unique documents `{ docId, title, url }`, in order of first citation.
- `usage`: sum over all LLM calls. `attempts`: number of LLM calls.

## Examples

Retrieved chunks (`minScore: 0.5`, `maxContextChars: 2000`):

| # | chunkId | docId | title | url | text | score |
| - | ------- | ----- | ----- | --- | ---- | ----- |
| 1 | leave#0 | handbook-leave | Leave policy | https://hr/leave | Employees receive 25 days of paid leave per year. Unused days expire in March. | 0.9 |
| 2 | remote#0 | handbook-remote | Remote work | https://hr/remote | Remote work is allowed two days per week. | 0.7 |

**Valid answer**

```ts
// LLM text:
// { "answer": "You get 25 days of paid leave [1]; unused days expire in March [1].",
//   "citations": [ { "source": 1, "quote": "25 days of paid leave" }, { "source": 1, "quote": "Unused days expire in March" } ],
//   "insufficient": false }

// → { status: "answered",
//     answer: "You get 25 days of paid leave [1]; unused days expire in March [1].",
//     citations: [
//       { source: 1, quote: "25 days of paid leave", chunkId: "leave#0", docId: "handbook-leave", title: "Leave policy", url: "https://hr/leave" },
//       { source: 1, quote: "Unused days expire in March", chunkId: "leave#0", docId: "handbook-leave", title: "Leave policy", url: "https://hr/leave" } ],
//     sources: [ { docId: "handbook-leave", title: "Leave policy", url: "https://hr/leave" } ],
//     attempts: 1, usage: { inputTokens: 100, outputTokens: 20 } }
```

**Wrong quote, then a valid answer**

```ts
// 1st LLM text: { "answer": "30 days [1].", "citations": [{ "source": 1, "quote": "30 days of paid leave" }], "insufficient": false }
//               ← "30 days of paid leave" isn't in source 1, so it's invalid
// 2nd LLM text: the valid answer above
// → { status: "answered", ..., attempts: 2 }
```

**Nothing relevant retrieved** (all scores below `minScore`)

```ts
// → { status: "insufficient_context", answer: null, citations: [], sources: [], attempts: 0, usage: { inputTokens: 0, outputTokens: 0 } }
```

**LLM says it can't answer**

```ts
// LLM text: { "answer": "", "citations": [], "insufficient": true }
// → { status: "insufficient_context", answer: null, citations: [], sources: [], attempts: 1, usage: {...} }
```

**Two invalid answers**

```ts
// → throws CitationValidationError (attempts = 2)
```

**Bad question**

```ts
await answerWithCitations("hi", deps, options);   // → throws ValidationError, retrieve not called
```

## Rules

- You may use any npm package.
- Edit only `task5.ts`. Do not change the tests.
