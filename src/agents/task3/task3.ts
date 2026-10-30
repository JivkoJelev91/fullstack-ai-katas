/**
 * AGENT-003: Plan-and-Execute Agent with Replanning and Memory
 * Specification: ./task3.md (in this folder)
 * Run the tests: npm run test:agents:3
 *
 * Keep the exported types and signatures unchanged; the tests depend on them.
 */
import { Annotation, END, START, StateGraph, type BaseCheckpointSaver } from "@langchain/langgraph";
import { ValidationError } from "../../shared/errors";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface PlanStep {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  description: string;
}

export interface Plan {
  steps: PlanStep[];
}

export interface StepResult {
  stepId: string;
  tool: string;
  ok: boolean;
  attempt: number;
  output?: unknown;
  error?: string;
}

export interface PlannerInput {
  goal: string;
  memories: string[];
  completed: StepResult[];
  failure: { stepId: string | null; error: string } | undefined;
}

export interface PlanExecuteDeps {
  planner(input: PlannerInput): Promise<Plan>;
  tools: Record<string, (args: Record<string, unknown>) => Promise<unknown>>;
  memory: {
    load(userId: string): Promise<string[]>;
    save(userId: string, facts: string[]): Promise<void>;
  };
  extractMemories(input: { goal: string; results: StepResult[] }): Promise<string[]>;
}

export interface PlanExecuteOptions {
  checkpointer: BaseCheckpointSaver;
  maxReplans?: number;
  stepRetries?: number;
  maxStepExecutions?: number;
}

export type FailureReason = "invalid_plan" | "step_failed" | "budget_exceeded";

export interface PlanExecuteResult {
  status: "completed" | "failed";
  failureReason: FailureReason | null;
  results: StepResult[];
  replans: number;
  executions: number;
  memories: string[];
}

/** A compiled LangGraph graph. */
export type PlanExecuteAgent = {
  invoke(input: unknown, config: { configurable: { thread_id: string }; recursionLimit?: number }): Promise<unknown>;
  getState(config: { configurable: { thread_id: string } }): Promise<{ values: Record<string, unknown>; next: readonly string[] }>;
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function buildPlanExecuteAgent(deps: PlanExecuteDeps, options: PlanExecuteOptions): PlanExecuteAgent {
  // TODO: defaults
  // TODO: state definition
  // TODO: nodes and edges
  throw new Error("AGENT-003 buildPlanExecuteAgent is not implemented yet");
}

export async function runPlanExecute(
  agent: PlanExecuteAgent,
  input: { goal: string; userId: string; threadId: string },
): Promise<PlanExecuteResult> {
  // TODO: see the specification
  throw new Error("AGENT-003 runPlanExecute is not implemented yet");
}
