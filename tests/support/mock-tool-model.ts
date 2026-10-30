import { vi } from "vitest";
import type { AgentMessage, ToolCall, ToolChatModel, ToolChatRequest, ToolChatResponse } from "../../src/agents/shared/tool-chat";

export function assistant(content: string, toolCalls?: ToolCall[]): ToolChatResponse {
  return { message: { role: "assistant", content, ...(toolCalls ? { toolCalls } : {}) }, usage: { inputTokens: 50, outputTokens: 10 } };
}

export function call(id: string, name: string, args: unknown): ToolCall {
  return { id, name, arguments: typeof args === "string" ? args : JSON.stringify(args) };
}

/** Plays back responses in order (the last one repeats) and snapshots every request. */
export function scriptedToolModel(...responses: Array<ToolChatResponse | Error>) {
  const requests: ToolChatRequest[] = [];
  let i = 0;
  const chat = vi.fn(async (request: ToolChatRequest): Promise<ToolChatResponse> => {
    requests.push({ ...request, messages: request.messages.map((m) => structuredClone(m) as AgentMessage), tools: structuredClone(request.tools) });
    const r = responses[Math.min(i++, responses.length - 1)]!;
    if (r instanceof Error) throw r;
    return structuredClone(r);
  });
  const model: ToolChatModel = { chat };
  return { model, chat, requests };
}
