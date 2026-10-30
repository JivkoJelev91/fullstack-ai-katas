/**
 * BACKEND-012: Chat Endpoint
 * Specification: ./task12.md (in this folder)
 * Run the tests: npm run test:backend:12
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import express, { type Express } from "express";
import type { ChatMessage, LLMClient } from "../shared";

export const SYSTEM_PROMPT = "You are a helpful assistant.";
export const MODEL = "chat-small";
export const MAX_TOKENS = 500;

export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Conversation {
  id: string;
  userId: string;
  messages: StoredMessage[];
}

export function createApp(deps: { llm: LLMClient; conversations: Conversation[] }): Express {
  const app = express();
  app.use(express.json());

  // Stand-in for authentication (BACKEND-007): the caller's user id comes from the x-user-id header.
  app.use((req, res, next) => {
    const userId = req.header("x-user-id");
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.locals.userId = userId;
    next();
  });

  // Storage: key = conversation id, value = the conversation (with its messages).
  const conversations = new Map<string, Conversation>(deps.conversations.map((c) => [c.id, c]));
  void conversations;

  app.post("/conversations/:id/messages", async (_req, _res) => {
    // Call the model: await deps.llm.complete({ model, maxTokens, messages }) -> { text, usage, stopReason }
    const messages: ChatMessage[] = [];
    void messages;
    throw new Error("Not implemented: POST /conversations/:id/messages");
  });

  return app;
}
