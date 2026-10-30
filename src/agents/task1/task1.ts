/**
 * AGENT-001: Tool-Calling Agent Loop
 * Specification: ./task1.md (in this folder)
 * Run the tests: npm run test:agents:1
 *
 * Keep the exported types, class and signatures unchanged; the tests depend on them.
 */
import { z } from "zod";
import type { AgentMessage, ToolCall, ToolChatModel, ToolSpec } from "../shared/tool-chat";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface ToolContext {
  signal: AbortSignal;
  callId: string;
}

export interface ToolDefinition<S extends z.ZodType> {
  name: string;
  description: string;
  schema: S;
  execute(args: z.infer<S>, context: ToolContext): Promise<unknown>;
}

export interface AgentTool {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodType;
  execute(args: unknown, context: ToolContext): Promise<unknown>;
}

export interface RunAgentOptions {
  model: ToolChatModel;
  tools: AgentTool[];
  system: string;
  input: string;
  maxSteps?: number;
  toolTimeoutMs?: number;
  maxToolOutputChars?: number;
}

export interface AgentRunResult {
  output: string;
  steps: number;
  messages: AgentMessage[];
  toolCalls: Array<{ id: string; name: string; ok: boolean }>;
  usage: { inputTokens: number; outputTokens: number };
}

export class AgentStepLimitError extends Error {
  constructor(
    readonly steps: number,
    readonly messages: AgentMessage[],
  ) {
    super(`Agent did not finish within ${steps} steps`);
    this.name = "AgentStepLimitError";
  }
}

export type { AgentMessage, ToolCall, ToolSpec };

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function defineTool<S extends z.ZodType>(definition: ToolDefinition<S>): AgentTool {
  // TODO: see the specification
  throw new Error("AGENT-001 defineTool is not implemented yet");
}

export async function runAgent(options: RunAgentOptions): Promise<AgentRunResult> {
  // TODO: defaults
  // TODO: conversation and steps
  // TODO: tool execution
  // TODO: step limit and result
  throw new Error("AGENT-001 runAgent is not implemented yet");
}
