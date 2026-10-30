import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Task } from "../../src/express/task4/task4";
import { expectError, expectStatus } from "../support/http";

const task = (id: string, title: string): Task => ({
  id,
  title,
  priority: "medium",
  status: "todo",
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
});

let app: Express;

beforeEach(() => {
  app = createApp([task("t1", "Write notes"), task("t2", "Buy milk")]);
});

describe("EXPRESS-004", () => {
  describe("DELETE /tasks/:id", () => {
    it("returns 204 with an empty body", async () => {
      const res = await request(app).delete("/tasks/t1");
      expectStatus(res, 204, "Deleting an existing task must return 204.");
      expect(res.text ?? "", "A 204 response must have an empty body").toBe("");
    });

    it("really removes the task, so deleting it again returns 404", async () => {
      await request(app).delete("/tasks/t1");
      const res = await request(app).delete("/tasks/t1");
      expectError(res, 404, "t1 was already deleted, so a second DELETE /tasks/t1 must return 404.");
    });

    it("removes only that task", async () => {
      await request(app).delete("/tasks/t1");
      const res = await request(app).delete("/tasks/t2");
      expectStatus(res, 204, "Deleting t1 must not remove t2, so DELETE /tasks/t2 must still return 204.");
    });

    it("returns 404 when no task has that id", async () => {
      const res = await request(app).delete("/tasks/xyz");
      expectError(res, 404, "There is no task xyz, so DELETE /tasks/xyz must return 404.");
    });
  });
});
