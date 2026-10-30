/**
 * BACKEND-024: Capstone 1: Chat API
 * Specification: ./task24.md (in this folder)
 * Run the tests: npm run test:backend:24
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 * You may copy code from your earlier BACKEND tasks into this file.
 */
import type { Express } from "express";
import type { LLMClient } from "../shared";

export const SYSTEM_PROMPT = "You are a helpful assistant.";
export const MODEL = "chat-small";

export interface AuthUser {
  id: string;
  email: string;
}

export interface TokenVerifier {
  /** Resolves to the user for a valid token, or null for an invalid one. */
  verify(token: string): Promise<AuthUser | null>;
}

export function createAiBackend(_deps: { verifier: TokenVerifier; llm: LLMClient }): Express {
  throw new Error("Not implemented: createAiBackend");
}
