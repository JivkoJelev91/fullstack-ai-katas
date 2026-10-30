import { MemorySaver } from "@langchain/langgraph";
import { describe, expect, it, vi } from "vitest";
import { buildPlanExecuteAgent, runPlanExecute, type Plan, type PlanExecuteDeps, type PlannerInput } from "../../src/agents/task3/task3";
import { ValidationError } from "../../src/shared/errors";
import { expectRejects } from "../support/expect-rejects";

const step = (id: string, tool: string, args: Record<string, unknown> = {}) => ({ id, tool, args, description: `${tool} step` });

function setup(plans: Array<Plan | Error>, tools: PlanExecuteDeps["tools"], extra: { memories?: string[]; facts?: string[] } = {}) {
  const planInputs: PlannerInput[] = [];
  let p = 0;
  const deps = {
    planner: vi.fn(async (input: PlannerInput) => {
      planInputs.push(structuredClone(input));
      const plan = plans[Math.min(p++, plans.length - 1)]!;
      if (plan instanceof Error) throw plan;
      return plan;
    }),
    tools,
    memory: { load: vi.fn(async (_u: string) => extra.memories ?? ["Our CRM is Salesforce"]), save: vi.fn(async (_u: string, _f: string[]) => {}) },
    extractMemories: vi.fn(async (_i: { goal: string; results: unknown[] }) => extra.facts ?? ["Top customer is Acme"]),
  } satisfies PlanExecuteDeps;
  return { deps, planInputs };
}

function flaky(failures: number, value: unknown = "ok", message = "SMTP down") {
  let n = 0;
  return vi.fn(async (_a: Record<string, unknown>) => {
    if (n++ < failures) throw new Error(message);
    return value;
  });
}

const run = (deps: PlanExecuteDeps, opts: Partial<Parameters<typeof buildPlanExecuteAgent>[1]> = {}, threadId = "t1") =>
  runPlanExecute(buildPlanExecuteAgent(deps, { checkpointer: new MemorySaver(), ...opts }), { goal: "Thank our top customer", userId: "u-1", threadId });

