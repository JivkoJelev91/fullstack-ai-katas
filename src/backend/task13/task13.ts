/**
 * BACKEND-013: Streaming Replies over SSE
 * Specification: ./task13.md (in this folder)
 * Run the tests: npm run test:backend:13
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import express, { type Express } from "express";
import type { ChatMessage } from "../shared";

export const MODEL = "chat-small";

export interface StreamingLLM {
  /** Yields the answer in small text pieces. Can throw in the middle. */
  stream(request: { model: string; messages: ChatMessage[] }): AsyncIterable<string>;
}

export interface MessageStore {
  save(conversationId: string, role: "user" | "assistant", content: string): Promise<void>;
}

export function createApp(deps: { llm: StreamingLLM; store: MessageStore }): Express {
  const app = express();
  app.use(express.json());

  app.post("/conversations/:id/stream", async (_req, _res) => {
    // Read the stream:  for await (const piece of deps.llm.stream({ ... })) { ... }
    // Send headers:     res.setHeader("Content-Type", "text/event-stream")
    // Send an event:    res.write(`event: token\ndata: ${JSON.stringify({ text: piece })}\n\n`)
    // Finish:           res.end()
    throw new Error("Not implemented: POST /conversations/:id/stream");
  });

  return app;
}
