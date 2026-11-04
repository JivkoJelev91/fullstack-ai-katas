/**
 * EXPRESS-011: Create and List My Notes
 * Specification: ./task11.md (in this folder)
 * Run the tests:  npm run test:express:11
 * Run the server: npm run dev:express:11
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { type Express } from "express";

export type Role = "member" | "admin";

export interface AuthUser {
  id: string;
  role: Role;
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

/** The logged-in users, by token. */
export const USERS: Record<string, AuthUser> = {
  "token-alice": { id: "u-alice", role: "member" },
  "token-bob": { id: "u-bob", role: "member" },
  "token-root": { id: "u-root", role: "admin" },
};

export function createApp(initialNotes: Note[] = []): Express {
  const app = express();
  app.use(express.json()); // parses a JSON request body into req.body

  // Storage (no database), filled with initialNotes, in the order they were added.
  const notes: Note[] = [...initialNotes];

  // Login: already done for you (you built it in EXPRESS-010).
  // Every route below needs "Authorization: Bearer <token>".
  // In a handler, the logged-in user is: const user = res.locals.user as AuthUser;
  app.use((req, res, next) => {
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");
    const user = scheme === "Bearer" && token ? USERS[token] : undefined;
    if (!user) {
      res.status(401).json({ error: "Not logged in" });
      return;
    }
    res.locals.user = user;
    next();
  });

  app.post("/notes", (_req, _res) => {
    // Use these when you create a note:
    //   id:  randomUUID() from "node:crypto"
    //   now: new Date().toISOString()
    throw new Error("Not implemented: POST /notes");
  });

  app.get("/notes", (_req, _res) => {
    throw new Error("Not implemented: GET /notes");
  });

  return app;
}
