# Streaming LLM Responses: SSE Parsing and Relay

**Task ID:** AI-004 · **Level:** 2 · **File:** `src/ai/task4/task4.ts` · **Tests:** `npm run test:ai:4`

There are two parts:
- **A.** Parse Anthropic's streaming response (Server-Sent Events, SSE) into simple events.
- **B.** Build an Express endpoint that forwards those events to the browser as SSE.

The types and `StreamError` are already in the starter file.

## Part A: `parseAnthropicStream(body)`

```ts
export async function* parseAnthropicStream(body: AsyncIterable<Uint8Array | string>): AsyncGenerator<StreamEvent>;
// StreamEvent = { type: "text", text } | { type: "done", stopReason, usage: { inputTokens, outputTokens } }
```

**Input format.** `body` gives you raw chunks. A chunk can end in the middle of a line, or even in the middle of a UTF-8 character, so use `TextDecoder` with `{ stream: true }` and buffer until you have full lines.

```
event: <name>
data: <json>
                ← a blank line ends one event
```

**What to do with each event:**

| Event name            | Action |
| --------------------- | ------ |
| `message_start`       | Remember `data.message.usage.input_tokens` |
| `content_block_delta` | If `data.delta.type === "text_delta"` and the text isn't empty, **yield** `{ type: "text", text: data.delta.text }` |
| `message_delta`       | Remember `data.delta.stop_reason` and `data.usage.output_tokens` |
| `message_stop`        | **Yield** `{ type: "done", stopReason, usage }` and stop. Ignore anything after it. |
| `error`               | Throw `new StreamError(data.error.message)` |
| anything else (`ping`, ...) | Ignore |

- Map stop reasons as follows: `end_turn` → `"end"`, `max_tokens` → `"max_tokens"`, `stop_sequence` → `"stop_sequence"`, anything else → `"end"`. A missing token count is `0`.
- Throw `StreamError` if the data is not valid JSON, or if the input ends before `message_stop`.
- Yield each event as soon as it's complete. Don't wait for the whole stream.

## Part B: `createStreamingApp({ source })`

```ts
export function createStreamingApp(deps: { source: StreamSource }): Express;
// source.start(prompt, signal) → Promise<AsyncIterable<StreamEvent>>
```

**`POST /chat/stream`** with body `{ "prompt": string }`:

| Step | Action |
| ---- | ------ |
| 1 | Check `prompt`: a string, 1–4000 characters after trimming. If not, respond `400` `{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }` |
| 2 | `await source.start(prompt, signal)`. If it throws, respond `502` `{ "error": { "code": "UPSTREAM_ERROR", "message": "..." } }` |
| 3 | Respond `200` with headers `Content-Type: text/event-stream` and `Cache-Control: no-cache` |
| 4 | For each event, write and flush it right away (formats below) |
| 5 | After the `done` event, end the response |

| Upstream event | Written to the client |
| -------------- | --------------------- |
| `{ type: "text", text: "Hel" }` | `event: token\ndata: {"text":"Hel"}\n\n` |
| `{ type: "done", stopReason, usage }` | `event: done\ndata: {"stopReason":"end","usage":{...}}\n\n` |
| The upstream throws, or ends without `done` | `event: error\ndata: {"code":"STREAM_ERROR","message":"The response stream failed."}\n\n`, then end the response (don't send the upstream error message) |

**Client disconnects** before the end: abort the `signal` you passed to `source.start` and stop reading the upstream.

## Examples

**Part A**

Upstream input (may arrive in random-sized chunks):

```text
event: message_start
data: {"type":"message_start","message":{"usage":{"input_tokens":25,"output_tokens":1}}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hel"}}

event: ping
data: {"type":"ping"}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"lo"}}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}

event: message_stop
data: {"type":"message_stop"}
```

Yielded events:

```ts
{ type: "text", text: "Hel" }
{ type: "text", text: "lo" }
{ type: "done", stopReason: "end", usage: { inputTokens: 25, outputTokens: 2 } }
```

Error event:

```text
event: error
data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}
```

→ throws `StreamError("Overloaded")`

**Part B: success**

```http
POST /chat/stream
{ "prompt": "Say hello" }

200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

event: token
data: {"text":"Hel"}

event: token
data: {"text":"lo"}

event: done
data: {"stopReason":"end","usage":{"inputTokens":25,"outputTokens":2}}

```

**Part B: errors**

```http
POST /chat/stream
{ "prompt": "   " }

400 Bad Request
{ "error": { "code": "VALIDATION_ERROR", "message": "prompt must be 1-4000 characters" } }
```

```http
POST /chat/stream          (source.start throws)
{ "prompt": "Hi" }

502 Bad Gateway
{ "error": { "code": "UPSTREAM_ERROR", "message": "Model unavailable" } }
```

```http
POST /chat/stream          (upstream throws after the first token)
{ "prompt": "Hi" }

200 OK
Content-Type: text/event-stream

event: token
data: {"text":"Hel"}

event: error
data: {"code":"STREAM_ERROR","message":"The response stream failed."}

```

## Rules

- You may use any npm package.
- Edit only `task4.ts`. Do not change the tests.
