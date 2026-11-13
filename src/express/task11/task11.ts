/**
 * EXPRESS-011: Create and List My Notes
 * Specification: ./task11.md (in this folder)
 * Run the tests:  npm run test:express:11
 * Run the server: npm run dev:express:11
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import z from "zod";

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

const NoteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(10000),
  visibility: z.enum(["private" , "team"]).default('private'),
});


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

  app.post("/notes", (req, res) => {
    // Use these when you create a note:
    const user = res.locals.user;
    const noteid = randomUUID(); // unique id, e.g. "3f2a9c1e-..."
    const now = new Date().toISOString(); // e.g. "2026-03-01T10:00:00.000Z"

    try {
      req.body = NoteSchema.parse(req.body);
      const title = req.body.title as string;
      const body = req.body.body as string;
      const visibility = req.body.visibility as Visibility;
      const note: Note = {
        id: noteid,
        ownerId: user.id,
        title,
        body,
        visibility,
        createdAt: now,
        updatedAt: now,
      };
      notes.push(note);
      return res.status(201).send(note);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .send({ error: error.issues[0]?.message ?? "Invalid input" });
      }
    }
  });

  app.get("/notes", (_req, res) => {
    const user = res.locals.user;
    const filteredNotes = notes.filter((note) => note.ownerId === user.id);
    res.send({
      data: filteredNotes,
    });
  });

  return app;
}
