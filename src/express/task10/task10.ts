/**
 * EXPRESS-010: Login with a Bearer Token
 * Specification: ./task10.md (in this folder)
 * Run the tests:  npm run test:express:10
 * Run the server: npm run dev:express:10
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { NextFunction, type Express, type Request, type Response } from "express";

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

  const requireLogin = async (req: Request, res: Response, next: NextFunction) => {
    // Read the "Authorization" header the client sent (undefined if it wasn't sent).
    const header = req.headers.authorization;

    // Reject if there's no header, or it isn't the form "Bearer <token>".
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).send({ error: "Missing token" });
    }
    try {
      const token = header.slice("Bearer ".length);
      const user = await deps.tokens.verify(token);

      if (!user) res.status(401).send({ error: "Missing token" });
      res.send(user);
    } catch {
      res.status(503).send({ error: "Try again later" });
    }

    next();
  };

  app.get("/health", (_req, res) => {
    return res.send({ "status": "ok" });
  });

  app.get("/me", requireLogin, (_Sreq, res) => {
    return res.send(res.locals.user);
  });


  return app;
}
