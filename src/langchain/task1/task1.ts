/**
 * LC-001: Release Notes Chain with LCEL, Retries and Fallback
 * Specification: ./task1.md (in this folder)
 * Run the tests: npm run test:langchain:1
 *
 * Keep the exported types and signature unchanged; the tests depend on them.
 */
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { OutputParserException } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableLambda, type Runnable } from "@langchain/core/runnables";
import { ValidationError } from "../../shared/errors";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface ReleaseNotesInput {
  commits: string[];
  audience: "developers" | "customers";
}

export interface ReleaseNotes {
  headline: string;
  highlights: string[];
  breakingChanges: string[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createReleaseNotesChain(deps: { model: BaseChatModel; fallbackModel?: BaseChatModel }): Runnable<ReleaseNotesInput, ReleaseNotes> {
  // TODO: input validation step
  // TODO: prompt
  // TODO: output parser
  // TODO: retries and fallback
  // TODO: compose the chain
  throw new Error("LC-001 createReleaseNotesChain is not implemented yet");
}
