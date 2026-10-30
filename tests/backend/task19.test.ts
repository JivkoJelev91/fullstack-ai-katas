import { describe, expect, it, vi } from "vitest";
import { createQueue, type Job } from "../../src/backend/task19/task19";

describe("BACKEND-019", () => {
  describe("enqueue and get", () => {
    it("creates a queued job", () => {
      const queue = createQueue(async () => {});
      const job = queue.enqueue("ingest", { documentId: "d1" });
      expect(job, "A new job is { id, type, payload, status: queued, attempts: 0, error: null }").toEqual({
        id: job.id,
        type: "ingest",
        payload: { documentId: "d1" },
        status: "queued",
        attempts: 0,
        error: null,
      });
      expect(typeof job.id, "id must be a string").toBe("string");
      expect(queue.get(job.id)?.status, "get(id) must return the job").toBe("queued");
      expect(queue.get("nope"), "get returns undefined for an unknown id").toBeUndefined();
    });
  });

  describe("runNext", () => {
    it("runs the oldest job first and marks it succeeded", async () => {
      const order: unknown[] = [];
      const queue = createQueue(async (job) => void order.push(job.payload));
      const a = queue.enqueue("ingest", "A");
      queue.enqueue("ingest", "B");

      expect(await queue.runNext(), "runNext resolves to true when it ran a job").toBe(true);
      expect(order, "The oldest job (A) must run first").toEqual(["A"]);
      expect(queue.get(a.id), 'A must be "succeeded" with 1 attempt').toMatchObject({ status: "succeeded", attempts: 1, error: null });
    });

    it("resolves to false when nothing is waiting", async () => {
      const queue = createQueue(async () => {});
      expect(await queue.runNext(), "An empty queue gives false").toBe(false);
      const job = queue.enqueue("x", null);
      await queue.runNext();
      expect(queue.get(job.id)?.status, "The job must have run").toBe("succeeded");
      expect(await queue.runNext(), "After the only job ran, runNext gives false").toBe(false);
    });

    it('shows "running" while the handler runs', async () => {
      let seen: string | undefined;
      const queue = createQueue(async (job) => {
        seen = queue.get(job.id)?.status;
      });
      queue.enqueue("x", null);
      await queue.runNext();
      expect(seen, 'Inside the handler the job status must be "running"').toBe("running");
    });
  });

  describe("retries", () => {
    it("retries a failed job at the end of the queue until it succeeds", async () => {
      const order: unknown[] = [];
      let failedOnce = false;
      const queue = createQueue(async (job: Job) => {
        order.push(job.payload);
        if (job.payload === "A" && !failedOnce) {
          failedOnce = true;
          throw new Error("temporary failure");
        }
      });
      const a = queue.enqueue("x", "A");
      const b = queue.enqueue("x", "B");

      await queue.runNext();
      expect(queue.get(a.id), "After the first failure, A is queued again with the error").toMatchObject({
        status: "queued",
        attempts: 1,
        error: "temporary failure",
      });

      const runs = await queue.runAll();
      expect(order, "A failed, B ran, then A was retried (A went to the end of the queue)").toEqual(["A", "B", "A"]);
      expect(runs, "runAll resolves to the number of runs it made").toBe(2);
      expect(queue.get(a.id), 'A ends "succeeded" after 2 attempts').toMatchObject({ status: "succeeded", attempts: 2, error: null });
      expect(queue.get(b.id)?.status, "B succeeded").toBe("succeeded");
    });

    it("marks a job failed after maxAttempts", async () => {
      const handler = vi.fn(async () => {
        throw new Error("always broken");
      });
      const queue = createQueue(handler, { maxAttempts: 3 });
      const job = queue.enqueue("x", null);
      await queue.runAll();
      expect(queue.get(job.id), 'After 3 failed attempts the job is "failed"').toMatchObject({
        status: "failed",
        attempts: 3,
        error: "always broken",
      });
      expect(handler, "The handler must run exactly maxAttempts times").toHaveBeenCalledTimes(3);
    });
  });
});
