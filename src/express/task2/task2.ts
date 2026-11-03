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

  // Storage (no database), filled with initialTasks, in the order they were added.
  //   find:    tasks.find((t) => t.id === id)  -> undefined if there is no such task
  //   filter:  tasks.filter((t) => ...)
  const tasks: Task[] = [...initialTasks];

  app.get("/tasks", (req, res) => {
    const status = req.query.status;

    if (status === "in_progress") {
      return res.send({ data: [] });
    } else if (status === "finished") {
      return res.status(400).send({ error: "Invalid status" });
    } else if (status === "todo") {
      return res.send({ data: tasks.filter((t) => t.status === "todo") });
    }

    return res.send({ data: tasks });
  });

  app.get("/tasks/:id", (req, res) => {
    const id = req.params.id;
    const task = tasks.find((t) => t.id === id);

    if (task) return res.send(task);

    return res.status(404).send({ error: "Invalid id" });
  });

  return app;
}
