/**
 * BACKEND-007: Authentication Middleware
 * Specification: ./task7.md (in this folder)
 * Run the tests: npm run test:backend:7
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import express, { type Express, type RequestHandler } from "express";

export interface AuthUser {
  id: string;
  email: string;
}

export interface TokenVerifier {
  /** Resolves to the user for a valid token, or null for an invalid one. */
  verify(token: string): Promise<AuthUser | null>;
}

export function requireAuth(_verifier: TokenVerifier): RequestHandler {
  return async (_req, _res, _next) => {
    // The header value: req.header("authorization") -> e.g. "Bearer abc123" or undefined
    throw new Error("Not implemented: requireAuth");
  };
}

export function createApp(verifier: TokenVerifier): Express {
  const app = express();
  app.use(express.json());

  app.get("/me", requireAuth(verifier), (_req, res) => {
    res.json(res.locals.user);
  });

  return app;
}
