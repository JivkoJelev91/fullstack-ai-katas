/**
 * EXPRESS-006: Team Notes API with Authentication
 * Specification: ./task6.md (in this folder)
 * Run the tests: npm run test:express:6
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { type Express } from "express";

// ---------------------------------------------------------------------------
// API contract (from the specification)
// ---------------------------------------------------------------------------

export type Role = "member" | "admin";

export interface AuthUser {
  id: string;
  role: Role;
}

export interface TokenVerifier {
  /** Resolves to the user for a valid token, or `null` for an unknown/expired token. May reject when the identity service is unavailable. */
  verify(token: string): Promise<AuthUser | null>;
}

export type Visibility = "private" | "team";

export interface Note {
  id: string;
  ownerId: string;
  title: string;
  body: string;
  visibility: Visibility;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp */
  updatedAt: string;
}

export interface AdminStats {
  totalNotes: number;
  private: number;
  team: number;
}

export type ErrorCode = "UNAUTHENTICATED" | "AUTH_UNAVAILABLE" | "NOT_FOUND" | "FORBIDDEN" | "VALIDATION_ERROR";

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

export function createApp(deps: { tokens: TokenVerifier }): Express {
  const app = express();

  // In-memory storage, scoped to this app instance (each createApp() call starts empty).
  const notes = new Map<string, Note>();

  app.get("/health", (_req, _res) => {
    // TODO: "Endpoints" section
    throw new Error("Not implemented: GET /health");
  });

  // TODO: "Login" section

  app.post("/notes", (_req, _res) => {
    throw new Error("Not implemented: POST /notes");
  });

  app.get("/notes", (_req, _res) => {
    throw new Error("Not implemented: GET /notes");
  });

  app.get("/notes/:id", (_req, _res) => {
    throw new Error("Not implemented: GET /notes/:id");
  });

  app.patch("/notes/:id", (_req, _res) => {
    throw new Error("Not implemented: PATCH /notes/:id");
  });

  app.delete("/notes/:id", (_req, _res) => {
    throw new Error("Not implemented: DELETE /notes/:id");
  });

  app.get("/admin/stats", (_req, _res) => {
    throw new Error("Not implemented: GET /admin/stats");
  });

  // TODO: "Errors" section

  return app;
}
