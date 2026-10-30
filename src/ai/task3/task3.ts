/**
 * AI-003: Multi-Provider Adapters with Images
 * Specification: ./task3.md (in this folder)
 * Run the tests: npm run test:ai:3
 *
 * Keep the exported types, classes and signatures unchanged; the tests depend on them.
 */

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export type ImageMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; mediaType: ImageMediaType; data: string };

export interface UnifiedMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface UnifiedRequest {
  model: string;
  messages: UnifiedMessage[];
  maxTokens: number;
  temperature?: number;
  stopSequences?: string[];
}

export type ProviderName = "anthropic" | "openai";

export interface UnifiedResponse {
  text: string;
  stopReason: "end" | "max_tokens" | "stop_sequence";
  usage: { inputTokens: number; outputTokens: number };
  provider: ProviderName;
  model: string;
}

/** The subset of the WHATWG fetch API the adapters may use. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface AdapterConfig {
  apiKey: string;
  fetch: FetchLike;
  baseUrl?: string;
}

export interface ProviderAdapter {
  readonly provider: ProviderName;
  complete(request: UnifiedRequest, options?: { signal?: AbortSignal }): Promise<UnifiedResponse>;
}

export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderName,
    readonly status: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

export class UnsupportedContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedContentError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createAnthropicAdapter(config: AdapterConfig): ProviderAdapter {
  return {
    provider: "anthropic",
    async complete(request, options) {
      // TODO: validation
      // TODO: request translation
      // TODO: response translation
      // TODO: errors
      throw new Error("AI-003 Anthropic adapter is not implemented yet");
    },
  };
}

export function createOpenAIAdapter(config: AdapterConfig): ProviderAdapter {
  return {
    provider: "openai",
    async complete(request, options) {
      // TODO: validation
      // TODO: request translation
      // TODO: response translation
      // TODO: errors
      throw new Error("AI-003 OpenAI adapter is not implemented yet");
    },
  };
}
