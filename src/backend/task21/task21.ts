/**
 * BACKEND-021: Request IDs and Structured Logging
 * Specification: ./task21.md (in this folder)
 * Run the tests: npm run test:backend:21
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export interface LogEntry {
  requestId: string;
  method: string;
  /** The URL path without the query string. */
  path: string;
  status: number;
  durationMs: number;
}

export function requestId(): RequestHandler {
  void randomUUID;
  return (_req, _res, _next) => {
    throw new Error("Not implemented: requestId");
  };
}

export function requestLogger(_log: (entry: LogEntry) => void, now: () => number = Date.now): RequestHandler {
  void now;
  return (_req, _res, _next) => {
    // Run code when the response has been sent: res.on("finish", () => { ... })
    throw new Error("Not implemented: requestLogger");
  };
}
