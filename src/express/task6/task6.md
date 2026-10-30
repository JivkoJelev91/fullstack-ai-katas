# Team Notes API with Authentication

**Task ID:** EXPRESS-006 · **Level:** 2 · **File:** `src/express/task6/task6.ts` · **Tests:** `npm run test:express:6`

Build a notes API where every request needs a login token. Notes are **private** (only the author sees them) or **team** (everyone sees them). Admins see and manage everything.

## What you export

```ts
export function createApp(deps: { tokens: TokenVerifier }): Express;
```

The types are already in the starter file. `await deps.tokens.verify(token)` returns the user `{ id, role }` (`role` is `"member"` or `"admin"`), returns `null` for a bad token, or throws when the login service is down. Store notes in memory. Each `createApp()` call starts empty.

## The Note object

| Field        | Type                    | Who sets it                          |
| ------------ | ----------------------- | ------------------------------------ |
| `id`         | string                  | Server: any unique string            |
| `ownerId`    | string                  | Server: the id of the logged-in user |
| `title`      | string                  | Client (stored trimmed)              |
| `body`       | string                  | Client                               |
| `visibility` | `"private"` \| `"team"` | Client (default `"private"`)         |
| `createdAt`  | string (ISO date)       | Server, on create                    |
| `updatedAt`  | string (ISO date)       | Server, on create and on every PATCH |

## Login

All `/notes` and `/admin` routes need the header `Authorization: Bearer <token>`.

