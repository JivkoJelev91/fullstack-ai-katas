# Chat Endpoint

**Task ID:** BACKEND-012 · **Level:** 2 · **File:** `src/backend/task12/task12.ts` · **Tests:** `npm run test:backend:12`

The core of every AI chat app: the user sends a message, the backend sends the **whole conversation** to the model (models have no memory between calls), saves the question and the answer, and returns the answer.

The app receives an `LLMClient` (`src/ai/shared/llm.ts`), which the tests replace with a fake model, and the starting conversations. The caller's id is in `res.locals.userId`.

## POST /conversations/:id/messages

**REQUIREMENT:**

1. **Validate:** `content` must be a non-empty string of at most 4000 characters. Otherwise `400` `{ "error": "<any message>" }`, without calling the model.
2. **Find** the conversation. If it doesn't exist or belongs to another user: `404` `{ "error": "<any message>" }`.
3. **Call the model** with `deps.llm.complete({ model: MODEL, maxTokens: MAX_TOKENS, messages })`, where `messages` is:
   - first `{ role: "system", content: SYSTEM_PROMPT }`,
   - then all saved messages of the conversation, oldest first,
   - last `{ role: "user", content }`.
4. **Save** both the user message and the assistant's answer (`{ role: "assistant", content: text }`) to the conversation, then respond `201` with `{ "reply": text }`.
5. If the model call fails: respond `502` `{ "error": "<any message>" }` and save **nothing**. A question without an answer would break the next request's history.

**Example:** conversation `c1` of `u1` already has one exchange

```http
POST /conversations/c1/messages
x-user-id: u1
{ "content": "And in winter?" }
```

The model receives:

```json
[
  { "role": "system", "content": "You are a helpful assistant." },
  { "role": "user", "content": "Where should I travel?" },
  { "role": "assistant", "content": "Try Lisbon." },
  { "role": "user", "content": "And in winter?" }
]
```

**OUTPUT:**

```http
201 Created
{ "reply": "The Canary Islands are warm in winter." }
```

**Errors:**

| Input | Output |
| --- | --- |
| `{ "content": "" }` | `400` |
| conversation `c9` of user `u2` (as `u1`) | `404` |
| the model throws | `502`, nothing saved |

`502 Bad Gateway` means "a service I depend on failed", which is the right status when the AI provider is down.

## How to check your work

Run `npm run test:backend:12`.

## Rules

- Edit only `task12.ts`.
