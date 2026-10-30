/**
 * AI-004: Streaming LLM Responses: SSE Parsing and Relay
 * Specification: ./task4.md (in this folder)
 * Run the tests: npm run test:ai:4
 *
 * Keep the exported types, class and signatures unchanged; the tests depend on them.
 */
import express, { type Express } from "express";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export type StopReason = "end" | "max_tokens" | "stop_sequence";

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; stopReason: StopReason; usage: { inputTokens: number; outputTokens: number } };

export interface StreamSource {
  /** Starts an upstream model stream. Aborting `signal` cancels the upstream request. */
  start(prompt: string, signal: AbortSignal): Promise<AsyncIterable<StreamEvent>>;
}

export class StreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StreamError";
  }
}

// ---------------------------------------------------------------------------
// Part A — SSE parser
// ---------------------------------------------------------------------------

export async function* parseAnthropicStream(body: AsyncIterable<Uint8Array | string>): AsyncGenerator<StreamEvent> {
  // TODO: decoding and SSE framing
  // TODO: event handling
  throw new Error("AI-004 parseAnthropicStream is not implemented yet");
}

// ---------------------------------------------------------------------------
// Part B — SSE relay endpoint
// ---------------------------------------------------------------------------

export function createStreamingApp(deps: { source: StreamSource }): Express {
  const app = express();

  app.post("/chat/stream", async (_req, _res) => {
    // TODO: validation
    // TODO: starting the upstream stream
    // TODO: relaying events
    // TODO: client disconnects
    throw new Error("Not implemented: POST /chat/stream");
  });

  // TODO: unknown routes

  return app;
}
