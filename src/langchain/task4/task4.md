# Refund Approval with Human-in-the-Loop (LangGraph)

**Task ID:** LC-004 · **Level:** 2–3 · **File:** `src/langchain/task4/task4.ts` · **Tests:** `npm run test:langchain:4`

Build a LangGraph refund workflow. Small refunds are paid automatically. Large refunds pause with `interrupt()` and wait for a person to approve, reject or edit them. Every step is recorded in an audit log.

## What you export

```ts
export function buildRefundWorkflow(deps: RefundDeps, options: { checkpointer: BaseCheckpointSaver; autoApproveLimit: number }): RefundWorkflow;
export async function startRefund(workflow, threadId, input: { orderId: string; reason: string }): Promise<RefundOutcome>;
export async function resumeRefund(workflow, threadId, decision: ApprovalDecision): Promise<RefundOutcome>;
```

- `deps.assess({ orderId, reason })` returns `{ eligible, amount }`.
- `deps.payments.refund(orderId, amount, idempotencyKey)` returns `{ refundId }`.
- The types and the errors `NoPendingApprovalError` and `ThreadInUseError` are already in the starter file.

## Workflow

```
assess (once per thread) ─┬─ eligible: false          → end   { status: "not_eligible" }
                          ├─ amount <= autoApproveLimit → pay
                          └─ otherwise                 → interrupt({ type: "refund_approval", orderId, amount, reason })
                                                          ↓ resumed with a decision
                                   approve             → pay the assessed amount
                                   reject              → end { status: "rejected", reviewer, note (null if missing) }
                                   edit, 0 < amount <= assessed → pay the edited amount
                                   edit, out of range  → interrupt again with the same request plus
                                                          message: "Edited amount must be greater than 0 and at most <assessed>."

pay → payments.refund(orderId, amount, "refund:<threadId>:<orderId>")   (exactly once per thread)
    → end { status: "refunded", refundId, amount }
```

Use `interrupt(request)` to pause and `new Command({ resume: decision })` to continue.

## Audit log

The state field `audit: string[]` **appends** entries in this order:

| When                | Entry |
| ------------------- | ----- |
| After assess        | `"assessed"` |
| Not eligible        | `"not_eligible"` |
| Auto-approved       | `"auto_approved"` |
| Each approval request | `"approval_requested"` |
| Approve             | `"approved:<reviewer>"` |
| Reject              | `"rejected:<reviewer>"` |
| Valid edit          | `"edited:<reviewer>:<amount>"` |
| Invalid edit        | `"invalid_edit:<reviewer>"` |
| After payment       | `"refunded:<refundId>"` |

Every outcome returned includes `audit` (the full log so far).

## `startRefund` and `resumeRefund`

| Function | Checks | Returns |
| -------- | ------ | ------- |
| `startRefund(workflow, threadId, input)` | If the thread already has state, throw `ThreadInUseError` | The outcome. If paused: `{ status: "awaiting_approval", request, audit }` |
| `resumeRefund(workflow, threadId, decision)` | 1. `reviewer` is not empty, `decision` is `approve`/`reject`/`edit`, and `edit` has a numeric `amount`; otherwise throw `ValidationError` (from `src/shared/errors.ts`). 2. If the thread isn't waiting for approval, throw `NoPendingApprovalError`. | The outcome |

Read the pending request from `(await workflow.getState(config)).tasks[..].interrupts[0].value`.

## Examples

```ts
const workflow = buildRefundWorkflow(deps, { checkpointer: new MemorySaver(), autoApproveLimit: 50 });
```

**Small refund (auto-approved)**

```ts
// assess → { eligible: true, amount: 20 }
await startRefund(workflow, "t-0", { orderId: "o-1", reason: "Late" });
// payments.refund("o-1", 20, "refund:t-0:o-1") → { refundId: "r-0" }
// → { status: "refunded", refundId: "r-0", amount: 20, audit: ["assessed", "auto_approved", "refunded:r-0"] }
```

**Not eligible**

```ts
// assess → { eligible: false, amount: 0 }
// → { status: "not_eligible", audit: ["assessed", "not_eligible"] }
```

**Large refund, invalid edit, then valid edit**

```ts
// assess → { eligible: true, amount: 120 }
await startRefund(workflow, "t-1", { orderId: "o-9", reason: "Damaged" });
// → { status: "awaiting_approval",
//     request: { type: "refund_approval", orderId: "o-9", amount: 120, reason: "Damaged" },
//     audit: ["assessed", "approval_requested"] }

await resumeRefund(workflow, "t-1", { decision: "edit", reviewer: "carol", amount: 500 });
// → { status: "awaiting_approval",
//     request: { type: "refund_approval", orderId: "o-9", amount: 120, reason: "Damaged",
//                message: "Edited amount must be greater than 0 and at most 120." },
//     audit: ["assessed", "approval_requested", "invalid_edit:carol", "approval_requested"] }

await resumeRefund(workflow, "t-1", { decision: "edit", reviewer: "carol", amount: 80 });
// payments.refund("o-9", 80, "refund:t-1:o-9") → { refundId: "r-1" }
// → { status: "refunded", refundId: "r-1", amount: 80,
//     audit: [..., "edited:carol:80", "refunded:r-1"] }
```

**Approve / reject**

```ts
await resumeRefund(workflow, "t-2", { decision: "approve", reviewer: "dave" });
// → { status: "refunded", refundId: "...", amount: 120, audit: [..., "approved:dave", "refunded:..."] }

await resumeRefund(workflow, "t-3", { decision: "reject", reviewer: "erin", note: "Used item" });
// → { status: "rejected", reviewer: "erin", note: "Used item", audit: [..., "rejected:erin"] }
```

**Errors**

```ts
await resumeRefund(workflow, "t-1", { decision: "approve", reviewer: "dave" });   // t-1 already finished
// → throws NoPendingApprovalError

await resumeRefund(workflow, "t-2", { decision: "approve", reviewer: "" });
// → throws ValidationError

await startRefund(workflow, "t-1", { orderId: "o-9", reason: "again" });
// → throws ThreadInUseError
```

## Rules

- Use LangGraph (`@langchain/langgraph` is installed).
- Edit only `task4.ts`. Do not change the tests.
