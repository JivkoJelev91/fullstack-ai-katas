/**
 * BACKEND-014: Usage and Budget Tracking
 * Specification: ./task14.md (in this folder)
 * Run the tests: npm run test:backend:14
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import express, { type Express } from "express";
import type { LLMClient } from "../shared";

export const MODEL = "chat-small";

/** US dollars per 1 million tokens. */
export const PRICE = { inputPerMillion: 0.5, outputPerMillion: 1.5 };

export interface Usage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function createApp(deps: { llm: LLMClient; budgetUsd: number }): Express {
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

  // Storage: key = user id, value = that user's usage.
  const usage = new Map<string, Usage>();
  void usage;

  app.post("/chat", async (_req, _res) => {
    // The model returns { text, usage: { inputTokens, outputTokens } }
    throw new Error("Not implemented: POST /chat");
  });

  app.get("/usage", (_req, _res) => {
    throw new Error("Not implemented: GET /usage");
  });

  return app;
}
