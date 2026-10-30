# Supervised Fine-Tuning Data: Label Masking, Packing, LoRA Config

**Task ID:** FT-003 · **Level:** 2 · **File:** `src/fine-tuning/task3/task3.ts` · **Tests:** `npm run test:ft:3`

Prepare tokenized training examples the way SFT trainers expect them: mask the loss on everything except the assistant tokens, pack short examples together, and build a LoRA config.

`IGNORE_INDEX = -100` is already in the starter file.

## `buildTrainingExample(messages, tokenizer, { maxLength, trainOn = "all_assistant" })`

The tokenizer gives you `tokenizer.bosId`, plus `tokenizer.encodeMessage(role, content)`, which returns `{ header, content, end }` (three arrays of token ids).

```
inputIds = [bosId, ...msg1.header, ...msg1.content, ...msg1.end, ...msg2.header, ...]
```

| Tokens | `labels` |
| ------ | -------- |
| `bos`, every `header` | `-100` |
| `content` + `end` of `system` and `user` messages | `-100` |
| `content` + `end` of `assistant` messages | the token ids themselves (trained), but with `trainOn: "last_assistant"` only the **last** assistant message is trained and earlier ones are `-100` |

- `attentionMask` is all `1`s.
- Return `null` if `inputIds.length > maxLength`, or if no label is trainable.
- **Return** `{ inputIds, labels, attentionMask }`.

## `packExamples(examples, { maxLength, padId })`

- Go through the examples **in order**. Add each one to the current pack if `packLength + exampleLength <= maxLength`; otherwise start a new pack.
- If an example is longer than `maxLength`, throw `RangeError`.

Each pack:

| Field | Value |
| ----- | ----- |
| `inputIds` | all examples joined, padded with `padId` up to `maxLength` |
| `labels` | joined, padded with `-100` |
| `attentionMask` | joined, padded with `0` |
| `positionIds` | `0, 1, 2, ...` restarting for each example, padded with `0` |
| `sequenceLengths` | the length of each example in the pack |

## LoRA

`architecture = { numLayers, modules: { [name]: { inFeatures, outFeatures } } }`

**`createLoraConfig(architecture, { r, alpha = 2 * r, dropout = 0.05, targetModules })`**:

```ts
{ peft_type: "LORA", task_type: "CAUSAL_LM", r, lora_alpha: alpha, lora_dropout: dropout,
  target_modules: <sorted A→Z>, bias: "none" }
```

**`countLoraParameters(architecture, options)`** = `numLayers × sum over targetModules of r × (inFeatures + outFeatures)`

**`trainablePercentage(architecture, options, baseParameters)`** = `lora / (baseParameters + lora) × 100`. If `baseParameters` is not a positive integer, throw `RangeError`.

## Examples

Fake tokenizer: `bosId = 1`, header = `[10, <roleId>]` (user 11, assistant 12, system 13), `end = [2]`, one token per word (`hi` 101, `there` 102, `hello` 103).

**buildTrainingExample**

```ts
buildTrainingExample(
  [{ role: "user", content: "hi there" }, { role: "assistant", content: "hello" }],
  tokenizer, { maxLength: 32 },
);
// → { inputIds:      [1,    10,   11,   101,  102,  2,    10,   12,   103, 2],
//     labels:        [-100, -100, -100, -100, -100, -100, -100, -100, 103, 2],
//     attentionMask: [1,    1,    1,    1,    1,    1,    1,    1,    1,   1] }

buildTrainingExample(sameMessages, tokenizer, { maxLength: 5 });   // → null (too long)
buildTrainingExample([{ role: "user", content: "hi" }], tokenizer, { maxLength: 32 });   // → null (nothing to train)
```

**packExamples** (`maxLength: 8`, `padId: 0`; A has length 3, B has length 4, C has length 5)

```ts
packExamples([A, B, C], { maxLength: 8, padId: 0 });
// → [ { inputIds: [...A, ...B, 0],        positionIds: [0,1,2, 0,1,2,3, 0],  attentionMask: [1,1,1,1,1,1,1, 0],  sequenceLengths: [3, 4], labels: [...] },
//     { inputIds: [...C, 0, 0, 0],        positionIds: [0,1,2,3,4, 0,0,0],   attentionMask: [1,1,1,1,1, 0,0,0],  sequenceLengths: [5],    labels: [...] } ]
```

**LoRA**

```ts
createLoraConfig(llama, { r: 16, targetModules: ["v_proj", "q_proj"] });
// → { peft_type: "LORA", task_type: "CAUSAL_LM", r: 16, lora_alpha: 32, lora_dropout: 0.05,
//     target_modules: ["q_proj", "v_proj"], bias: "none" }

countLoraParameters(
  { numLayers: 32, modules: { q_proj: { inFeatures: 4096, outFeatures: 4096 }, v_proj: { inFeatures: 4096, outFeatures: 1024 } } },
  { r: 16, targetModules: ["q_proj", "v_proj"] },
);
// → 32 × (16 × 8192 + 16 × 5120) = 6815744
```

## Rules

- No libraries needed.
- Edit only `task3.ts`. Do not change the tests.
