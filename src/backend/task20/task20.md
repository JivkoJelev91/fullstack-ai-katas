# Agent Runs with Human Approval

**Task ID:** BACKEND-020 · **Level:** 2 · **File:** `src/backend/task20/task20.ts` · **Tests:** `npm run test:backend:20`

An AI agent works through steps by calling tools ("search the web", "send email", "issue refund"). Some tools are risky, so a human must approve them first. Approval can take hours, so the run **pauses**, its state is **saved**, and it **continues later**, possibly in another server process. When a step fails, the run can be **retried from that step** without repeating the work already done.

Here the steps are given as a list (choosing the steps is the model's job, covered in the AGENT tasks). You write the runner.

## The run loop

All four functions use the same loop. While `nextStep < steps.length`:

1. Take `step = steps[nextStep]` and `tool = tools[step.tool]`. Unknown tool: `status: "failed"`, `error: "Unknown tool: <name>"`, stop.
2. If `tool.requiresApproval` and this step isn't approved yet: `status: "waiting_approval"`, stop.
3. Run `await tool.execute(step.args)`. Add the result to `results` and increase `nextStep`.
4. If `execute` throws: `status: "failed"`, `error` = the message, stop. `nextStep` stays on the failed step.

When all steps are done: `status: "completed"`.

**Save the run with `store.save(run)` after every step and on every stop.** Each function must read the run from `store.get(runId)`, never from a variable inside the runner. That way a new runner (for example after a server restart) continues where the old one stopped.

## The four functions

| Function | REQUIREMENT |
| --- | --- |
| `start(steps)` | Create `{ id: randomUUID(), steps, nextStep: 0, status: "running", results: [], error: null }`, save it, run the loop, and return the run. |
| `approve(runId)` | The run must be `"waiting_approval"`, otherwise throw an `Error`. Set `"running"`, run the loop with the **current** step counted as approved, and return the run. |
| `reject(runId)` | The run must be `"waiting_approval"`, otherwise throw. Set `"cancelled"`, save it, and return it. The step is never executed. |
| `retry(runId)` | The run must be `"failed"`, otherwise throw. Set `"running"` and `error: null`, then run the loop again **from `nextStep`**: finished steps don't run again. |

**Example:** steps `search` → `send_email` (needs approval) → `log`

| Call | status | nextStep | Tools executed so far |
| --- | --- | --- | --- |
| `start(steps)` | `waiting_approval` | 1 | search |
| `approve(id)` | `completed` | 3 | search, send_email, log |

Or, instead of approving: `reject(id)` gives `cancelled`, and `send_email` never runs.

## How to check your work

Run `npm run test:backend:20`.

## Rules

- Edit only `task20.ts`.
