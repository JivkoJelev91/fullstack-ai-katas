/**
 * LC-003: Ticket Workflow with LangGraph and Checkpointing
 * Specification: ./task3.md (in this folder)
 * Run the tests: npm run test:langchain:3
 *
 * Keep the exported types and signature unchanged; the tests depend on them.
 */
import { Annotation, END, START, StateGraph, type BaseCheckpointSaver } from "@langchain/langgraph";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export type TicketStatus = "new" | "approved" | "escalated";
export type EscalationReason = "low_confidence" | "sensitive_category" | "max_revisions";

export interface TicketStateValues {
  ticket: string;
  category: string | null;
  confidence: number | null;
  drafts: string[];
  feedback: string[];
  revisions: number;
  status: TicketStatus;
  finalReply: string | null;
  escalationReason: EscalationReason | null;
}

export interface TicketDeps {
  classify(ticket: string): Promise<{ category: string; confidence: number }>;
  draft(input: { ticket: string; category: string; feedback: string[] }): Promise<string>;
  review(draft: string): Promise<{ approved: boolean; feedback: string }>;
}

export interface TicketWorkflowOptions {
  checkpointer: BaseCheckpointSaver;
  maxRevisions?: number;
  minConfidence?: number;
  escalationCategories?: string[];
}

export interface ThreadConfig {
  configurable: { thread_id: string };
}

/** The parts of a compiled LangGraph graph used by the tests. */
export interface TicketWorkflow {
  invoke(input: { ticket: string } | null, config: ThreadConfig): Promise<TicketStateValues>;
  getState(config: ThreadConfig): Promise<{ values: Partial<TicketStateValues>; next: readonly string[] }>;
  getStateHistory(config: ThreadConfig): AsyncIterableIterator<unknown>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function buildTicketWorkflow(deps: TicketDeps, options: TicketWorkflowOptions): TicketWorkflow {
  // TODO: state definition with reducers and defaults
  // TODO: nodes and conditional edges
  // TODO: compile with the checkpointer
  throw new Error("LC-003 buildTicketWorkflow is not implemented yet");
}
