# Ticket Workflow with LangGraph and Checkpointing

**Task ID:** LC-003 · **Level:** 2 · **File:** `src/langchain/task3/task3.ts` · **Tests:** `npm run test:langchain:3`

Build a LangGraph workflow for support tickets: classify → draft → review, looping back to draft when the review rejects the draft. It escalates when needed and can resume after a crash using a checkpointer.

## What you export

```ts
export function buildTicketWorkflow(deps: TicketDeps, options: {
  checkpointer: BaseCheckpointSaver; maxRevisions?: number; minConfidence?: number; escalationCategories?: string[];
}): TicketWorkflow;   // the compiled graph: invoke, getState, getStateHistory
```

`deps` holds three async functions: `classify(ticket)`, `draft({ ticket, category, feedback })` and `review(draft)`. The tests pass fakes.

| Option                 | Default                  |
| ---------------------- | ------------------------ |
| `maxRevisions`         | `2`                      |
| `minConfidence`        | `0.6`                    |
| `escalationCategories` | `["legal", "security"]`  |

## State

| Field              | Default | How it updates |
| ------------------ | ------- | -------------- |
| `ticket`           | (input) | set from the input |
| `category`         | `null`  | replaced |
| `confidence`       | `null`  | replaced |
| `drafts`           | `[]`    | **appends** |
| `feedback`         | `[]`    | **appends** |
| `revisions`        | `0`     | replaced |
| `status`           | `"new"` | replaced (`"new"`, `"approved"` or `"escalated"`) |
| `finalReply`       | `null`  | replaced |
| `escalationReason` | `null`  | replaced (`"low_confidence"`, `"sensitive_category"` or `"max_revisions"`) |

Use `Annotation.Root` with a reducer such as `(a, b) => a.concat(b)` for the fields that append.

## Graph (node names must match)

```
START → classify ─┬─ category in escalationCategories → escalate (reason "sensitive_category")
                  ├─ confidence < minConfidence       → escalate (reason "low_confidence")
                  └─ otherwise                        → draft

draft  → review ─┬─ approved                          → finalize
                 └─ rejected: add feedback, revisions + 1
                       ├─ revisions < maxRevisions    → draft   (gets all feedback so far)
                       └─ otherwise                   → escalate (reason "max_revisions")

finalize → END      sets status "approved", finalReply = latest draft
escalate → END      sets status "escalated" (finalReply stays null)
```

## Checkpointing

- Compile with `options.checkpointer`. Each run passes `{ configurable: { thread_id } }`, and different threads don't share state.
- If a node throws, the error reaches the caller and the checkpoint stays. `invoke(null, sameConfig)` then continues from the failed node without re-running finished nodes. LangGraph does this for you once a checkpointer is set.

## Examples

**Approved after one revision**

```ts
const workflow = buildTicketWorkflow(deps, { checkpointer: new MemorySaver() });
const config = { configurable: { thread_id: "ticket-42" } };

await workflow.invoke({ ticket: "My invoice is wrong" }, config);
// classify → { category: "billing", confidence: 0.92 }
// draft #1 → "Sorry about that..."      review → { approved: false, feedback: "mention the refund timeline" }
// draft #2 (feedback: ["mention the refund timeline"]) → "Sorry... refund in 5 days"   review → { approved: true }
// → { ticket: "My invoice is wrong", category: "billing", confidence: 0.92,
//     drafts: ["Sorry about that...", "Sorry... refund in 5 days"], feedback: ["mention the refund timeline"],
//     revisions: 1, status: "approved", finalReply: "Sorry... refund in 5 days", escalationReason: null }

(await workflow.getState(config)).values.status;   // → "approved"
```

**Low confidence**

```ts
// classify → { category: "billing", confidence: 0.4 }
// → { ..., drafts: [], status: "escalated", finalReply: null, escalationReason: "low_confidence" }
```

**Sensitive category**

```ts
// classify → { category: "legal", confidence: 0.99 }
// → { ..., status: "escalated", escalationReason: "sensitive_category" }
```

**Too many rejections** (`maxRevisions: 2`)

```ts
// draft → rejected, draft → rejected
// → { ..., drafts: [d1, d2], revisions: 2, status: "escalated", escalationReason: "max_revisions" }
```

**Crash and resume**

```ts
// review throws Error("provider down")
await workflow.invoke({ ticket: "..." }, config);          // → throws Error("provider down")
(await workflow.getState(config)).next;                     // → ["review"]
await workflow.invoke(null, config);                        // continues at review; classify and draft are not called again
```

## Rules

- Use LangGraph (`@langchain/langgraph` is installed).
- Edit only `task3.ts`. Do not change the tests.
