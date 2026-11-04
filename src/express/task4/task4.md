# Delete a Task

**Task ID:** EXPRESS-004 · **Level:** 1 · **File:** `src/express/task4/task4.ts` · **Tests:** `npm run test:express:4`

Build one endpoint: `DELETE /tasks/:id` removes a task.

`createApp(initialTasks)` receives the tasks the app starts with. The starter already puts them into the `tasks` array. You write the handler.

The examples use an app started with tasks `t1` and `t2`.

## DELETE /tasks/:id

**REQUIREMENT:** Remove the task with that id from `tasks` and return `204` with an empty body. If no task has that id, return `404` with `{ "error": "<any message>" }`.

**INPUT:**

```http
DELETE /tasks/t1
```

**OUTPUT:**

```http
204 No Content
(empty body)
```

**Error examples:**

| Input | Output |
| --- | --- |
| `DELETE /tasks/xyz` | `404` `{ "error": "Task not found" }` |
| `DELETE /tasks/t1` a second time | `404` `{ "error": "Task not found" }` (it is already gone) |

`204` means "done, nothing to send back". Send it without a body.

## How to check your work

1. **Tests:** `npm run test:express:4`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:4`. It starts your app on `http://localhost:3000` with tasks `t1`, `t2` and `t3` and restarts it when you save (which also resets the tasks). Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- Edit only `task4.ts`.
