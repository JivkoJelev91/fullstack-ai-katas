# Multi-Provider Adapters with Images

**Task ID:** AI-003 · **Level:** 2 · **File:** `src/ai/task3/task3.ts` · **Tests:** `npm run test:ai:3`

Write two adapters, one for Anthropic and one for OpenAI. Each turns one common request format into that provider's HTTP request, and turns the HTTP response back into one common response format.

## What you export

```ts
export function createAnthropicAdapter(config: { apiKey: string; fetch: FetchLike; baseUrl?: string }): ProviderAdapter;
export function createOpenAIAdapter(config: { apiKey: string; fetch: FetchLike; baseUrl?: string }): ProviderAdapter;
// ProviderAdapter = { provider: "anthropic" | "openai"; complete(request, options?: { signal?: AbortSignal }) }
```

All types and error classes are already in the starter file. Make HTTP calls only with `config.fetch` (the tests pass a fake).

## Common request

```ts
{
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | ContentPart[] }>;
  maxTokens: number;
  temperature?: number;
  stopSequences?: string[];
}
// ContentPart = { type: "text", text } | { type: "image", mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: <base64> }
```

## Validation (both adapters, before calling `fetch`)

| Problem                                       | Throw                     |
| --------------------------------------------- | ------------------------- |
| `messages` is empty                           | `RangeError`              |
| `maxTokens` is not a positive integer         | `RangeError`              |
| Image `mediaType` not in the list above       | `UnsupportedContentError` |
| Image in a non-`user` message                 | `UnsupportedContentError` |
| `system` message content is not a string      | `UnsupportedContentError` |

## Anthropic adapter

| | |
| --- | --- |
| URL | `POST {baseUrl ?? "https://api.anthropic.com"}/v1/messages` |
| Headers | `x-api-key: <apiKey>`, `anthropic-version: 2023-06-01`, `content-type: application/json` |
| Body | `{ model, max_tokens, system?, messages, temperature?, stop_sequences? }` |

- Take all `system` messages out of `messages` and join their text with `"\n\n"` into `system`. Leave out `system` if there are none.
- Text part → `{ type: "text", text }`. Image part → `{ type: "image", source: { type: "base64", media_type, data } }`.
- Include `temperature` only if it's set, and `stop_sequences` only if it's a non-empty array.

**Response mapping:**

| Anthropic response                  | Common response |
| ----------------------------------- | --------------- |
| all `content` blocks of type `text`, joined | `text` |
| `stop_reason`: `end_turn` / `max_tokens` / `stop_sequence` / other | `stopReason`: `"end"` / `"max_tokens"` / `"stop_sequence"` / `"end"` |
| `usage.input_tokens`, `usage.output_tokens` | `usage.inputTokens`, `usage.outputTokens` |
| `model`                             | `model` |
| (constant)                          | `provider: "anthropic"` |

## OpenAI adapter

| | |
| --- | --- |
| URL | `POST {baseUrl ?? "https://api.openai.com"}/v1/chat/completions` |
| Headers | `authorization: Bearer <apiKey>`, `content-type: application/json` |
| Body | `{ model, messages, max_completion_tokens, temperature?, stop? }` |

- Keep messages in their original order, including `system` messages.
- Text part → `{ type: "text", text }`. Image part → `{ type: "image_url", image_url: { url: "data:<mediaType>;base64,<data>" } }`.
- Include `temperature` only if it's set, and `stop` only if it's a non-empty array.

**Response mapping:**

| OpenAI response                     | Common response |
| ----------------------------------- | --------------- |
| `choices[0].message.content` (`null` → `""`) | `text` |
| `finish_reason`: `stop` / `length` / other | `stopReason`: `"end"` / `"max_tokens"` / `"end"` |
| `usage.prompt_tokens`, `usage.completion_tokens` | `usage.inputTokens`, `usage.outputTokens` |
| `model`                             | `model` |
| (constant)                          | `provider: "openai"` |

## Errors (both adapters)

Throw `new ProviderRequestError(message, provider, status, retryAfterMs?)`:

| Situation | `status` | `message` |
| --------- | -------- | --------- |
| HTTP status not 2xx | the HTTP status | `error.message` from the JSON body if there is one |
| HTTP 2xx but the body has the wrong shape | `502` | any |
| `fetch` throws (network error) | `0` | any |

- `retryAfterMs` = the `retry-after` header (in seconds) × 1000, or `undefined`.
- If `fetch` throws because the caller's `signal` was aborted, rethrow that same error unchanged.
- Pass `options.signal` to `fetch`.
- The API key must never appear in an error message.

## Examples

**Anthropic, with an image**

```ts
await anthropic.complete({
  model: "claude-x", maxTokens: 300,
  messages: [
    { role: "system", content: "You describe images." },
    { role: "user", content: [{ type: "text", text: "What is this?" }, { type: "image", mediaType: "image/png", data: "iVBORw0KGgo=" }] },
  ],
});
```

HTTP body sent:

```json
{ "model": "claude-x", "max_tokens": 300, "system": "You describe images.",
  "messages": [ { "role": "user", "content": [
    { "type": "text", "text": "What is this?" },
    { "type": "image", "source": { "type": "base64", "media_type": "image/png", "data": "iVBORw0KGgo=" } } ] } ] }
```

HTTP response `{ "content": [{ "type": "text", "text": "A cat." }], "stop_reason": "end_turn", "usage": { "input_tokens": 1200, "output_tokens": 4 }, "model": "claude-x" }` becomes:

```ts
{ text: "A cat.", stopReason: "end", usage: { inputTokens: 1200, outputTokens: 4 }, provider: "anthropic", model: "claude-x" }
```

**OpenAI, same request**

HTTP body sent:

```json
{ "model": "claude-x", "max_completion_tokens": 300,
  "messages": [
    { "role": "system", "content": "You describe images." },
    { "role": "user", "content": [
      { "type": "text", "text": "What is this?" },
      { "type": "image_url", "image_url": { "url": "data:image/png;base64,iVBORw0KGgo=" } } ] } ] }
```

HTTP response `{ "choices": [{ "message": { "content": "A cat." }, "finish_reason": "length" }], "usage": { "prompt_tokens": 1200, "completion_tokens": 4 }, "model": "gpt-x" }` becomes:

```ts
{ text: "A cat.", stopReason: "max_tokens", usage: { inputTokens: 1200, outputTokens: 4 }, provider: "openai", model: "gpt-x" }
```

**Errors**

```ts
// HTTP 429, header retry-after: 1.5, body { "error": { "message": "slow down" } }
// → throws ProviderRequestError { message: "...slow down...", provider: "openai", status: 429, retryAfterMs: 1500 }

// HTTP 200, body { "unexpected": true }
// → throws ProviderRequestError { status: 502 }

// fetch throws TypeError("fetch failed")
// → throws ProviderRequestError { status: 0 }

// messages: []
// → throws RangeError, fetch not called
```

## Rules

- You may use any npm package.
- Edit only `task3.ts`. Do not change the tests.
