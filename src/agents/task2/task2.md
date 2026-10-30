# Guarded Tool Execution: Permissions, Approvals, Audit

**Task ID:** AGENT-002 · **Level:** 2–3 · **File:** `src/agents/task2/task2.ts` · **Tests:** `npm run test:agents:2`

Put a safety layer in front of an agent's tools. Each tool call is checked against a policy. Dangerous calls need a human approval, and every decision is written to an audit log.

## What you export

```ts
export function createGuardedExecutor({ tools, policies, now = Date.now, approvalTtlMs = 900000, generateId = randomUUID }): GuardedExecutor;
// executor.execute(invocation, caller) → Promise<GuardedOutcome>
// executor.decide(approvalId, { approverId, approverScopes, approve }) → ApprovalRecord
// executor.getAudit() → AuditEntry[]
```

The types and `ApprovalError` are already in the starter file.

- `tools`: `{ [name]: async (args, caller) => result }`
- `policies`: `[{ tool, risk: "read" | "write" | "destructive", requiredScopes, requiresApproval?, guard?(args, caller) → string | null }]`
- `caller`: `{ userId, scopes, sessionMode?: "normal" | "read_only" }`
- `invocation`: `{ callId, tool, args, approvalId? }`

## `execute(invocation, caller)`

Run the checks in this order. The **first** one that fails decides the outcome:

| # | Check | Outcome when it fails |
| - | ----- | --------------------- |
| 1 | There is a policy for the tool | `{ status: "denied", reason: "no_policy" }` |
| 2 | If `sessionMode === "read_only"`, the risk must be `"read"` | `{ status: "denied", reason: "read_only_session" }` |
| 3 | The caller has every scope in `requiredScopes` | `{ status: "denied", reason: "missing_scope", detail: "<missing scopes, sorted, joined with ','>" }` |
| 4 | `guard(args, caller)` returns `null` (or there's no guard) | `{ status: "denied", reason: "guard_rejected", detail: <the returned string> }` |
| 5 | Approval, if needed (see below) | `pending_approval` or `{ status: "denied", reason: "approval_invalid", detail }` |
| 6 | Run the tool | `{ status: "executed", result }`, or `{ status: "failed", error: <error.message> }` if it throws |

**Approval is needed** when `risk === "destructive"` or `requiresApproval === true`.

- **No `approvalId`:** save an approval `{ id: generateId(), tool, argsHash, requesterId: caller.userId, status: "pending", createdAt: now(), expiresAt: now() + approvalTtlMs }` and return `{ status: "pending_approval", approvalId, expiresAt }`. Don't run the tool.
- **With `approvalId`:** check these in order. The first failure gives `denied` / `approval_invalid` with that `detail`:

| Check | `detail` |
| ----- | -------- |
| The approval exists | `not_found` |
| Status is `approved` (`used` → `already_used`, anything else → `not_approved`) | `already_used` / `not_approved` |
| Same tool | `tool_mismatch` |
| Same `argsHash` | `args_mismatch` |
| Same requester (`caller.userId`) | `requester_mismatch` |
| `now() < expiresAt` | `expired` |

If every check passes, set the status to `used` **before** running the tool, so that two calls at the same time can't both use it.

**`argsHash`** = SHA-256 hex of `JSON.stringify(args)` with object keys sorted at every level (so `{a:1,b:2}` and `{b:2,a:1}` give the same hash).

## `decide(approvalId, { approverId, approverScopes, approve })`

Throw `new ApprovalError(code)` for the first failing check:

| Check | `code` |
| ----- | ------ |
| The approval exists | `not_found` |
| Status is `pending` | `not_pending` |
| `now() < expiresAt` | `expired` |
| `approverId !== requesterId` | `self_approval` |
| `approverScopes` includes `"approvals:grant"` | `not_authorized` |

Otherwise set the status to `approved` or `rejected`, save `approverId`, and return a **copy** of the record.

## Audit log

- Each `execute` call adds one entry: `{ at: now(), userId, tool, callId, decision: <outcome status>, reason? }`. `reason` is set only for denials.
- Each successful `decide` adds: `{ at, userId: approverId, tool, callId: approvalId, decision: "approved" | "rejected" }`.
- Never put argument values in the audit. `getAudit()` returns a **copy**, oldest first.

## Examples

```ts
const executor = createGuardedExecutor({
  tools: { delete_customer: async ({ id }) => ({ deleted: id }), get_customer: async ({ id }) => ({ id, name: "Ann" }) },
  policies: [
    { tool: "get_customer", risk: "read", requiredScopes: ["customers:read"] },
    { tool: "delete_customer", risk: "destructive", requiredScopes: ["customers:write"] },
  ],
});
const ann = { userId: "u-ann", scopes: ["customers:read", "customers:write"] };
```

**Read tool**

```ts
await executor.execute({ callId: "c0", tool: "get_customer", args: { id: "cus_9" } }, ann);
// → { status: "executed", result: { id: "cus_9", name: "Ann" } }
```

**Denied**

```ts
await executor.execute({ callId: "c1", tool: "send_money", args: {} }, ann);
// → { status: "denied", reason: "no_policy" }

await executor.execute({ callId: "c2", tool: "delete_customer", args: { id: "x" } }, { userId: "u-bob", scopes: [] });
// → { status: "denied", reason: "missing_scope", detail: "customers:write" }
```

**Approval flow**

```ts
await executor.execute({ callId: "c3", tool: "delete_customer", args: { id: "cus_9" } }, ann);
// → { status: "pending_approval", approvalId: "a-1", expiresAt: <now + 900000> }

executor.decide("a-1", { approverId: "u-ann", approverScopes: ["approvals:grant"], approve: true });
// → throws ApprovalError { code: "self_approval" }

executor.decide("a-1", { approverId: "u-lead", approverScopes: ["approvals:grant"], approve: true });
// → { id: "a-1", tool: "delete_customer", argsHash: "...", requesterId: "u-ann", status: "approved", approverId: "u-lead", ... }

await executor.execute({ callId: "c4", tool: "delete_customer", args: { id: "cus_9" }, approvalId: "a-1" }, ann);
// → { status: "executed", result: { deleted: "cus_9" } }

await executor.execute({ callId: "c5", tool: "delete_customer", args: { id: "cus_9" }, approvalId: "a-1" }, ann);
// → { status: "denied", reason: "approval_invalid", detail: "already_used" }
```

**Audit**

```ts
executor.getAudit()[0];
// → { at: 1700000000000, userId: "u-ann", tool: "get_customer", callId: "c0", decision: "executed" }
```

## Rules

- You may use any npm package.
- Edit only `task2.ts`. Do not change the tests.