| Situation                                   | Response                    |
| ------------------------------------------- | --------------------------- |
| Header missing or not `Bearer <token>`      | `401` `UNAUTHENTICATED` (don't call `verify`) |
| `verify(token)` returns `null`              | `401` `UNAUTHENTICATED`     |
| `verify(token)` throws                      | `503` `AUTH_UNAVAILABLE`    |
| `verify(token)` returns a user              | Continue                    |

The user always comes from `verify`. Ignore any `ownerId` or `role` the client sends.

## Endpoints

| Method & path      | Who may call it          | Body                                        | Success |
| ------------------ | ------------------------ | ------------------------------------------- | ------- |
| `GET /health`      | Anyone (no token needed) | none                                        | `200` + `{ "status": "ok" }` |
| `POST /notes`      | Any logged-in user       | `title` (required), `body` (required), `visibility` | `201` + the note |
| `GET /notes`       | Any logged-in user       | none                                        | `200` + `{ "data": Note[] }`, oldest first, only notes the user can see |
| `GET /notes/:id`   | Users who can see the note | none                                      | `200` + the note |
| `PATCH /notes/:id` | Owner or admin           | any of `title`, `body`, `visibility`        | `200` + the updated note |
| `DELETE /notes/:id`| Owner or admin           | none                                        | `204`, empty body |
| `GET /admin/stats` | Admin only               | none                                        | `200` + `{ "totalNotes": 3, "private": 2, "team": 1 }` |

**Who can see a note:** its owner, any admin, and everyone if `visibility` is `"team"`.

## Validation

| Field        | Rule                                       |
| ------------ | ------------------------------------------ |
| `title`      | string, 1–200 characters after trimming    |
| `body`       | string, up to 10000 characters (may be empty) |
| `visibility` | `private` or `team`                        |

Any other field in the body is ignored.

## Errors

All errors use this JSON shape:

```json
{ "error": { "code": "NOT_FOUND", "message": "any text" } }
```

| When                                                     | Status | Code               |
| -------------------------------------------------------- | ------ | ------------------ |
| No token or bad token                                    | 401    | `UNAUTHENTICATED`  |
| The login service throws                                 | 503    | `AUTH_UNAVAILABLE` |
| The note doesn't exist, **or the user can't see it**     | 404    | `NOT_FOUND`        |
| The user can see the note but isn't its owner or an admin (PATCH/DELETE), or a member calls `/admin/stats` | 403 | `FORBIDDEN` |
| A field breaks a rule                                    | 400    | `VALIDATION_ERROR` |

Check in this order: **401/503 → 404 → 403 → 400**.

## Examples

These tokens are used below:

| Token         | `verify` returns                    |
| ------------- | ----------------------------------- |
| `token-alice` | `{ id: "u-alice", role: "member" }` |
| `token-bob`   | `{ id: "u-bob", role: "member" }`   |
| `token-root`  | `{ id: "u-root", role: "admin" }`   |

**GET /health**

```http
GET /health

200 OK
{ "status": "ok" }
```

**POST /notes** (`ownerId` from the client is ignored)

```http
POST /notes
Authorization: Bearer token-alice
{ "title": "Salary review", "body": "Draft", "ownerId": "u-bob" }

201 Created
{ "id": "n1", "ownerId": "u-alice", "title": "Salary review", "body": "Draft", "visibility": "private",
  "createdAt": "2026-03-01T10:00:00.000Z", "updatedAt": "2026-03-01T10:00:00.000Z" }
```

**GET /notes**

```http
GET /notes
Authorization: Bearer token-alice

200 OK
{ "data": [
  { "id": "n1", "ownerId": "u-alice", "title": "Salary review", "body": "Draft", "visibility": "private",
    "createdAt": "2026-03-01T10:00:00.000Z", "updatedAt": "2026-03-01T10:00:00.000Z" }
] }
```

```http
GET /notes
Authorization: Bearer token-bob

200 OK
{ "data": [] }
```

**GET /notes/:id**

```http
GET /notes/n1
Authorization: Bearer token-alice

200 OK
{ "id": "n1", "ownerId": "u-alice", "title": "Salary review", "body": "Draft", "visibility": "private",
  "createdAt": "2026-03-01T10:00:00.000Z", "updatedAt": "2026-03-01T10:00:00.000Z" }
```

```http
GET /notes/n1
Authorization: Bearer token-bob

404 Not Found
{ "error": { "code": "NOT_FOUND", "message": "Note not found" } }
```

**PATCH /notes/:id**

```http
PATCH /notes/n1
Authorization: Bearer token-alice
{ "visibility": "team" }

200 OK
{ "id": "n1", "ownerId": "u-alice", "title": "Salary review", "body": "Draft", "visibility": "team",
  "createdAt": "2026-03-01T10:00:00.000Z", "updatedAt": "2026-03-01T10:05:00.000Z" }
```

```http
PATCH /notes/n1          (now a team note, so Bob can see it, but he isn't the owner)
Authorization: Bearer token-bob
{ "title": "Hacked" }

403 Forbidden
{ "error": { "code": "FORBIDDEN", "message": "Only the owner can change this note" } }
```

**DELETE /notes/:id**

```http
DELETE /notes/n1
Authorization: Bearer token-root

204 No Content
(empty body)
```

**GET /admin/stats**

```http
GET /admin/stats
Authorization: Bearer token-root

200 OK
{ "totalNotes": 3, "private": 2, "team": 1 }
```

```http
GET /admin/stats
Authorization: Bearer token-alice

403 Forbidden
{ "error": { "code": "FORBIDDEN", "message": "Admins only" } }
```

**Login errors**

```http
GET /notes               (no Authorization header)

401 Unauthorized
{ "error": { "code": "UNAUTHENTICATED", "message": "Missing token" } }
```

```http
GET /notes               (login service is down)
Authorization: Bearer token-alice

503 Service Unavailable
{ "error": { "code": "AUTH_UNAVAILABLE", "message": "Try again later" } }
```

**Validation error**

```http
POST /notes
Authorization: Bearer token-alice
{ "title": "", "body": "x" }

400 Bad Request
{ "error": { "code": "VALIDATION_ERROR", "message": "title must be 1-200 characters" } }
```

## Rules

- You may use any npm package.
- Don't check token signatures. `verify` is the only source of the user.
- Edit only `task6.ts`. Do not change the tests.
