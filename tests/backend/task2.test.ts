import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppError,
  BadRequestError,
  createApp,
  errorHandler,
  type ConversationRepository,
} from "../../src/backend/task2/task2";
import { expectError, expectStatus } from "../support/http";

const repo = (findById: ConversationRepository["findById"]): ConversationRepository => ({ findById });
const found = repo(async (id) => (id === "c1" ? { id: "c1", title: "Trip ideas" } : null));

/** A small app whose only route throws the given error, followed by your errorHandler. */
function appThrowing(error: unknown) {
  const app = express();
  app.get("/fail", () => {
    throw error;
  });
  app.use(errorHandler);
  return app;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("BACKEND-002", () => {
  describe("errorHandler", () => {
    it("uses the status and message of an AppError", async () => {
      const res = await request(appThrowing(new AppError(409, "Already exists"))).get("/fail");
      expectStatus(res, 409, "An AppError with status 409 must return 409.");
      expect(res.body, 'The body must be { "error": "Already exists" }').toEqual({ error: "Already exists" });
    });

    it("handles subclasses like BadRequestError", async () => {
      const res = await request(appThrowing(new BadRequestError("Title too long"))).get("/fail");
      expectStatus(res, 400, "A BadRequestError must return 400.");
      expect(res.body, 'The body must be { "error": "Title too long" }').toEqual({ error: "Title too long" });
    });

    it("returns 500 for other errors without showing their message", async () => {
      const res = await request(appThrowing(new Error("connection to db-prod-7 failed"))).get("/fail");
      expectStatus(res, 500, "A plain Error must return 500.");
      expect(res.body, 'The body must be { "error": "Internal server error" }').toEqual({ error: "Internal server error" });
    });
  });

  describe("notFoundHandler", () => {
    it("returns 404 for a URL no route matches", async () => {
      const res = await request(createApp(found)).get("/no-such-route");
      expectError(res, 404, "An unknown URL must return 404 with { error } (register notFoundHandler after the routes).");
    });
  });

  describe("GET /conversations/:id", () => {
    it("returns the conversation", async () => {
      const res = await request(createApp(found)).get("/conversations/c1");
      expectStatus(res, 200, "An existing conversation must return 200.");
      expect(res.body, "The body must be the conversation").toEqual({ id: "c1", title: "Trip ideas" });
    });

    it("returns 404 when the conversation does not exist", async () => {
      const res = await request(createApp(found)).get("/conversations/xyz");
      expectError(res, 404, "A missing conversation must throw NotFoundError, which becomes 404.");
    });

    it("returns 500 when the repository fails", async () => {
      const failing = repo(async () => {
        throw new Error("connection to db-prod-7 failed");
      });
      const res = await request(createApp(failing)).get("/conversations/c1");
      expectStatus(res, 500, "A repository error must reach errorHandler and return 500.");
      expect(res.body, 'The body must be { "error": "Internal server error" } (register errorHandler)').toEqual({
        error: "Internal server error",
      });
    });
  });
});
