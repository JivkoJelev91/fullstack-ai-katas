# Read Tasks

**Task ID:** EXPRESS-002 · **Level:** 1 · **File:** `src/express/task2/task2.ts` · **Tests:** `npm run test:express:2`

Build two endpoints: `GET /tasks` returns all tasks, and `GET /tasks/:id` returns one task.

`createApp(initialTasks)` receives the tasks the app starts with. The starter already puts them into the `tasks` Map. You write the handlers.

## The Task object

| Field | Type |
| --- | --- |
| `id` | string |
| `title` | string |
| `priority` | `"low"` \| `"medium"` \| `"high"` |
| `status` | `"todo"` \| `"in_progress"` \| `"done"` |
| `createdAt` | ISO date string |
| `updatedAt` | ISO date string |

The examples below use an app started with these three tasks (other fields shortened as `…`):

| id | title | status |
| --- | --- | --- |
| `t1` | Write notes | `todo` |
| `t2` | Buy milk | `done` |
| `t3` | Call mom | `todo` |

## 1. GET /tasks

**REQUIREMENT:** Return all tasks, in the order they were added, inside `{ "data": [...] }`. Each item is the full Task object with all six fields, exactly as stored (the `…` in the examples stands for the fields left out for brevity). If the request has a `status` query parameter (for example `?status=todo`), return only the tasks whose `status` equals it. Any other value, including an empty one (`?status=`), returns `400` with `{ "error": "<any message>" }`.

**INPUT:**

```http
GET /tasks
```

**OUTPUT:**

```http
200 OK
{ "data": [ { "id": "t1", "title": "Write notes", … }, { "id": "t2", "title": "Buy milk", … }, { "id": "t3", "title": "Call mom", … } ] }
```

**INPUT:**

```http
GET /tasks?status=todo
```

**OUTPUT:**

```http
200 OK
{ "data": [ { "id": "t1", "title": "Write notes", … }, { "id": "t3", "title": "Call mom", … } ] }
```

**Other examples:**

| Input | Output |
| --- | --- |
| `GET /tasks?status=in_progress` | `200` `{ "data": [] }` |
| `GET /tasks` on an app with no tasks | `200` `{ "data": [] }` |
| `GET /tasks?status=finished` | `400` `{ "error": "Invalid status" }` |
| `GET /tasks?status=` | `400` `{ "error": "Invalid status" }` |

## 2. GET /tasks/:id

**REQUIREMENT:** Return the task with that id. If there is none, return `404` with `{ "error": "<any message>" }`.

**INPUT:**

```http
GET /tasks/t2
```

**OUTPUT:**

```http
200 OK
{ "id": "t2", "title": "Buy milk", "priority": "medium", "status": "done", "createdAt": "…", "updatedAt": "…" }
```

**Error example:** `GET /tasks/xyz` returns `404` `{ "error": "Task not found" }`.

## How to check your work

1. **Tests:** `npm run test:express:2`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:2`. It starts your app on `http://localhost:3000` with the three tasks above (`t1`, `t2`, `t3`) and restarts it when you save. Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- You may use any npm package, for example `zod` for validation.
- Edit only `task2.ts`.
