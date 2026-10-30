/**
 * BACKEND-002: Centralized Error Handling
 * Specification: ./task2.md (in this folder)
 * Run the tests: npm run test:backend:2
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import express, { type ErrorRequestHandler, type Express, type RequestHandler } from "express";

/** An error that is safe to show to the client, with the HTTP status to use. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, message);
    this.name = "NotFoundError";
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(400, message);
    this.name = "BadRequestError";
  }
}

export interface Conversation {
  id: string;
  title: string;
}

export interface ConversationRepository {
  /** Resolves to null when there is no conversation with that id. */
  findById(id: string): Promise<Conversation | null>;
}

export const errorHandler: ErrorRequestHandler = (_err, _req, _res, _next) => {
  throw new Error("Not implemented: errorHandler");
};

export const notFoundHandler: RequestHandler = (_req, _res) => {
  throw new Error("Not implemented: notFoundHandler");
};

export function createApp(repo: ConversationRepository): Express {
  const app = express();
  app.use(express.json());

  app.get("/conversations/:id", async (_req, _res) => {
    // Use repo.findById(req.params.id)
    throw new Error("Not implemented: GET /conversations/:id");
  });

  // TODO: register notFoundHandler and errorHandler (see "Wiring" in task2.md)

  return app;
}
