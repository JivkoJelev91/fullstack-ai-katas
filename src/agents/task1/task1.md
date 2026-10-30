# Tool-Calling Agent Loop

**Task ID:** AGENT-001 · **Level:** 2 · **File:** `src/agents/task1/task1.ts` · **Tests:** `npm run test:agents:1`

Write the basic agent loop: call the model, run the tools it asks for, send back the results, and repeat until it gives a final answer.

## What you export

```ts
export function defineTool({ name, description, schema, execute }): AgentTool;   // schema is a Zod schema
export async function runAgent({ model, tools, system, input, maxSteps = 8, toolTimeoutMs = 10000, maxToolOutputChars = 4000 }): Promise<AgentRunResult>;
```

The model has one method: `model.chat({ messages, tools })` returns `{ message, usage }`, where `message` is an assistant message that may have `toolCalls: [{ id, name, arguments: <JSON string> }]`. The message types are in `src/agents/shared/tool-chat.ts`. The tests use a fake model.

## `defineTool`

Return an object with `name`, `description`, `schema` and `execute`. The model sees each tool as:

```ts
{ name, description, parameters: <JSON Schema of the Zod schema> }   // e.g. z.toJSONSchema(schema) → { type: "object", properties: {...} }
```

## `runAgent`: the loop

```
messages = [ { role: "system", content: system }, { role: "user", content: input } ]

repeat:
  if the model was already called maxSteps times → throw new AgentStepLimitError(steps, messages)
  { message, usage } = await model.chat({ messages, tools: <tool specs> })
  add message to messages
  if message has no toolCalls (missing or [])  → done, output = message.content
  run every tool call AT THE SAME TIME, then add one tool message per call, in call order
```

**Tool message for each call:** `{ role: "tool", toolCallId: call.id, content, isError? }`

| Situation | `content` | `isError` |
| --------- | --------- | --------- |
| No tool with that name | `Unknown tool: <name>` | `true` |
| `arguments` isn't JSON, or fails the Zod schema (don't run the tool) | starts with `Invalid arguments` | `true` |
| The tool throws | `Tool error: <error.message>` | `true` |
| The tool takes longer than `toolTimeoutMs` (abort its `signal`) | `Tool timed out after <toolTimeoutMs> ms` | `true` |
| Success | the result if it's a string, otherwise `JSON.stringify(result)` | not set |

- If `content` is longer than `maxToolOutputChars`, cut it to that length and add `\n[truncated]`.
- Call each tool as `tool.execute(parsedArgs, { signal, callId })`.

**Return:**

```ts
{ output, steps /* model calls */, messages, toolCalls: [{ id, name, ok }] /* every call, in order */, usage /* summed */ }
```

## Examples

```ts
const weather = defineTool({
  name: "get_weather",
  description: "Current weather for a city",
  schema: z.object({ city: z.string().min(1) }),
  execute: async ({ city }) => ({ city, tempC: 21 }),
});
await runAgent({ model, tools: [weather], system: "You are helpful.", input: "Weather in Sofia?" });
```

**Normal run**

| Step | Model returns | You add |
| ---- | ------------- | ------- |
| 1 | `{ role: "assistant", content: "", toolCalls: [{ id: "call_1", name: "get_weather", arguments: "{\"city\":\"Sofia\"}" }] }` | `{ role: "tool", toolCallId: "call_1", content: "{\"city\":\"Sofia\",\"tempC\":21}" }` |
| 2 | `{ role: "assistant", content: "It is 21°C in Sofia." }` | (done) |

```ts
// → { output: "It is 21°C in Sofia.", steps: 2,
//     messages: [system, user, assistant(tool call), tool, assistant(final)],
//     toolCalls: [ { id: "call_1", name: "get_weather", ok: true } ],
//     usage: { inputTokens: <sum>, outputTokens: <sum> } }
```

**Bad arguments**

```ts
// model calls get_weather with arguments "{\"city\":\"\"}"
// → tool message { toolCallId: "call_1", content: "Invalid arguments: ...", isError: true }   (the tool doesn't run)
// toolCalls: [ { id: "call_1", name: "get_weather", ok: false } ]
```

**Unknown tool**

```ts
// model calls "get_stock"  → tool message { content: "Unknown tool: get_stock", isError: true }
```

**Model never stops** (`maxSteps: 3`)

```ts
// → throws AgentStepLimitError { steps: 3, messages: [...] }
```

## Rules

- You may use any npm package (`zod` is installed).
- Edit only `task1.ts`. Do not change the tests.
