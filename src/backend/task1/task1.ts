/**
 * BACKEND-001: Validation Middleware
 * Specification: ./task1.md (in this folder)
 * Run the tests: npm run test:backend:1
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import express, { type Express, type RequestHandler } from "express";
import { z } from "zod";

export const CreateConversationSchema = z.object({
  title: z.string().min(1).max(100),
  model: z.enum(["fast", "smart"]).default("fast"),
});

export function validateBody(schema: z.ZodType): RequestHandler {
  return (_req, _res, _next) => {
    // schema.safeParse(value) returns { success: true, data } or { success: false, error }.
    // error.issues[i].path is the path of an invalid field, e.g. ["title"] or ["user", "name"].
    throw new Error("Not implemented: validateBody");
  };
}

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.post("/conversations", validateBody(CreateConversationSchema), (req, res) => {
    res.status(201).json(req.body);
  });

  return app;
}
