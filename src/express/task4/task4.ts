/**
 * EXPRESS-004: Delete a Task
 * Specification: ./task4.md (in this folder)
 * Run the tests:  npm run test:express:4
 * Run the server: npm run dev:express:4
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

  let tasks: Task[] = [...initialTasks];

  app.delete("/tasks/:id", (req, res) => {
    // The :id value is in req.params.id
    const id = req.params.id;

    if(!id) return res.status(404).send({ "error": "task was deleted" });

    const task = tasks.find(t => t.id === id);

    if(task){
      tasks = tasks.filter(t => t.id != id);
      return res.status(204).send({});
    }else{
      return res.status(404).send({ "error": "task not found" })
    }

  });

  return app;
}
