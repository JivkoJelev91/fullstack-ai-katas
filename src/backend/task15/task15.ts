/**
 * BACKEND-015: Document Upload
 * Specification: ./task15.md (in this folder)
 * Run the tests: npm run test:backend:15
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import { randomUUID } from "node:crypto";
import express, { type Express } from "express";

export const ALLOWED_TYPES = ["text/plain", "text/markdown"];
export const MAX_CONTENT_LENGTH = 100_000;

export interface DocumentRecord {
  id: string;
  userId: string;
  title: string;
  mimeType: string;
  content: string;
  status: "pending" | "ready" | "failed";
  /** ISO 8601 timestamp */
  createdAt: string;
}

export function createApp(deps: { onUploaded: (documentId: string) => void }): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

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

  // Storage: key = document id, value = the document.
  const documents = new Map<string, DocumentRecord>();
  void documents;
  void randomUUID;

  app.post("/documents", (_req, _res) => {
    throw new Error("Not implemented: POST /documents");
  });

  app.get("/documents/:id", (_req, _res) => {
    throw new Error("Not implemented: GET /documents/:id");
  });

  return app;
}
