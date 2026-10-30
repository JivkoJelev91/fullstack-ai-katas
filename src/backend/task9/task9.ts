/**
 * BACKEND-009: User Isolation
 * Specification: ./task9.md (in this folder)
 * Run the tests: npm run test:backend:9
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import express, { type Express } from "express";

export interface Conversation {
  id: string;
  userId: string;
  title: string;
}

export function createApp(initialConversations: Conversation[] = []): Express {
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

  // Storage: key = conversation id, value = the conversation.
  const conversations = new Map<string, Conversation>(initialConversations.map((c) => [c.id, c]));
  void conversations;

  app.get("/conversations", (_req, _res) => {
    // The caller: res.locals.userId
    throw new Error("Not implemented: GET /conversations");
  });

  app.get("/conversations/:id", (_req, _res) => {
    throw new Error("Not implemented: GET /conversations/:id");
  });

  app.delete("/conversations/:id", (_req, _res) => {
    throw new Error("Not implemented: DELETE /conversations/:id");
  });

  return app;
}
