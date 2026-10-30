import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createApp, validateBody } from "../../src/backend/task1/task1";
import { expectStatus } from "../support/http";

describe("BACKEND-001", () => {
  describe("valid body", () => {
    it("calls the handler with the parsed body (defaults filled in)", async () => {
      const res = await request(createApp()).post("/conversations").send({ title: "Trip ideas" });
      expectStatus(res, 201, "A valid body must reach the handler, which returns 201.");
      expect(res.body, 'req.body must be the parsed data, so "model" gets its default "fast"').toEqual({ title: "Trip ideas", model: "fast" });
    });

    it("removes fields that are not in the schema", async () => {
      const res = await request(createApp()).post("/conversations").send({ title: "Trip ideas", model: "smart", extra: 1 });
      expectStatus(res, 201, "A valid body must reach the handler, which returns 201.");
      expect(res.body, 'req.body must be the parsed data, so "extra" is removed').toEqual({ title: "Trip ideas", model: "smart" });
    });
  });

  describe("invalid body", () => {
    it("returns 400 with the invalid field", async () => {
      const res = await request(createApp()).post("/conversations").send({});
      expectStatus(res, 400, "A body without a title must return 400.");
      expect(typeof res.body.error, "error must be a string").toBe("string");
      expect(res.body.fields, 'fields must be ["title"]').toEqual(["title"]);
    });

    it("lists every invalid field once", async () => {
      const res = await request(createApp()).post("/conversations").send({ title: "", model: "huge" });
      expectStatus(res, 400, "An empty title and an unknown model must return 400.");
      expect([...(res.body.fields ?? [])].sort(), 'fields must contain "title" and "model"').toEqual(["model", "title"]);
    });

    it("does not call the route handler", async () => {
      const handler = vi.fn((_req: express.Request, res: express.Response) => res.json({ ok: true }));
      const app = express();
      app.use(express.json());
      app.post("/items", validateBody(z.object({ name: z.string() })), handler);

      const res = await request(app).post("/items").send({ name: 42 });
      expectStatus(res, 400, "An invalid body must return 400.");
      expect(handler, "The handler must not run when the body is invalid (do not call next())").not.toHaveBeenCalled();
    });

    it("writes nested fields with dots", async () => {
      const app = express();
      app.use(express.json());
      app.post("/users", validateBody(z.object({ user: z.object({ name: z.string() }) })), (_req, res) => res.json({ ok: true }));

      const res = await request(app).post("/users").send({ user: {} });
      expectStatus(res, 400, "A missing user.name must return 400.");
      expect(res.body.fields, 'fields must be ["user.name"]').toEqual(["user.name"]);
    });
  });
});
