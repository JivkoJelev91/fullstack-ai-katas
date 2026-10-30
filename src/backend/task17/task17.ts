/**
 * BACKEND-017: Semantic Search
 * Specification: ./task17.md (in this folder)
 * Run the tests: npm run test:backend:17
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import express, { type Express } from "express";
import type { Embedder } from "../shared";

export interface Chunk {
  id: string;
  documentId: string;
  userId: string;
  text: string;
  vector: number[];
}

export function cosineSimilarity(_a: number[], _b: number[]): number {
  throw new Error("Not implemented: cosineSimilarity");
}

export function createApp(deps: { embedder: Embedder; chunks: Chunk[] }): Express {
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

  app.post("/search", async (_req, _res) => {
    // Embed the query: const [vector] = await deps.embedder.embed([query])
    throw new Error("Not implemented: POST /search");
  });

  return app;
}
