import { describe, expect, it, vi } from "vitest";
import { createAgentRunner, type Run, type RunStore, type Tool } from "../../src/backend/task20/task20";

function memoryStore(): RunStore {
  const runs = new Map<string, Run>();
  return { get: (id) => (runs.has(id) ? structuredClone(runs.get(id)!) : undefined), save: (run) => void runs.set(run.id, structuredClone(run)) };
}

function setup(options: { failLogOnce?: boolean } = {}) {
  let logFailed = false;
  const tools = {
    search: { requiresApproval: false, execute: vi.fn(async (args: Record<string, unknown>) => `results for ${args.q}`) },
    send_email: { requiresApproval: true, execute: vi.fn(async () => "email sent") },
    log: {
      requiresApproval: false,
      execute: vi.fn(async () => {
        if (options.failLogOnce && !logFailed) {
          logFailed = true;
          throw new Error("log service down");
        }
        return "logged";
      }),
    },
  } satisfies Record<string, Tool>;
  const store = memoryStore();
  return { tools, store, runner: createAgentRunner({ tools, store }) };
}

const steps = [
  { tool: "search", args: { q: "flights" } },
  { tool: "send_email", args: { to: "ana@example.com" } },
  { tool: "log", args: {} },
];

async function throws(fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

describe("BACKEND-020", () => {
  describe("start", () => {
    it("runs steps that need no approval to completion", async () => {
      const { runner, store } = setup();
      const run = await runner.start([steps[0]!, steps[2]!]);
      expect(run, 'Both steps run, so the run is "completed"').toMatchObject({
        status: "completed",
        nextStep: 2,
        results: ["results for flights", "logged"],
        error: null,
      });
      expect(store.get(run.id)?.status, "The finished run must be saved in the store").toBe("completed");
    });

    it("pauses before a step that needs approval", async () => {
      const { runner, tools, store } = setup();
      const run = await runner.start(steps);
      expect(run, 'The run waits at step 1 (send_email) with status "waiting_approval"').toMatchObject({
        status: "waiting_approval",
        nextStep: 1,
        results: ["results for flights"],
      });
      expect(tools.send_email.execute, "send_email must not run before approval").not.toHaveBeenCalled();
      expect(tools.log.execute, "Steps after the paused one must not run").not.toHaveBeenCalled();
      expect(store.get(run.id)?.status, "The paused run must be saved").toBe("waiting_approval");
    });

    it("fails on an unknown tool", async () => {
      const { runner } = setup();
      const run = await runner.start([{ tool: "delete_everything", args: {} }]);
      expect(run, 'An unknown tool fails the run with "Unknown tool: delete_everything"').toMatchObject({
        status: "failed",
        error: "Unknown tool: delete_everything",
      });
    });
  });

  describe("approve and reject", () => {
    it("approve runs the waiting step and continues", async () => {
      const { runner, tools } = setup();
      const { id } = await runner.start(steps);
      const run = await runner.approve(id);
      expect(run, 'After approval, all steps run and the run is "completed"').toMatchObject({
        status: "completed",
        nextStep: 3,
        results: ["results for flights", "email sent", "logged"],
      });
      expect(tools.send_email.execute, "send_email runs once, with its args").toHaveBeenCalledExactlyOnceWith({ to: "ana@example.com" });
      expect(tools.search.execute, "search must not run again").toHaveBeenCalledTimes(1);
    });

    it("reject cancels the run without executing the step", async () => {
      const { runner, tools } = setup();
      const { id } = await runner.start(steps);
      const run = await runner.reject(id);
      expect(run.status, 'A rejected run is "cancelled"').toBe("cancelled");
      expect(tools.send_email.execute, "A rejected step must never run").not.toHaveBeenCalled();
      expect(await throws(() => runner.approve(id)), "A cancelled run can not be approved").toBe(true);
    });

    it("continues with a new runner that shares the store (after a restart)", async () => {
      const { runner, tools, store } = setup();
      const { id } = await runner.start(steps);
      const afterRestart = createAgentRunner({ tools, store });
      const run = await afterRestart.approve(id);
      expect(run.status, "A new runner must load the run from the store and finish it").toBe("completed");
    });
  });

  describe("retry", () => {
    it("continues a failed run from the failed step", async () => {
      const { runner, tools } = setup({ failLogOnce: true });
      const { id } = await runner.start(steps);
      const failed = await runner.approve(id);
      expect(failed, 'log throws, so the run is "failed" at step 2 with the error').toMatchObject({
        status: "failed",
        nextStep: 2,
        error: "log service down",
      });

      const run = await runner.retry(id);
      expect(run, 'After retry the run is "completed"').toMatchObject({ status: "completed", error: null, results: ["results for flights", "email sent", "logged"] });
      expect(tools.send_email.execute, "Finished steps must not run again on retry").toHaveBeenCalledTimes(1);
      expect(await throws(() => runner.retry(id)), "Only a failed run can be retried").toBe(true);
    });
  });
});
