/**
 * AI-001: Support Ticket Triage with an LLM
 * Specification: ./task1.md (in this folder)
 * Run the tests: npm run test:ai:1
 *
 * Keep the exported types, classes, constant and signature unchanged; the tests depend on them.
 */
import type { ChatMessage, CompletionRequest, CompletionResponse, LLMClient, TokenUsage } from "../shared/llm";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export const DEFAULT_TRIAGE_MODEL = "triage-model-small";

export type TicketCategory = "billing" | "bug" | "feature_request" | "account" | "other";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type CustomerTier = "free" | "pro" | "enterprise";

export interface SupportTicket {
  subject: string;
  body: string;
  customerTier: CustomerTier;
}

/** The fields the model must return. */
export interface TriageOutput {
  category: TicketCategory;
  priority: TicketPriority;
  summary: string;
  needsHuman: boolean;
}

export interface TriageResult extends TriageOutput {
  attempts: number;
  usage: TokenUsage;
}

export class TicketValidationError extends Error {
  constructor(
    readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "TicketValidationError";
  }
}

export class TriageOutputError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
  ) {
    super(message);
    this.name = "TriageOutputError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function triageTicket(ticket: SupportTicket, deps: { llm: LLMClient; model?: string }): Promise<TriageResult> {
  // TODO: input validation
  // TODO: model request
  // TODO: output parsing and validation
  // TODO: recovery
  // TODO: business rules and result
  throw new Error("AI-001 is not implemented yet");
}
