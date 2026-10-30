/**
 * LC-004: Refund Approval with Human-in-the-Loop (LangGraph)
 * Specification: ./task4.md (in this folder)
 * Run the tests: npm run test:langchain:4
 *
 * Keep the exported types, classes and signatures unchanged; the tests depend on them.
 */
import { Annotation, Command, END, interrupt, START, StateGraph, type BaseCheckpointSaver } from "@langchain/langgraph";
import { ValidationError } from "../../shared/errors";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface RefundDeps {
  assess(input: { orderId: string; reason: string }): Promise<{ eligible: boolean; amount: number }>;
  payments: {
    refund(orderId: string, amount: number, idempotencyKey: string): Promise<{ refundId: string }>;
  };
}

export interface RefundOptions {
  checkpointer: BaseCheckpointSaver;
  autoApproveLimit: number;
}

export interface ApprovalRequest {
  type: "refund_approval";
  orderId: string;
  amount: number;
  reason: string;
  message?: string;
}

export type ApprovalDecision =
  | { decision: "approve"; reviewer: string }
  | { decision: "reject"; reviewer: string; note?: string }
  | { decision: "edit"; reviewer: string; amount: number };

export type RefundOutcome =
  | { status: "awaiting_approval"; request: ApprovalRequest; audit: string[] }
  | { status: "refunded"; refundId: string; amount: number; audit: string[] }
  | { status: "rejected"; reviewer: string; note: string | null; audit: string[] }
  | { status: "not_eligible"; audit: string[] };

/** A compiled LangGraph graph. */
export type RefundWorkflow = {
  invoke(input: unknown, config: { configurable: { thread_id: string } }): Promise<unknown>;
  getState(config: { configurable: { thread_id: string } }): Promise<{ values: Record<string, unknown>; next: readonly string[]; tasks: ReadonlyArray<{ interrupts: ReadonlyArray<{ value?: unknown }> }> }>;
};

export class NoPendingApprovalError extends Error {
  constructor(readonly threadId: string) {
    super(`No pending approval for thread ${threadId}`);
    this.name = "NoPendingApprovalError";
  }
}

export class ThreadInUseError extends Error {
  constructor(readonly threadId: string) {
    super(`Thread ${threadId} already exists`);
    this.name = "ThreadInUseError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function buildRefundWorkflow(deps: RefundDeps, options: RefundOptions): RefundWorkflow {
  // TODO: state with an appending audit log
  // TODO: nodes and edges
  throw new Error("LC-004 buildRefundWorkflow is not implemented yet");
}

export async function startRefund(workflow: RefundWorkflow, threadId: string, input: { orderId: string; reason: string }): Promise<RefundOutcome> {
  // TODO: see the specification
  throw new Error("LC-004 startRefund is not implemented yet");
}

export async function resumeRefund(workflow: RefundWorkflow, threadId: string, decision: ApprovalDecision): Promise<RefundOutcome> {
  // TODO: see the specification
  throw new Error("LC-004 resumeRefund is not implemented yet");
}