describe("AGENT-003", () => {
  it("plans, executes steps in order, and saves memories", async () => {
    const tools = { find_top_customer: vi.fn(async () => ({ name: "Acme" })), send_email: vi.fn(async () => "sent") };
    const { deps, planInputs } = setup([{ steps: [step("s1", "find_top_customer", { quarter: "Q3" }), step("s2", "send_email", { to: "acme" })] }], tools);
    const result = await run(deps);

    expect(result).toEqual({
      status: "completed",
      failureReason: null,
      replans: 0,
      executions: 2,
      memories: ["Our CRM is Salesforce"],
      results: [
        { stepId: "s1", tool: "find_top_customer", ok: true, attempt: 1, output: { name: "Acme" } },
        { stepId: "s2", tool: "send_email", ok: true, attempt: 1, output: "sent" },
      ],
    });
    expect(tools.find_top_customer).toHaveBeenCalledWith({ quarter: "Q3" });
    expect(tools.send_email).toHaveBeenCalledWith({ to: "acme" });
    expect(tools.find_top_customer.mock.invocationCallOrder[0]!).toBeLessThan(tools.send_email.mock.invocationCallOrder[0]!);
    expect(deps.memory.load).toHaveBeenCalledTimes(1);
    expect(deps.memory.load).toHaveBeenCalledWith("u-1");
    expect(planInputs).toEqual([{ goal: "Thank our top customer", memories: ["Our CRM is Salesforce"], completed: [], failure: undefined }]);
    expect(deps.extractMemories).toHaveBeenCalledWith({ goal: "Thank our top customer", results: result.results });
    expect(deps.memory.save).toHaveBeenCalledWith("u-1", ["Top customer is Acme"]);
  });

  it("does not save when no facts are extracted", async () => {
    const { deps } = setup([{ steps: [step("s1", "noop")] }], { noop: async () => null }, { facts: [] });
    expect((await run(deps)).status).toBe("completed");
    expect(deps.memory.save).not.toHaveBeenCalled();
  });

  it("retries a failing step before moving on", async () => {
    const send = flaky(1, "sent");
    const { deps } = setup([{ steps: [step("s1", "send_email")] }], { send_email: send });
    const result = await run(deps);
    expect(result.results).toEqual([
      { stepId: "s1", tool: "send_email", ok: false, attempt: 1, error: "SMTP down" },
      { stepId: "s1", tool: "send_email", ok: true, attempt: 2, output: "sent" },
    ]);
    expect(result).toMatchObject({ status: "completed", replans: 0, executions: 2 });
    expect(deps.planner).toHaveBeenCalledTimes(1);
  });

  it("replans with failure context after retries are exhausted", async () => {
    const tools = {
      find_top_customer: vi.fn(async () => ({ name: "Acme" })),
      send_email: flaky(99),
      create_task: vi.fn(async () => "task-1"),
    };
    const { deps, planInputs } = setup(
      [{ steps: [step("s1", "find_top_customer"), step("s2", "send_email")] }, { steps: [step("s3", "create_task", { title: "Call Acme" })] }],
      tools,
    );
    const result = await run(deps);

    expect(result.status).toBe("completed");
    expect(result.replans).toBe(1);
    expect(result.executions).toBe(4);
    expect(result.results.map((r) => [r.stepId, r.ok, r.attempt])).toEqual([
      ["s1", true, 1],
      ["s2", false, 1],
      ["s2", false, 2],
      ["s3", true, 1],
    ]);
    expect(planInputs[1]).toEqual({
      goal: "Thank our top customer",
      memories: ["Our CRM is Salesforce"],
      completed: [{ stepId: "s1", tool: "find_top_customer", ok: true, attempt: 1, output: { name: "Acme" } }],
      failure: { stepId: "s2", error: "SMTP down" },
    });
    expect(tools.create_task).toHaveBeenCalledWith({ title: "Call Acme" });
    expect(tools.find_top_customer).toHaveBeenCalledTimes(1);
  });

  it("fails with step_failed when replans are exhausted and saves no memories", async () => {
    const { deps } = setup([{ steps: [step("s1", "send_email")] }], { send_email: flaky(99) });
    const result = await run(deps, { maxReplans: 1, stepRetries: 0 });
    expect(result).toMatchObject({ status: "failed", failureReason: "step_failed", replans: 1, executions: 2 });
    expect(deps.planner).toHaveBeenCalledTimes(2);
    expect(deps.extractMemories).not.toHaveBeenCalled();
    expect(deps.memory.save).not.toHaveBeenCalled();
  });

  it("uses the defaults of one retry and two replans", async () => {
    const send = flaky(99);
    const { deps } = setup([{ steps: [step("s1", "send_email")] }], { send_email: send });
    const result = await run(deps);
    expect(result).toMatchObject({ status: "failed", failureReason: "step_failed", replans: 2, executions: 6 });
    expect(send).toHaveBeenCalledTimes(6);
  });

  it.each<[string, Plan]>([
    ["an empty plan", { steps: [] }],
    ["an unknown tool", { steps: [step("s1", "launch_missiles")] }],
    ["duplicate step ids", { steps: [step("s1", "noop"), step("s1", "noop")] }],
    ["an empty step id", { steps: [step("", "noop")] }],
    ["more than 10 steps", { steps: Array.from({ length: 11 }, (_, i) => step(`s${i}`, "noop")) }],
  ])("replans after %s", async (_label, bad) => {
    const noop = vi.fn(async () => "done");
    const { deps, planInputs } = setup([bad, { steps: [step("ok", "noop")] }], { noop });
    const result = await run(deps);
    expect(result).toMatchObject({ status: "completed", replans: 1, executions: 1 });
    expect(planInputs[1]!.failure).toEqual({ stepId: null, error: "invalid_plan" });
    expect(noop).toHaveBeenCalledTimes(1);
  });

  it("fails with invalid_plan when every plan is invalid", async () => {
    const { deps } = setup([{ steps: [step("s1", "nope")] }], { noop: async () => null });
    const result = await run(deps, { maxReplans: 2 });
    expect(result).toMatchObject({ status: "failed", failureReason: "invalid_plan", replans: 2, executions: 0, results: [] });
    expect(deps.planner).toHaveBeenCalledTimes(3);
  });

  it("stops at the execution budget", async () => {
    const noop = vi.fn(async () => "x");
    const { deps } = setup([{ steps: Array.from({ length: 5 }, (_, i) => step(`s${i}`, "noop")) }], { noop });
    const result = await run(deps, { maxStepExecutions: 3 });
    expect(result).toMatchObject({ status: "failed", failureReason: "budget_exceeded", executions: 3 });
    expect(noop).toHaveBeenCalledTimes(3);
    expect(deps.memory.save).not.toHaveBeenCalled();
  });

  it("supports long plans within the default budget", async () => {
    const noop = vi.fn(async () => "x");
    const { deps } = setup([{ steps: Array.from({ length: 10 }, (_, i) => step(`s${i}`, "noop")) }], { noop });
    expect(await run(deps)).toMatchObject({ status: "completed", executions: 10 });
  });

  it("propagates planner errors", async () => {
    const { deps } = setup([new Error("planner model unavailable")], {});
    await expect(run(deps)).rejects.toThrow("planner model unavailable");
  });

  it("persists the final state per thread", async () => {
    const { deps } = setup([{ steps: [step("s1", "noop")] }], { noop: async () => "x" });
    const agent = buildPlanExecuteAgent(deps, { checkpointer: new MemorySaver() });
    await runPlanExecute(agent, { goal: "A", userId: "u-1", threadId: "a" });
    await runPlanExecute(agent, { goal: "B", userId: "u-2", threadId: "b" });
    expect((await agent.getState({ configurable: { thread_id: "a" } })).values).toMatchObject({ goal: "A", status: "completed" });
    expect((await agent.getState({ configurable: { thread_id: "b" } })).values).toMatchObject({ goal: "B", userId: "u-2" });
    expect(deps.memory.load.mock.calls.map(([u]) => u)).toEqual(["u-1", "u-2"]);
  });

  it("rejects a blank goal or userId", async () => {
    const { deps } = setup([{ steps: [step("s1", "noop")] }], { noop: async () => null });
    const agent = buildPlanExecuteAgent(deps, { checkpointer: new MemorySaver() });
    await expectRejects(runPlanExecute(agent, { goal: " ", userId: "u", threadId: "t" }), ValidationError);
    await expectRejects(runPlanExecute(agent, { goal: "x", userId: "", threadId: "t" }), ValidationError);
    expect(deps.planner).not.toHaveBeenCalled();
  });
});
