# Release Notes Chain with LCEL, Retries and Fallback

**Task ID:** LC-001 · **Level:** 1–2 · **File:** `src/langchain/task1/task1.ts` · **Tests:** `npm run test:langchain:1`

Build a LangChain chain: validate the input → prompt → model → JSON parser. Retry the model step once, and use a fallback model if one is given.

## What you export

```ts
export function createReleaseNotesChain(deps: { model: BaseChatModel; fallbackModel?: BaseChatModel }): Runnable<ReleaseNotesInput, ReleaseNotes>;
// ReleaseNotesInput = { commits: string[]; audience: "developers" | "customers" }
// ReleaseNotes      = { headline: string; highlights: string[]; breakingChanges: string[] }
```

Return a real LangChain `Runnable` (for example built with `RunnableLambda` and `.pipe()`), so that `invoke` and `batch` work. The tests use a fake chat model.

## Steps in the chain

| Step | What it does |
| ---- | ------------ |
| 1. Validate | `commits`: 1–50 strings, each 1–200 characters after trimming. `audience`: `developers` or `customers`. If invalid, throw `ValidationError` (from `src/shared/errors.ts`) and don't call a model. |
| 2. Prompt | Exactly 2 messages. `system`: your instructions, containing the word `developers` or `customers` and no commit text. `human`: the trimmed commits, one per line, as `- <commit>`. |
| 3. Model | `deps.model` |
| 4. Parse | The model text must be JSON (plain or in one ```` ```json ```` fence) with the fields below. If not, throw `OutputParserException` (from `@langchain/core/output_parsers`). |
| Retry | If steps 3–4 fail (the model throws or the output is invalid), try them once more (2 attempts total). Use `.withRetry({ stopAfterAttempt: 2 })`. |
| Fallback | If both attempts fail and `fallbackModel` exists, run prompt → `fallbackModel` → parser, also with up to 2 attempts. Use `.withFallbacks([...])`. Without a fallback model, throw the last error. |

Validation is never retried and never uses the fallback.

**Parsed output:**

| Field             | Rule |
| ----------------- | ---- |
| `headline`        | string, 1–120 characters after trimming |
| `highlights`      | 1–5 non-empty strings |
| `breakingChanges` | non-empty strings (the array may be empty) |

Trim all strings and drop extra fields.

## Examples

**Success**

```ts
const chain = createReleaseNotesChain({ model });
await chain.invoke({ audience: "customers", commits: ["feat: dark mode", " fix: login crash on iOS "] });
```

Messages sent to the model:

```text
system: Write release notes for customers. Answer with JSON ...
human:  - feat: dark mode
        - fix: login crash on iOS
```

Model text:

```json
{ "headline": " Dark mode is here ", "highlights": ["Dark mode", "iOS login fix"], "breakingChanges": [], "tone": "happy" }
```

Result:

```ts
{ headline: "Dark mode is here", highlights: ["Dark mode", "iOS login fix"], breakingChanges: [] }
```

**Batch**

```ts
await chain.batch([input1, input2]);   // → [ReleaseNotes, ReleaseNotes]
```

**Invalid output, then valid** → the second model answer is used (2 model calls).

**Primary fails twice, fallback works** → the fallback model's answer is returned (2 primary calls + 1 fallback call).

**Primary and fallback both fail twice** → throws the last error (2 + 2 calls).

**Invalid input**

```ts
await chain.invoke({ audience: "everyone", commits: [] });   // → throws ValidationError, no model call
```

## Rules

- Use LangChain (`@langchain/core` is installed).
- Edit only `task1.ts`. Do not change the tests.
