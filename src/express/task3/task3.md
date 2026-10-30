# Update a Task

**Task ID:** EXPRESS-003 · **Level:** 1 · **File:** `src/express/task3/task3.ts` · **Tests:** `npm run test:express:3`

Build one endpoint: `PATCH /tasks/:id` changes some fields of a task and returns the updated task.

`createApp(initialTasks)` receives the tasks the app starts with. The starter already puts them into the `tasks` Map. You write the handler.

## The Task object

| Field | Type | Can the client change it? |
| --- | --- | --- |
| `id` | string | No |
| `title` | string | Yes: a non-empty string |
| `priority` | `"low"` \| `"medium"` \| `"high"` | Yes |
| `status` | `"todo"` \| `"in_progress"` \| `"done"` | Yes |
| `createdAt` | ISO date string | No |
| `updatedAt` | ISO date string | No: the server sets it to the current time on every update |

The examples use an app started with this task:

```json
{ "id": "t1", "title": "Write notes", "priority": "high", "status": "todo",
  "createdAt": "2026-03-01T10:00:00.000Z", "updatedAt": "2026-03-01T10:00:00.000Z" }
```

## PATCH /tasks/:id

**REQUIREMENT:**

- The body can contain any of `title`, `priority` and `status`: one, several or all of them.
- Change only the fields that are sent. The other fields keep their values.
- Set `updatedAt` to the current time. `id` and `createdAt` never change, even if the client sends them.
- Return `200` with the updated task.
- If no task has that id, return `404` with `{ "error": "<any message>" }`.
- If a sent field is invalid, return `400` with `{ "error": "<any message>" }` and change nothing.

**INPUT:**

```http
PATCH /tasks/t1
{ "status": "done" }
```

**OUTPUT:** only `status` and `updatedAt` changed

```http
200 OK
{ "id": "t1", "title": "Write notes", "priority": "high", "status": "done",
  "createdAt": "2026-03-01T10:00:00.000Z", "updatedAt": "2026-10-30T12:00:00.000Z" }
```

**INPUT:**

```http
PATCH /tasks/t1
{ "title": "Write better notes", "priority": "low" }
```

**OUTPUT:**

```http
200 OK
{ "id": "t1", "title": "Write better notes", "priority": "low", "status": "todo",
  "createdAt": "2026-03-01T10:00:00.000Z", "updatedAt": "2026-10-30T12:00:00.000Z" }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `PATCH /tasks/xyz` with `{ "status": "done" }` | `404` `{ "error": "Task not found" }` |
| `PATCH /tasks/t1` with `{ "status": "finished" }` | `400` `{ "error": "Invalid status" }` |
| `PATCH /tasks/t1` with `{ "title": "" }` | `400` `{ "error": "Title must not be empty" }` |
| `PATCH /tasks/t1` with `{ "priority": "urgent" }` | `400` `{ "error": "Invalid priority" }` |

## How to check your work

1. **Tests:** `npm run test:express:3`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:3`. It starts your app on `http://localhost:3000` with tasks `t1`, `t2` and `t3` and restarts it when you save (which also resets the tasks). Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- You may use any npm package, for example `zod` for validation.
- Edit only `task3.ts`.
