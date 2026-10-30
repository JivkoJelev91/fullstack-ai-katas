/**
 * BACKEND-011: Rate Limiting
 * Specification: ./task11.md (in this folder)
 * Run the tests: npm run test:backend:11
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import type { Request, RequestHandler } from "express";

export interface RateLimitOptions {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Who is counted, e.g. the user id. */
  keyOf: (req: Request) => string;
  /** The current time in milliseconds. The tests pass a fake clock. */
  now?: () => number;
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const { now = Date.now } = options;
  void now;
  // State per key, e.g. new Map<string, { windowStart: number; count: number }>()

  return (_req, _res, _next) => {
    throw new Error("Not implemented: rateLimit");
  };
}
