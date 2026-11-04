# Create and List My Notes

**Task ID:** EXPRESS-011 · **Level:** 1 · **File:** `src/express/task11/task11.ts` · **Tests:** `npm run test:express:11`

Build two endpoints for logged-in users: `POST /notes` creates a note and `GET /notes` lists **my** notes.

`createApp(initialNotes)` receives the notes the app starts with. The starter already puts them into the `notes` array.

**Login is already done for you** (you built it in EXPRESS-010). Every request needs `Authorization: Bearer <token>`, and the logged-in user is in `res.locals.user`. The tokens are in `USERS` in the starter:

| Token | User |
| --- | --- |
| `token-alice` | `{ "id": "u-alice", "role": "member" }` |
| `token-bob` | `{ "id": "u-bob", "role": "member" }` |
| `token-root` | `{ "id": "u-root", "role": "admin" }` |

## The Note object

| Field | Type | Who sets it | Value |
| --- | --- | --- | --- |
| `id` | string | server | A new unique id |
| `ownerId` | string | server | The `id` of the logged-in user |
| `title` | string | client | Required, 1–200 characters after trimming. Saved trimmed. |
| `body` | string | client | Required, up to 10000 characters. Can be `""`. |
| `visibility` | `"private"` \| `"team"` | client | Optional. Default `"private"` |
| `createdAt` | string | server | The current time as an ISO string |
| `updatedAt` | string | server | The same value as `createdAt` |

The server ignores any other field the client sends, including `id` and `ownerId`.

## POST /notes

**REQUIREMENT:** Validate the body, build the note, save it in `notes` and return it with status `201`. If the body is invalid, return `400` with `{ "error": "<any message>" }` and save nothing.

**INPUT:** Bob's id is ignored, the note belongs to the logged-in user

```http
POST /notes
Authorization: Bearer token-alice
{ "title": "  Shopping list  ", "body": "Milk", "ownerId": "u-bob" }
```

**OUTPUT:**

```http
201 Created
{ "id": "3f2a9c1e-…", "ownerId": "u-alice", "title": "Shopping list", "body": "Milk", "visibility": "private",
  "createdAt": "2026-03-01T10:00:00.000Z", "updatedAt": "2026-03-01T10:00:00.000Z" }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `{ "body": "x" }` | `400` `{ "error": "title is required" }` |
| `{ "title": "   ", "body": "x" }` | `400` `{ "error": "title must be 1-200 characters" }` |
| `{ "title": "Plan" }` | `400` `{ "error": "body is required" }` |
| `{ "title": "Plan", "body": "x", "visibility": "public" }` | `400` `{ "error": "Invalid visibility" }` |

## GET /notes

**REQUIREMENT:** Return `200` with `{ "data": [ ... ] }`: only the notes whose `ownerId` is the logged-in user, in the order they were added. Notes of other users are never included, even `"team"` notes (that comes in EXPRESS-012).

**INPUT:**

```http
GET /notes
Authorization: Bearer token-bob
```

**OUTPUT:** Bob has no notes yet

```http
200 OK
{ "data": [] }
```

## How to check your work

1. **Tests:** `npm run test:express:11`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:11`. It starts your app on `http://localhost:3000` with no notes and restarts it when you save (which also deletes the notes). Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- You may use any npm package, for example `zod` for validation.
- Edit only `task11.ts`.
