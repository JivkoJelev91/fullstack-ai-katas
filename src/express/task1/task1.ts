/**
 * EXPRESS-001: Create a Task
 * Specification: ./task1.md (in this folder)
 * Run the tests:  npm run test:express:1
 * Run the server: npm run dev:express:1
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { type Express } from "express";
import bodyParser from "body-parser";
import { z } from 'zod';
import { randomUUID } from "node:crypto";

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
  priority: z.enum(["low" , "medium", "high"]).default('medium').optional(),
  status: z.enum(["todo" , "in_progress", "done"]).default('todo').optional(),
});

// POST: no status; priority gets a default
const CreateTaskSchema = TaskSchema.omit({ status: true }).extend({
  priority: TaskSchema.shape.priority.default("medium"),
  status: TaskSchema.shape.status.default('todo')
});

export function createApp(): Express {
  const app = express();

  app.use(bodyParser.json());

  // Storage (no database): key = task id, value = the task.
  //   save: tasks.set(task.id, task)
  const tasks = new Map<string, Task>();

  // Use these when you create or update a task:
  
  app.post("/tasks", (req, res) => {
    
    if (req.body) {
      const id = randomUUID();              // unique id, e.g. "3f2a9c1e-..."
      const now = new Date().toISOString(); // e.g. "2026-03-01T10:00:00.000Z"
      try {
        req.body = CreateTaskSchema.parse(req.body);
        const title = req.body.title as string;
        const priority = req.body.priority as TaskPriority;
        const task: Task = {
           id,
           title,
           priority,
           status: 'todo',
           createdAt: now,
           updatedAt: now,
        };
        if(task) tasks.set(id, task);
        return res.status(201).send(task)
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .send({ error: error.issues[0]?.message ?? "Invalid input" });
        }
      }
    } else {
      return res
        .status(404)
        .send({ error: "Task not found" });
    }
  });

  return app;
}
