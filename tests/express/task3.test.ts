import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Task } from "../../src/express/task3/task3";
import { expectError, expectStatus } from "../support/http";

const t1 = (): Task => ({
  id: "t1",
  title: "Write notes",
  priority: "high",
  status: "todo",
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
});

let app: Express;

beforeEach(() => {
  app = createApp([t1()]);
});

describe("EXPRESS-003", () => {
  describe("PATCH /tasks/:id", () => {
    it("changes only the field that is sent", async () => {
      const res = await request(app).patch("/tasks/t1").send({ status: "done" });
      expectStatus(res, 200, "A valid update must return 200.");
      expect(res.body.status, "status must be the new value").toBe("done");
      expect(res.body.title, "title was not sent, so it must keep its value").toBe("Write notes");
      expect(res.body.priority, "priority was not sent, so it must keep its value").toBe("high");
    });

    it("changes several fields at once", async () => {
      const res = await request(app).patch("/tasks/t1").send({ title: "Write better notes", priority: "low" });
      expectStatus(res, 200, "A valid update must return 200.");
      expect(res.body.title, "title must be the new value").toBe("Write better notes");
      expect(res.body.priority, "priority must be the new value").toBe("low");
      expect(res.body.status, "status was not sent, so it must keep its value").toBe("todo");
    });

    it("sets updatedAt to the current time and keeps id and createdAt", async () => {
      const before = Date.now();
      const res = await request(app).patch("/tasks/t1").send({ status: "done", id: "other", createdAt: "2000-01-01T00:00:00.000Z" });
      expectStatus(res, 200, "Extra fields are ignored, so this update must return 200.");
      expect(res.body.id, "id must never change").toBe("t1");
      expect(res.body.createdAt, "createdAt must never change").toBe("2026-03-01T10:00:00.000Z");
      const updatedAt = Date.parse(res.body.updatedAt);
      expect(
        updatedAt >= before - 1000,
        `updatedAt must be the time of this request, got ${JSON.stringify(res.body.updatedAt)}`,
      ).toBe(true);
    });

    it("saves the change, so the next update sees it", async () => {
      await request(app).patch("/tasks/t1").send({ title: "Renamed" });
      const res = await request(app).patch("/tasks/t1").send({ status: "done" });
      expectStatus(res, 200, "A valid update must return 200.");
      expect(res.body.title, "The title from the first update must be saved in the tasks array").toBe("Renamed");
    });

    it("returns 404 when no task has that id", async () => {
      const res = await request(app).patch("/tasks/xyz").send({ status: "done" });
      expectError(res, 404, "There is no task xyz, so PATCH /tasks/xyz must return 404.");
    });

    it("returns 400 for an invalid field and changes nothing", async () => {
      for (const body of [{ status: "finished" }, { title: "" }, { priority: "urgent" }]) {
        const res = await request(app).patch("/tasks/t1").send(body);
        expectError(res, 400, `Body ${JSON.stringify(body)} is invalid and must return 400.`);
      }
      const bad = await request(app).patch("/tasks/t1").send({ title: "Changed", priority: "urgent" });
      expectError(bad, 400, 'Body with priority "urgent" is invalid and must return 400.');

      const res = await request(app).patch("/tasks/t1").send({ status: "done" });
      expectStatus(res, 200, "A valid update must return 200.");
      expect(res.body.title, "A rejected update must not change the title").toBe("Write notes");
      expect(res.body.priority, "A rejected update must not change the priority").toBe("high");
    });
  });
});
