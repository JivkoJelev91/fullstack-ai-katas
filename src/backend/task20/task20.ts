/**
 * BACKEND-020: Agent Runs with Human Approval
 * Specification: ./task20.md (in this folder)
 * Run the tests: npm run test:backend:20
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import { randomUUID } from "node:crypto";

export interface ToolStep {
  tool: string;
  args: Record<string, unknown>;
}

export interface Tool {
  /** true: a human must approve this step before it runs. */
  requiresApproval: boolean;
  execute(args: Record<string, unknown>): Promise<unknown>;
}

export type RunStatus = "running" | "waiting_approval" | "completed" | "failed" | "cancelled";

export interface Run {
  id: string;
  steps: ToolStep[];
  /** Index of the next step to run. Steps before it are done. */
  nextStep: number;
  status: RunStatus;
  /** The result of each finished step, in order. */
  results: unknown[];
  error: string | null;
}

/** Where runs are kept between calls (a database in a real app). */
export interface RunStore {
  get(id: string): Run | undefined;
  save(run: Run): void;
}

export function createAgentRunner(_deps: { tools: Record<string, Tool>; store: RunStore }) {
  void randomUUID;

  return {
    async start(_steps: ToolStep[]): Promise<Run> {
      throw new Error("Not implemented: start");
    },

    async approve(_runId: string): Promise<Run> {
      throw new Error("Not implemented: approve");
    },

    async reject(_runId: string): Promise<Run> {
      throw new Error("Not implemented: reject");
    },

    async retry(_runId: string): Promise<Run> {
      throw new Error("Not implemented: retry");
    },
  };
}
