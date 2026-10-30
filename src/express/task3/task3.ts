/**
 * EXPRESS-003: Update a Task
 * Specification: ./task3.md (in this folder)
 * Run the tests:  npm run test:express:3
 * Run the server: npm run dev:express:3
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { type Express } from "express";

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** ISO 8601 timestamp */
  updatedAt: string;
}

export function createApp(initialTasks: Task[] = []): Express {
  const app = express();
  app.use(express.json()); // parses a JSON request body into req.body

  // Storage (no database), filled with initialTasks: key = task id, value = the task.
  //   find: tasks.get(id)        -> undefined if there is no such task
  //   save: tasks.set(id, task)
  const tasks = new Map<string, Task>(initialTasks.map((task) => [task.id, task]));

  app.patch("/tasks/:id", (_req, _res) => {
    // The :id value is in req.params.id
    // Current time (ISO text): new Date().toISOString()
    throw new Error("Not implemented: PATCH /tasks/:id");
  });

  return app;
}
