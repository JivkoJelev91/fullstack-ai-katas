# Prompting vs RAG vs Fine-Tuning: Decision and Cost Model

**Task ID:** FT-001 · **Level:** 1 · **File:** `src/fine-tuning/task1/task1.ts` · **Tests:** `npm run test:ft:1`

Write two functions. One recommends prompting, RAG, fine-tuning or both for a use case. The other compares the monthly costs of RAG and fine-tuning.

## `recommendApproach(useCase)` → `{ approach, reasons }`

**Reasons**, checked in this order (add each one that applies):

| Reason | When | Points to |
| ------ | ---- | --------- |
| `fresh_knowledge` | `knowledgeChangesFrequently` | RAG |
| `citations_required` | `needsCitations` | RAG |
| `large_knowledge_base` | `knowledgeBaseDocuments > 50` | RAG |
| `style_consistency` | `needsStyleConsistency` | fine-tuning |
| `strict_format` | `strictOutputFormat` | fine-tuning |
| `latency` | `latencySensitive` | fine-tuning |
| `insufficient_examples` | a fine-tuning reason applies but `labeledExamples < 500` (fine-tuning is then **not** chosen) | |

**Approach:**

| RAG chosen | Fine-tuning chosen | `approach` |
| ---------- | ------------------ | ---------- |
| yes | yes | `"rag_plus_fine_tuning"` |
| yes | no  | `"rag"` |
| no  | yes | `"fine_tuning"` |
| no  | no  | `"prompting"` |

## `estimateCosts(input)` → `{ rag: { monthlyUsd }, fineTuning: { trainingUsd, monthlyUsd }, breakEvenMonths }`

Prices are USD per **million** tokens.

```
rag.monthlyUsd        = requestsPerMonth × ((basePromptTokens + ragContextTokens) × pricing.inputPerMTok
                                            + outputTokens × pricing.outputPerMTok) / 1e6
                        + vectorDbMonthlyUsd

fineTuning.trainingUsd = trainingTokens × epochs × ftPricing.trainingPerMTok / 1e6

fineTuning.monthlyUsd  = requestsPerMonth × (ftPromptTokens × ftPricing.inputPerMTok
                                             + outputTokens × ftPricing.outputPerMTok) / 1e6
                         + ftHostingMonthlyUsd

breakEvenMonths = trainingUsd / (rag.monthlyUsd - fineTuning.monthlyUsd)   if rag.monthlyUsd > fineTuning.monthlyUsd
                = null                                                      otherwise
```

## Examples

**recommendApproach**

```ts
recommendApproach({
  knowledgeChangesFrequently: false, needsCitations: false, knowledgeBaseDocuments: 10,
  needsStyleConsistency: false, strictOutputFormat: false, latencySensitive: false, labeledExamples: 0,
});
// → { approach: "prompting", reasons: [] }

recommendApproach({
  knowledgeChangesFrequently: true, needsCitations: false, knowledgeBaseDocuments: 10,
  needsStyleConsistency: true, strictOutputFormat: false, latencySensitive: false, labeledExamples: 120,
});
// → { approach: "rag", reasons: ["fresh_knowledge", "style_consistency", "insufficient_examples"] }

recommendApproach({
  knowledgeChangesFrequently: false, needsCitations: true, knowledgeBaseDocuments: 200,
  needsStyleConsistency: false, strictOutputFormat: true, latencySensitive: false, labeledExamples: 2000,
});
// → { approach: "rag_plus_fine_tuning", reasons: ["citations_required", "large_knowledge_base", "strict_format"] }
```

**estimateCosts**

```ts
estimateCosts({
  requestsPerMonth: 1_000_000, basePromptTokens: 500, ragContextTokens: 1500, outputTokens: 200, ftPromptTokens: 300,
  pricing:   { inputPerMTok: 3, outputPerMTok: 15 },
  ftPricing: { inputPerMTok: 3, outputPerMTok: 15, trainingPerMTok: 25 },
  trainingTokens: 20_000_000, epochs: 3, vectorDbMonthlyUsd: 500, ftHostingMonthlyUsd: 0,
});
// rag:        1e6 × (2000 × 3 + 200 × 15) / 1e6 + 500 = 9500
// fineTuning: training 20e6 × 3 × 25 / 1e6 = 1500, monthly 1e6 × (300 × 3 + 200 × 15) / 1e6 = 3900
// → { rag: { monthlyUsd: 9500 }, fineTuning: { trainingUsd: 1500, monthlyUsd: 3900 }, breakEvenMonths: 1500 / 5600 }   // ≈ 0.268
```

## Rules

- No libraries needed.
- Edit only `task1.ts`. Do not change the tests.
