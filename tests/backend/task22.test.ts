import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { ConfigError, createApp, loadConfig } from "../../src/backend/task22/task22";
import { expectStatus } from "../support/http";

const required = { DATABASE_URL: "postgres://db", LLM_API_KEY: "sk-1" };

function configErrorOf(env: Record<string, string | undefined>): string[] | null {
  try {
    loadConfig(env);
    return null;
  } catch (err) {
    expect(err, "loadConfig must throw a ConfigError").toBeInstanceOf(ConfigError);
    return [...(err as ConfigError).variables].sort();
  }
}

const ok = async () => {};
const failing = async () => {
  throw new Error("down");
};

describe("BACKEND-022", () => {
  describe("loadConfig", () => {
    it("uses defaults for PORT and LOG_LEVEL", () => {
      expect(loadConfig(required), "Only the required variables: port 3000, logLevel info").toEqual({
        port: 3000,
        databaseUrl: "postgres://db",
        llmApiKey: "sk-1",
        logLevel: "info",
      });
    });

    it("reads every variable and turns PORT into a number", () => {
      expect(loadConfig({ ...required, PORT: "8080", LOG_LEVEL: "debug" }), "port must be the number 8080").toEqual({
        port: 8080,
        databaseUrl: "postgres://db",
        llmApiKey: "sk-1",
        logLevel: "debug",
      });
    });

    it("lists all missing and invalid variables at once", () => {
      expect(configErrorOf({ PORT: "abc" }), "PORT is invalid and both required variables are missing").toEqual([
        "DATABASE_URL",
        "LLM_API_KEY",
        "PORT",
      ]);
      expect(configErrorOf({ ...required, LLM_API_KEY: "" }), "An empty value counts as missing").toEqual(["LLM_API_KEY"]);
    });

    it("rejects an out-of-range PORT and an unknown LOG_LEVEL", () => {
      expect(configErrorOf({ ...required, PORT: "70000" }), "PORT must be 1-65535").toEqual(["PORT"]);
      expect(configErrorOf({ ...required, PORT: "80.5" }), "PORT must be an integer").toEqual(["PORT"]);
      expect(configErrorOf({ ...required, LOG_LEVEL: "verbose" }), "LOG_LEVEL must be debug, info, warn or error").toEqual(["LOG_LEVEL"]);
    });
  });

  describe("GET /health", () => {
    it("returns ok without running the checks", async () => {
      const check = vi.fn(failing);
      const res = await request(createApp({ database: check })).get("/health");
      expectStatus(res, 200, "GET /health must always return 200.");
      expect(res.body, 'The body must be { "status": "ok" }').toEqual({ status: "ok" });
      expect(check, "/health must not run the checks").not.toHaveBeenCalled();
    });
  });

  describe("GET /ready", () => {
    it("returns 200 ready when all checks pass", async () => {
      const res = await request(createApp({ database: ok, llm: ok })).get("/ready");
      expectStatus(res, 200, "All checks pass, so /ready must return 200.");
      expect(res.body, "The body lists every check as ok").toEqual({ status: "ready", checks: { database: "ok", llm: "ok" } });
    });

    it("returns 503 not_ready when a check fails", async () => {
      const database = vi.fn(ok);
      const res = await request(createApp({ database, llm: failing })).get("/ready");
      expectStatus(res, 503, "A failing check must make /ready return 503.");
      expect(res.body, "The body shows which check failed").toEqual({ status: "not_ready", checks: { database: "ok", llm: "failed" } });
      expect(database, "Every check must run, also when another fails").toHaveBeenCalledTimes(1);
    });
  });
});
