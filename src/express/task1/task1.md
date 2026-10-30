# Create a Task

**Task ID:** EXPRESS-001 · **Level:** 1 · **File:** `src/express/task1/task1.ts` · **Tests:** `npm run test:express:1`

Build one endpoint: `POST /tasks` creates a task, saves it and returns it.

The starter already creates the Express app, parses JSON bodies and has a `tasks` Map to save into. You write the handler.

## The Task object

| Field | Type | Who sets it | Value |
| --- | --- | --- | --- |
| `id` | string | server | A new unique id for every task |
| `title` | string | client | Required, a non-empty string |
| `priority` | `"low"` \| `"medium"` \| `"high"` | client | Optional. If the client does not send it: `"medium"` |
| `status` | `"todo"` \| `"in_progress"` \| `"done"` | server | Always `"todo"` for a new task |
| `createdAt` | string | server | The current time as an ISO string |
| `updatedAt` | string | server | The same value as `createdAt` |

The server ignores any other field the client sends, including `id` and `status`.

## POST /tasks

**REQUIREMENT:** Validate the body, build the task, save it in `tasks` and return it with status `201`. If the body is invalid, return `400` with `{ "error": "<any message>" }` and save nothing.

**INPUT:** with a priority

```http
POST /tasks
{ "title": "Write notes", "priority": "high" }
```

**OUTPUT:**

```http
201 Created
{ "id": "3f2a9c1e-…", "title": "Write notes", "priority": "high", "status": "todo",
  "createdAt": "2026-03-01T10:00:00.000Z", "updatedAt": "2026-03-01T10:00:00.000Z" }
```

**INPUT:** without a priority

```http
POST /tasks
{ "title": "Buy milk" }
```

**OUTPUT:** `priority` becomes `"medium"`

```http
201 Created
{ "id": "8c41d7b2-…", "title": "Buy milk", "priority": "medium", "status": "todo",
  "createdAt": "2026-03-01T10:01:00.000Z", "updatedAt": "2026-03-01T10:01:00.000Z" }
```

**INPUT:** the client tries to set `id` and `status`

```http
POST /tasks
{ "title": "Sneaky", "id": "my-id", "status": "done" }
```

**OUTPUT:** both are ignored

```http
201 Created
{ "id": "a7e0f513-…", "title": "Sneaky", "priority": "medium", "status": "todo", … }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `{}` | `400` `{ "error": "Title is required" }` |
| `{ "title": "" }` | `400` `{ "error": "Title is required" }` |
| `{ "title": 42 }` | `400` `{ "error": "Title must be a string" }` |
| `{ "title": "X", "priority": "urgent" }` | `400` `{ "error": "Invalid priority" }` |

The error text can be anything. The tests only check the status and that `error` is a string.

## How to check your work

1. **Tests:** `npm run test:express:1`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:1`. It starts your app on `http://localhost:3000` and restarts it when you save. Then send the requests in `requests.http` (VS Code extension **REST Client**: click **Send Request**). Errors your code throws are printed in the server terminal.
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- You may use any npm package, for example `zod` for validation.
- Edit only `task1.ts`.
