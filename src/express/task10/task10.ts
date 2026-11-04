/**
 * EXPRESS-010: Login with a Bearer Token
 * Specification: ./task10.md (in this folder)
 * Run the tests:  npm run test:express:10
 * Run the server: npm run dev:express:10
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { type Express } from "express";

export type Role = "member" | "admin";

export interface AuthUser {
  id: string;
  role: Role;
}

export interface TokenVerifier {
  /** Returns the user for a good token, null for a bad one. Throws when the login service is down. */
  verify(token: string): Promise<AuthUser | null>;
}

export function createApp(deps: { tokens: TokenVerifier }): Express {
  const app = express();

  // TODO: write the login middleware here, e.g.
  //   const requireLogin = async (req: Request, res: Response, next: NextFunction) => { ... };
  // and use it on a route: app.get("/me", requireLogin, (req, res) => { ... })

  app.get("/health", (_req, _res) => {
    throw new Error("Not implemented: GET /health");
  });

  app.get("/me", (_req, _res) => {
    // After the middleware runs, the user is in res.locals.user
    throw new Error("Not implemented: GET /me");
  });

  return app;
}
