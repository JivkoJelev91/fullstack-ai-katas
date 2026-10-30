/**
 * AIOPS-001: LLM Security: PII Redaction and Prompt-Injection Defense
 * Specification: ./task1.md (in this folder)
 * Run the tests: npm run test:aiops:1
 *
 * Keep the exported types and signatures unchanged; the tests depend on them.
 */
import type { ChatMessage } from "../../ai/shared/llm";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export type PiiType = "EMAIL" | "CARD" | "PHONE";

export type PiiVault = Record<string, { type: PiiType; value: string }>;

export interface RedactionResult {
  text: string;
  vault: PiiVault;
}

export type InjectionSignal = "override_instructions" | "role_impersonation" | "prompt_exfiltration" | "hidden_characters" | "encoded_payload";

export interface InjectionScan {
  score: number;
  signals: InjectionSignal[];
}

export interface OutputCheck {
  safe: boolean;
  reasons: Array<"canary_leak" | "system_prompt_leak">;
}

export interface PrepareInput {
  system: string;
  userInput: string;
  documents: Array<{ id: string; text: string }>;
}

export interface PrepareOptions {
  canary: string;
  quarantineThreshold?: number;
}

export interface PreparedRequest {
  messages: ChatMessage[];
  vault: PiiVault;
  quarantined: string[];
  canary: string;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function redactPII(text: string): RedactionResult {
  // TODO: see the specification
  throw new Error("AIOPS-001 redactPII is not implemented yet");
}

export function restorePII(text: string, vault: PiiVault, options: { allow: PiiType[] }): string {
  // TODO: see the specification
  throw new Error("AIOPS-001 restorePII is not implemented yet");
}

export function scanForInjection(text: string): InjectionScan {
  // TODO: see the specification
  throw new Error("AIOPS-001 scanForInjection is not implemented yet");
}

export function wrapUntrusted(source: string, text: string): string {
  // TODO: see the specification
  throw new Error("AIOPS-001 wrapUntrusted is not implemented yet");
}

export function checkOutput(output: string, guard: { canary: string; systemPrompt: string }): OutputCheck {
  // TODO: see the specification
  throw new Error("AIOPS-001 checkOutput is not implemented yet");
}

export function prepareRequest(input: PrepareInput, options: PrepareOptions): PreparedRequest {
  // TODO: see the specification
  throw new Error("AIOPS-001 prepareRequest is not implemented yet");
}
