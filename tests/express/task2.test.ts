import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type Task } from "../../src/express/task2/task2";
import { expectError, expectStatus } from "../support/http";

const sampleTasks = (): Task[] => [
  { id: "t1", title: "Write notes", priority: "high", status: "todo", createdAt: "2026-03-01T10:00:00.000Z", updatedAt: "2026-03-01T10:00:00.000Z" },
  { id: "t2", title: "Buy milk", priority: "medium", status: "done", createdAt: "2026-03-01T11:00:00.000Z", updatedAt: "2026-03-02T09:00:00.000Z" },
  { id: "t3", title: "Call mom", priority: "low", status: "todo", createdAt: "2026-03-01T12:00:00.000Z", updatedAt: "2026-03-01T12:00:00.000Z" },
];

describe("EXPRESS-002", () => {
  describe("GET /tasks", () => {
    it("returns { data: [] } when there are no tasks", async () => {
      const res = await request(createApp([])).get("/tasks");
      expectStatus(res, 200, "GET /tasks must return 200.");
      expect(res.body, 'The body must be { "data": [] }').toEqual({ data: [] });
    });

    it("returns all tasks in the order they were added", async () => {
      const res = await request(createApp(sampleTasks())).get("/tasks");
      expectStatus(res, 200, "GET /tasks must return 200.");
      expect(res.body, 'The body must be { "data": [t1, t2, t3] } with the full task objects').toEqual({ data: sampleTasks() });
    });

    it("returns only the tasks with the given ?status=", async () => {
      const app = createApp(sampleTasks());

      const todo = await request(app).get("/tasks?status=todo");
      expectStatus(todo, 200, "GET /tasks?status=todo must return 200.");
      expect(todo.body.data?.map((t: Task) => t.id), "?status=todo must return t1 and t3").toEqual(["t1", "t3"]);

      const inProgress = await request(app).get("/tasks?status=in_progress");
      expectStatus(inProgress, 200, "GET /tasks?status=in_progress must return 200.");
      expect(inProgress.body, '?status=in_progress has no matches, so the body must be { "data": [] }').toEqual({ data: [] });
    });

    it("returns 400 for a status that is not todo, in_progress or done", async () => {
      const res = await request(createApp(sampleTasks())).get("/tasks?status=finished");
      expectError(res, 400, '?status=finished is invalid and must return 400.');
    });
  });

  describe("GET /tasks/:id", () => {
    it("returns the task with that id", async () => {
      const res = await request(createApp(sampleTasks())).get("/tasks/t2");
      expectStatus(res, 200, "GET /tasks/t2 must return 200.");
      expect(res.body, "The body must be the t2 task object").toEqual(sampleTasks()[1]);
    });

    it("returns 404 when no task has that id", async () => {
      const res = await request(createApp(sampleTasks())).get("/tasks/xyz");
      expectError(res, 404, "There is no task xyz, so GET /tasks/xyz must return 404.");
    });
  });
});
