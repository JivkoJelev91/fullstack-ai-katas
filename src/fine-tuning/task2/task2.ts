/**
 * FT-002: Fine-Tuning Dataset Preparation (JSONL)
 * Specification: ./task2.md (in this folder)
 * Run the tests: npm run test:ft:2
 *
 * Keep the exported types and signatures unchanged; the tests depend on them.
 */

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export type ChatRole = "system" | "user" | "assistant";

export interface ChatRecord {
  messages: Array<{ role: ChatRole; content: string }>;
}

export interface Tokenizer {
  countTokens(text: string): number;
}

export interface PrepareDatasetOptions {
  tokenizer: Tokenizer;
  maxTokens: number;
  validationFraction: number;
  scrubPII?: boolean;
  evalPrompts?: string[];
}

export type RejectReason = "invalid_json" | "invalid_schema" | "contaminated" | "duplicate" | "too_long";

export interface PreparedDataset {
  train: ChatRecord[];
  validation: ChatRecord[];
  rejected: Array<{ line: number; reason: RejectReason }>;
  stats: {
    totalLines: number;
    accepted: number;
    rejectedByReason: Record<RejectReason, number>;
    totalTokens: number;
    maxRecordTokens: number;
  };
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function prepareDataset(jsonl: string, options: PrepareDatasetOptions): PreparedDataset {
  // TODO: input lines and options
  // TODO: checks and scrubbing
  // TODO: split
  // TODO: output and stats
  throw new Error("FT-002 prepareDataset is not implemented yet");
}

export function toJsonl(records: ChatRecord[]): string {
  // TODO: see the specification
  throw new Error("FT-002 toJsonl is not implemented yet");
}
