/**
 * Provider-agnostic contract for chat models that support tool (function) calling.
 * Used by the agent tasks. Tests replace the model with a deterministic mock.
 */

export interface ToolCall {
  /** Identifier chosen by the model; tool results must reference it. */
  id: string;
  name: string;
  /** Raw JSON text produced by the model. It may be invalid. */
  arguments: string;
}

export type AgentMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "tool"; toolCallId: string; content: string; isError?: boolean };

export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema describing the tool arguments (an object schema). */
  parameters: Record<string, unknown>;
}

export interface ToolChatRequest {
  messages: AgentMessage[];
  tools: ToolSpec[];
  signal?: AbortSignal;
}

export interface ToolChatResponse {
  message: Extract<AgentMessage, { role: "assistant" }>;
  usage: { inputTokens: number; outputTokens: number };
}

export interface ToolChatModel {
  chat(request: ToolChatRequest): Promise<ToolChatResponse>;
}
