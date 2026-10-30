/**
 * EXPRESS-002: Read Tasks
 * Specification: ./task2.md (in this folder)
 * Run the tests:  npm run test:express:2
 * Run the server: npm run dev:express:2
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
  //   find:    tasks.get(id)        -> undefined if there is no such task
  //   get all: [...tasks.values()]  -> in the order they were added
  const tasks = new Map<string, Task>(initialTasks.map((task) => [task.id, task]));

  app.get("/tasks", (_req, _res) => {
    // The ?status= value is in req.query.status
    throw new Error("Not implemented: GET /tasks");
  });

  app.get("/tasks/:id", (_req, _res) => {
    // The :id value is in req.params.id
    throw new Error("Not implemented: GET /tasks/:id");
  });

  return app;
}
