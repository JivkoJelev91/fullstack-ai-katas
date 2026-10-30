/**
 * Provider-agnostic LLM client contract used by the AI tasks.
 *
 * Your code depends only on this interface. In tests it is replaced with a
 * deterministic mock; in a real application you would implement it with an
 * adapter around a provider SDK.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  /** Upper bound for generated tokens. */
  maxTokens: number;
  temperature?: number;
  /** Aborting this signal asks the provider to cancel the request. */
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionResponse {
  text: string;
  usage: TokenUsage;
  /** `"max_tokens"` means the output was cut off before the model finished. */
  stopReason: "end" | "max_tokens";
}

export interface LLMClient {
  complete(request: CompletionRequest): Promise<CompletionResponse>;
}

/** Error returned by the model provider's HTTP API. */
export class LLMProviderError extends Error {
  constructor(
    message: string,
    /** HTTP status code returned by the provider. */
    readonly status: number,
    /** Present when the provider asked the client to wait before retrying. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}
