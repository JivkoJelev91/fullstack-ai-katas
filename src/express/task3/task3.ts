/**
 * EXPRESS-003: Update a Task
 * Specification: ./task3.md (in this folder)
 * Run the tests:  npm run test:express:3
 * Run the server: npm run dev:express:3
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { type Express } from "express";
import { z } from "zod";

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

const TaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  priority: z.enum(["low", "medium", "high"]),
  status: z.enum(["todo", "in_progress", "done"]),
});

// POST: no status; priority gets a default
const PatchTaskSchema = TaskSchema.partial();

export function createApp(initialTasks: Task[] = []): Express {
  const app = express();
  app.use(express.json()); // parses a JSON request body into req.body

  // Storage (no database), filled with initialTasks.
  //   find: tasks.find((t) => t.id === id)                 -> undefined if there is no such task
  //   save: tasks[tasks.findIndex((t) => t.id === id)] = task
  const tasks: Task[] = [...initialTasks];

app.patch("/tasks/:id", (req, res) => {
  const id = req.params.id;
  const now = new Date().toISOString();

  const task = tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: "Task not found" });

  const result = PatchTaskSchema.safeParse(req.body);
  if (!result.success) return res.status(400).json({ error: "Invalid body" });

  const updated: Task = { ...task, ...result.data, updatedAt: now };
  tasks[tasks.indexOf(task)] = updated;

  return res.status(200).json(updated);
});


  return app;
}
