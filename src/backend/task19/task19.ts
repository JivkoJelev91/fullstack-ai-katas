/**
 * BACKEND-019: Background Job Queue
 * Specification: ./task19.md (in this folder)
 * Run the tests: npm run test:backend:19
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import { randomUUID } from "node:crypto";

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
  id: string;
  type: string;
  payload: unknown;
  status: JobStatus;
  /** How many times the handler has been started for this job. */
  attempts: number;
  /** The last error message, or null. */
  error: string | null;
}

export type JobHandler = (job: Job) => Promise<void>;

export function createQueue(_handler: JobHandler, options: { maxAttempts?: number } = {}) {
  const { maxAttempts = 3 } = options;
  // Storage: all jobs by id, and the ids waiting to run, oldest first.
  const jobs = new Map<string, Job>();
  const waiting: string[] = [];
  void maxAttempts;
  void jobs;
  void waiting;
  void randomUUID;

  return {
    enqueue(_type: string, _payload: unknown): Job {
      throw new Error("Not implemented: enqueue");
    },

    get(_id: string): Job | undefined {
      throw new Error("Not implemented: get");
    },

    /** Runs the oldest waiting job once. Resolves to false if nothing was waiting. */
    async runNext(): Promise<boolean> {
      throw new Error("Not implemented: runNext");
    },

    /** Calls runNext until nothing is waiting. Resolves to how many runs happened. */
    async runAll(): Promise<number> {
      throw new Error("Not implemented: runAll");
    },
  };
}
