import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Conversation } from "../../src/backend/task9/task9";
import { expectError, expectStatus } from "../support/http";

const sample = (): Conversation[] => [
  { id: "c1", userId: "u1", title: "Trip" },
  { id: "c2", userId: "u1", title: "Work" },
  { id: "c3", userId: "u2", title: "Bob's notes" },
];

let app: Express;
const as = (userId: string) => ({
  get: (url: string) => request(app).get(url).set("x-user-id", userId),
  delete: (url: string) => request(app).delete(url).set("x-user-id", userId),
});

beforeEach(() => {
  app = createApp(sample());
});

describe("BACKEND-009", () => {
  describe("GET /conversations", () => {
    it("returns only the caller's conversations", async () => {
      const res = await as("u1").get("/conversations");
      expectStatus(res, 200, "GET /conversations must return 200.");
      expect(res.body, "u1 must see only c1 and c2").toEqual({ data: sample().slice(0, 2) });
    });
  });

  describe("GET /conversations/:id", () => {
    it("returns the caller's own conversation", async () => {
      const res = await as("u1").get("/conversations/c1");
      expectStatus(res, 200, "u1 owns c1, so it must return 200.");
      expect(res.body, "The body must be the c1 conversation").toEqual(sample()[0]);
    });

    it("returns 404 for another user's conversation", async () => {
      const res = await as("u1").get("/conversations/c3");
      expectError(res, 404, "c3 belongs to u2, so u1 must get 404 (not 200, not 403).");
    });

    it("returns 404 for an unknown id", async () => {
      const res = await as("u1").get("/conversations/xyz");
      expectError(res, 404, "An unknown id must return 404.");
    });
  });

  describe("DELETE /conversations/:id", () => {
    it("deletes the caller's own conversation", async () => {
      const res = await as("u1").delete("/conversations/c1");
      expectStatus(res, 204, "u1 owns c1, so DELETE must return 204.");
      expect(res.text ?? "", "A 204 response has an empty body").toBe("");
      const after = await as("u1").get("/conversations/c1");
      expectError(after, 404, "After the delete, c1 must be gone.");
    });

    it("returns 404 for another user's conversation and keeps it", async () => {
      const res = await as("u1").delete("/conversations/c3");
      expectError(res, 404, "u1 may not delete u2's conversation: 404.");
      const owner = await as("u2").get("/conversations/c3");
      expectStatus(owner, 200, "c3 must still exist for its owner u2.");
    });
  });
});
