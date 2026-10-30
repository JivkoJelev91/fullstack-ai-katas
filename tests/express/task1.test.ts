import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/express/task1/task1";
import { expectError, expectStatus } from "../support/http";

let app: Express;

beforeEach(() => {
  app = createApp();
});

describe("EXPRESS-001", () => {
  describe("POST /tasks", () => {
    it("returns 201 and the new task", async () => {
      const res = await request(app).post("/tasks").send({ title: "Write notes", priority: "high" });
      expectStatus(res, 201, "A valid body must return 201.");
      expect(res.body.title, "title must be the one that was sent").toBe("Write notes");
      expect(res.body.priority, "priority must be the one that was sent").toBe("high");
      expect(res.body.status, 'A new task always has status "todo"').toBe("todo");
      expect(typeof res.body.id, "id must be a string").toBe("string");
      expect(res.body.id.length, "id must not be empty").toBeGreaterThan(0);
    });

    it('uses priority "medium" when the client does not send one', async () => {
      const res = await request(app).post("/tasks").send({ title: "Buy milk" });
      expectStatus(res, 201, "A body with only a title is valid and must return 201.");
      expect(res.body.priority, 'Missing priority must become "medium"').toBe("medium");
    });

    it("sets createdAt and updatedAt to the current time", async () => {
      await new Promise((resolve) => setTimeout(resolve, 50)); // the request comes later than createApp()
      const before = Date.now();
      const res = await request(app).post("/tasks").send({ title: "Write notes" });
      const after = Date.now();
      expectStatus(res, 201, "A valid body must return 201.");

      const createdAt = Date.parse(res.body.createdAt);
      expect(Number.isNaN(createdAt), `createdAt must be an ISO date string, got ${JSON.stringify(res.body.createdAt)}`).toBe(false);
      expect(
        createdAt >= before && createdAt <= after,
        `createdAt must be the time of this request (create it inside the handler), got ${res.body.createdAt}`,
      ).toBe(true);
      expect(res.body.updatedAt, "updatedAt must equal createdAt for a new task").toBe(res.body.createdAt);
    });

    it("gives every task a different id", async () => {
      const ids = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const res = await request(app).post("/tasks").send({ title: `Task ${i}` });
        expectStatus(res, 201, "A valid body must return 201.");
        ids.add(res.body.id);
      }
      expect(ids.size, "3 tasks must get 3 different ids (create the id inside the handler)").toBe(3);
    });

    it("ignores id and status sent by the client", async () => {
      const res = await request(app).post("/tasks").send({ title: "Sneaky", id: "my-id", status: "done" });
      expectStatus(res, 201, "Extra fields are ignored, so this body is valid and must return 201.");
      expect(res.body.id, "The server creates the id, not the client").not.toBe("my-id");
      expect(res.body.status, 'The server sets status to "todo", not the client').toBe("todo");
    });

    it("returns 400 when the title is missing, empty or not a string", async () => {
      for (const body of [{}, { title: "" }, { title: 42 }]) {
        const res = await request(app).post("/tasks").send(body);
        expectError(res, 400, `Body ${JSON.stringify(body)} has no valid title and must return 400.`);
      }
    });

    it("returns 400 when the priority is not low, medium or high", async () => {
      const res = await request(app).post("/tasks").send({ title: "X", priority: "urgent" });
      expectError(res, 400, 'priority "urgent" is invalid and must return 400.');
    });
  });
});
