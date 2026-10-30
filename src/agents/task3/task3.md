# Plan-and-Execute Agent with Replanning and Memory

**Task ID:** AGENT-003 · **Level:** 3 · **File:** `src/agents/task3/task3.ts` · **Tests:** `npm run test:agents:3`

Build a LangGraph agent that plans steps, runs them with retries, replans when a step keeps failing, and saves long-term memories when it finishes.

## What you export

```ts
export function buildPlanExecuteAgent(deps: PlanExecuteDeps, options: {
  checkpointer: BaseCheckpointSaver; maxReplans?: number; stepRetries?: number; maxStepExecutions?: number;
}): PlanExecuteAgent;   // a compiled LangGraph graph

export async function runPlanExecute(agent, { goal, userId, threadId }): Promise<PlanExecuteResult>;
```

| Option              | Default | Meaning |
| ------------------- | ------- | ------- |
| `maxReplans`        | `2`     | How many times you may plan again |
| `stepRetries`       | `1`     | Extra attempts per failing step |
| `maxStepExecutions` | `20`    | Maximum number of tool runs in one run |

`deps` (fakes in the tests):
- `planner({ goal, memories, completed, failure })` returns `{ steps: [{ id, tool, args, description }] }`.
- `tools[name](args)` returns the step output, or throws.
- `memory.load(userId)` and `memory.save(userId, facts)`.
- `extractMemories({ goal, results })` returns `string[]`.

## Flow

```
load memories  → memories = await memory.load(userId)           (once)
plan           → planner({ goal, memories, completed: <successful results so far>, failure })
                   first plan: completed = [], failure = undefined
check the plan → valid = 1–10 steps, ids non-empty and unique, every tool exists in deps.tools
                   invalid: if replans < maxReplans → replans++, plan again with failure = { stepId: null, error: "invalid_plan" }
                            else → FAIL "invalid_plan"
run steps      → in order, one at a time:
                   if executions === maxStepExecutions → FAIL "budget_exceeded"
                   run tools[step.tool](step.args), executions++, add a result
                   on failure: retry while attempt <= stepRetries
                   still failing: if replans < maxReplans → replans++, plan again with
                                     failure = { stepId, error: <message> }, run the NEW plan from its first step
                                  else → FAIL "step_failed"
finish         → all steps ok: facts = extractMemories({ goal, results }); if facts.length > 0 → memory.save(userId, facts)
```

- **Each result:** `{ stepId, tool, ok, attempt, output? (on success), error? (message, on failure) }`. `attempt` starts at 1 for each step.
- A failed run does **not** extract or save memories.
- Errors from `planner`, `memory` or `extractMemories` are thrown to the caller.

## `runPlanExecute(agent, { goal, userId, threadId })`

- If `goal` or `userId` is blank, throw `ValidationError` (from `src/shared/errors.ts`).
- Run the graph with `{ configurable: { thread_id: threadId } }`. The final state is saved in the checkpointer, and threads don't share state.
- **Return:** `{ status: "completed" | "failed", failureReason: null | "invalid_plan" | "step_failed" | "budget_exceeded", results, replans, executions, memories }`. `memories` are the memories loaded at the start.

## Examples

Goal `"Thank our top customer"`, user `u-1`, stored memories `["Our CRM is Salesforce"]`.

**Replan after a failing step**

| # | What happens |
| - | ------------ |
| 1 | planner → `[s1 find_top_customer, s2 send_email]` |
| 2 | `find_top_customer` → `{ name: "Acme" }` (ok, attempt 1) |
| 3 | `send_email` throws `"SMTP down"` (attempt 1), retried, throws again (attempt 2) |
| 4 | planner again with `completed: [s1 result]`, `failure: { stepId: "s2", error: "SMTP down" }` → `[s3 create_task]` |
| 5 | `create_task` → `{ taskId: "t-1" }` (ok) |
| 6 | `extractMemories` → `["Top customer is Acme"]` → `memory.save("u-1", ["Top customer is Acme"])` |

```ts
await runPlanExecute(agent, { goal: "Thank our top customer", userId: "u-1", threadId: "th-1" });
// → { status: "completed", failureReason: null, replans: 1, executions: 4,
//     results: [
//       { stepId: "s1", tool: "find_top_customer", ok: true,  attempt: 1, output: { name: "Acme" } },
//       { stepId: "s2", tool: "send_email",        ok: false, attempt: 1, error: "SMTP down" },
//       { stepId: "s2", tool: "send_email",        ok: false, attempt: 2, error: "SMTP down" },
//       { stepId: "s3", tool: "create_task",       ok: true,  attempt: 1, output: { taskId: "t-1" } } ],
//     memories: ["Our CRM is Salesforce"] }
```

**Every plan invalid** (e.g. it uses a tool that doesn't exist)

```ts
// → { status: "failed", failureReason: "invalid_plan", replans: 2, executions: 0, results: [], ... }
```

**Steps keep failing after all replans**

```ts
// → { status: "failed", failureReason: "step_failed", ... }   (memory.save not called)
```

**Blank goal**

```ts
await runPlanExecute(agent, { goal: " ", userId: "u-1", threadId: "th-2" });   // → throws ValidationError
```

## Rules

- Use LangGraph (`@langchain/langgraph` is installed).
- Edit only `task3.ts`. Do not change the tests.
