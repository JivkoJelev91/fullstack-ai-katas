/**
 * RAG-005: Grounded Answers with Verified Citations
 * Specification: ./task5.md (in this folder)
 * Run the tests: npm run test:rag:5
 *
 * Keep the exported types, class, constant and signature unchanged; the tests depend on them.
 */
import type { ChatMessage, LLMClient, TokenUsage } from "../../ai/shared/llm";
import { ValidationError } from "../../shared/errors";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export const DEFAULT_ANSWER_MODEL = "rag-answer-model";

export interface RetrievedChunk {
  chunkId: string;
  docId: string;
  title: string;
  url: string;
  text: string;
  score: number;
}

export interface CitedAnswerDeps {
  retrieve(question: string): Promise<RetrievedChunk[]>;
  llm: LLMClient;
  model?: string;
}

export interface CitedAnswerOptions {
  minScore: number;
  maxContextChars: number;
}

export interface Citation {
  source: number;
  quote: string;
  chunkId: string;
  docId: string;
  title: string;
  url: string;
}

export interface SourceRef {
  docId: string;
  title: string;
  url: string;
}

export type CitedAnswer =
  | { status: "answered"; answer: string; citations: Citation[]; sources: SourceRef[]; attempts: number; usage: TokenUsage }
  | { status: "insufficient_context"; answer: null; citations: []; sources: []; attempts: number; usage: TokenUsage };

export class CitationValidationError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
  ) {
    super(message);
    this.name = "CitationValidationError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function answerWithCitations(question: string, deps: CitedAnswerDeps, options: CitedAnswerOptions): Promise<CitedAnswer> {
  // TODO: input validation and retrieval
  // TODO: context selection
  // TODO: model request
  // TODO: output parsing and citation verification
  // TODO: recovery
  // TODO: result
  throw new Error("RAG-005 answerWithCitations is not implemented yet");
}
