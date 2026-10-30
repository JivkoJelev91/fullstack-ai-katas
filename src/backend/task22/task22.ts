/**
 * BACKEND-022: Health Checks and Configuration
 * Specification: ./task22.md (in this folder)
 * Run the tests: npm run test:backend:22
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import express, { type Express } from "express";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface AppConfig {
  port: number;
  databaseUrl: string;
  llmApiKey: string;
  logLevel: LogLevel;
}

export class ConfigError extends Error {
  constructor(
    /** Names of the missing or invalid variables, e.g. ["DATABASE_URL", "PORT"]. */
    readonly variables: string[],
  ) {
    super(`Invalid configuration: ${variables.join(", ")}`);
    this.name = "ConfigError";
  }
}

export function loadConfig(_env: Record<string, string | undefined>): AppConfig {
  throw new Error("Not implemented: loadConfig");
}

/** A check resolves when the dependency works and rejects when it doesn't. */
export type HealthCheck = () => Promise<void>;

export function createApp(_checks: Record<string, HealthCheck>): Express {
  const app = express();

  app.get("/health", (_req, _res) => {
    throw new Error("Not implemented: GET /health");
  });

  app.get("/ready", async (_req, _res) => {
    // Run all checks at the same time: await Promise.allSettled(...)
    throw new Error("Not implemented: GET /ready");
  });

  return app;
}
