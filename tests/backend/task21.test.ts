import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { requestId, requestLogger, type LogEntry } from "../../src/backend/task21/task21";
import { expectStatus } from "../support/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function setup() {
  const clock = { now: 1000 };
  const logs: LogEntry[] = [];
  const app = express();
  app.use(requestId());
  app.use(requestLogger((entry) => logs.push(entry), () => clock.now));
  app.get("/hello", (_req, res) => {
    res.json({ requestId: res.locals.requestId });
  });
  app.get("/slow", (_req, res) => {
    clock.now += 250;
    res.json({ ok: true });
  });
  /** Waits until the "finish" handlers have run. */
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return { app, logs, settle };
}

describe("BACKEND-021", () => {
  describe("requestId", () => {
    it("creates a UUID, sets the X-Request-Id header and res.locals.requestId", async () => {
      const { app } = setup();
      const res = await request(app).get("/hello");
      expectStatus(res, 200, "GET /hello must return 200.");
      expect(res.headers["x-request-id"], "Without an incoming id, X-Request-Id must be a new UUID").toMatch(UUID);
      expect(res.body.requestId, "res.locals.requestId must equal the header").toBe(res.headers["x-request-id"]);
    });

    it("reuses a valid incoming X-Request-Id", async () => {
      const { app } = setup();
      const res = await request(app).get("/hello").set("X-Request-Id", "abc-123");
      expect(res.headers["x-request-id"], 'The valid incoming id "abc-123" must be reused').toBe("abc-123");
    });

    it("replaces an invalid incoming X-Request-Id", async () => {
      const { app } = setup();
      for (const bad of ["bad id!", "x".repeat(65)]) {
        const res = await request(app).get("/hello").set("X-Request-Id", bad);
        expect(res.headers["x-request-id"], `"${bad.slice(0, 20)}" is not allowed, so a new UUID must be used`).toMatch(UUID);
      }
    });
  });

  describe("requestLogger", () => {
    it("logs one entry per request with the request id, method, path and status", async () => {
      const { app, logs, settle } = setup();
      const res = await request(app).get("/hello?name=ana");
      await settle();
      expect(logs, "Exactly one entry must be logged, without the query string in path").toEqual([
        { requestId: res.headers["x-request-id"], method: "GET", path: "/hello", status: 200, durationMs: 0 },
      ]);
    });

    it("measures the duration with the clock", async () => {
      const { app, logs, settle } = setup();
      await request(app).get("/slow");
      await settle();
      expect(logs[0]?.durationMs, "The handler advanced the clock by 250 ms").toBe(250);
    });

    it("logs error responses too", async () => {
      const { app, logs, settle } = setup();
      await request(app).get("/no-such-route");
      await settle();
      expect(logs[0], "A 404 must be logged with status 404").toMatchObject({ method: "GET", path: "/no-such-route", status: 404 });
    });
  });
});
