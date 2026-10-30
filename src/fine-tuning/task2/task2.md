# Fine-Tuning Dataset Preparation (JSONL)

**Task ID:** FT-002 · **Level:** 2 · **File:** `src/fine-tuning/task2/task2.ts` · **Tests:** `npm run test:ft:2`

Turn a raw chat JSONL file into a clean training set. Validate each line, scrub PII, remove duplicates and eval-set leaks, enforce a token limit, and split into train and validation sets.

## What you export

```ts
export function prepareDataset(jsonl: string, tokenizer: { countTokens(text: string): number }, options: {
  maxTokens: number; validationFraction: number; scrubPII?: boolean /* default true */; evalPrompts?: string[] /* default [] */;
}): { train: Record[]; validation: Record[]; rejected: { line, reason }[]; stats };

export function toJsonl(records: Record[]): string;
// Record = { messages: [{ role, content }] }
```

## Lines

Split on `\n` and remove a trailing `\r` from each line. Skip blank lines (they don't count). `line` numbers are the 1-based line positions in the original text.

## Checks for each line (in order; the first failure rejects the line)

| # | Check | Reject reason |
| - | ----- | ------------- |
| 1 | The line is valid JSON and a JSON object | `invalid_json` |
| 2 | `messages` is an array. Each message has a `role` of `system`, `user` or `assistant` and a non-blank string `content`. `system` may only be at index 0. There is at least one `user` and one `assistant` message, and the last message is `assistant`. | `invalid_schema` |
| 3 | If `scrubPII`: replace emails with `[EMAIL]` and phones with `[PHONE]` in every content (this is not a rejection) | |
| 4 | No **user** message equals an eval prompt (after normalizing both) | `contaminated` |
| 5 | The normalized conversation is not the same as an earlier **accepted** record's | `duplicate` |
| 6 | `sum over messages of (countTokens(content) + 4) <= maxTokens` | `too_long` |

- Email: `/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/`
- Phone: `+` followed by 8–15 digits, optionally separated by single spaces or hyphens
- `normalize(text)` = lower-case, collapse whitespace runs to one space, trim
- Normalized conversation = `messages.map(m => m.role + ":" + normalize(m.content)).join("\n")`

## Split

A record goes to `validation` if `fnv1a32(normalizedConversation) % 10000 < validationFraction * 10000`, otherwise to `train`.

```ts
// FNV-1a 32-bit over the UTF-8 bytes
let h = 2166136261;
for (const byte of new TextEncoder().encode(text)) { h ^= byte; h = Math.imul(h, 16777619) >>> 0; }
```

## Output

- Records keep only `role` and `content` (scrubbed), in input order within each split.
- `rejected`: `{ line, reason }` in input order.
- `stats`: `{ totalLines, accepted, rejectedByReason: { invalid_json, invalid_schema, contaminated, duplicate, too_long } /* all 5 keys */, totalTokens, maxRecordTokens }`. The token numbers use the check-6 formula over accepted records (`0` if there are none).
- `toJsonl(records)`: one `JSON.stringify(record)` per line, each line ending with `\n` (`""` for no records).

## Examples

**Input**

```text
1  {"messages":[{"role":"user","content":"Reset my password"},{"role":"assistant","content":"Go to Settings."}]}
2  {not json
3  {"messages":[{"role":"assistant","content":"Hi"}]}
4  {"messages":[{"role":"user","content":"reset   my PASSWORD"},{"role":"assistant","content":"go to settings."}]}
5  {"messages":[{"role":"user","content":"Email me at ann@example.com"},{"role":"assistant","content":"Done."}],"id":7}
```

```ts
prepareDataset(input, tokenizer, { maxTokens: 100, validationFraction: 0 });
// → { train: [
//       { messages: [ { role: "user", content: "Reset my password" }, { role: "assistant", content: "Go to Settings." } ] },
//       { messages: [ { role: "user", content: "Email me at [EMAIL]" }, { role: "assistant", content: "Done." } ] } ],
//     validation: [],
//     rejected: [ { line: 2, reason: "invalid_json" }, { line: 3, reason: "invalid_schema" }, { line: 4, reason: "duplicate" } ],
//     stats: { totalLines: 5, accepted: 2,
//              rejectedByReason: { invalid_json: 1, invalid_schema: 1, contaminated: 0, duplicate: 1, too_long: 0 },
//              totalTokens: ..., maxRecordTokens: ... } }
```

**Contaminated** (`evalPrompts: ["How do I reset my password?"]`)

```text
{"messages":[{"role":"user","content":"how do I  reset my password?"},{"role":"assistant","content":"..."}]}
→ rejected: { line: 1, reason: "contaminated" }
```

**toJsonl**

```ts
toJsonl([{ messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }] }]);
// → '{"messages":[{"role":"user","content":"hi"},{"role":"assistant","content":"hello"}]}\n'
```

## Rules

- No libraries needed, but you may use any npm package.
- Edit only `task2.ts`. Do not change the tests.
