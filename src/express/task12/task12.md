# Who Can See a Note

**Task ID:** EXPRESS-012 · **Level:** 1 · **File:** `src/express/task12/task12.ts` · **Tests:** `npm run test:express:12`

Build two endpoints: `GET /notes` lists the notes I can see and `GET /notes/:id` returns one of them.

`createApp(initialNotes)` receives the notes the app starts with. The starter already puts them into the `notes` array. **Login is already done for you**: the logged-in user is in `res.locals.user`. The `Note` object is the same as in EXPRESS-011.

## Who can see a note

A user can see a note when **at least one** of these is true:

1. The user is its owner (`note.ownerId === user.id`).
2. The note is a team note (`note.visibility === "team"`).
3. The user is an admin (`user.role === "admin"`).

Tip: write this once as a function `canSee(user, note)` and use it in both handlers.

The examples use an app started with these notes:

| id | ownerId | title | visibility |
| --- | --- | --- | --- |
| n1 | u-alice | Alice private | private |
| n2 | u-alice | Alice team | team |
| n3 | u-bob | Bob private | private |
| n4 | u-bob | Bob team | team |

| Token | User | Sees |
| --- | --- | --- |
| `token-alice` | `u-alice`, member | n1, n2, n4 |
| `token-bob` | `u-bob`, member | n2, n3, n4 |
| `token-root` | `u-root`, admin | n1, n2, n3, n4 |

## GET /notes

**REQUIREMENT:** Return `200` with `{ "data": [ ... ] }`: the notes the user can see, in the order they were added.

**INPUT:**

```http
GET /notes
Authorization: Bearer token-bob
```

**OUTPUT:**

```http
200 OK
{ "data": [ { "id": "n2", ... }, { "id": "n3", ... }, { "id": "n4", ... } ] }
```

## GET /notes/:id

**REQUIREMENT:** Return `200` with the note. If there is no note with that id, **or the user can't see it**, return `404` with `{ "error": "<any message>" }`.

Why `404` and not `403` for a hidden note? `403` would tell Bob "a note with this id exists, you just can't read it". `404` tells him nothing.

**INPUT:**

```http
GET /notes/n2
Authorization: Bearer token-bob
```

**OUTPUT:**

```http
200 OK
{ "id": "n2", "ownerId": "u-alice", "title": "Alice team", "body": "shared", "visibility": "team",
  "createdAt": "2026-03-01T10:01:00.000Z", "updatedAt": "2026-03-01T10:01:00.000Z" }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `GET /notes/n1` as Bob (Alice's private note) | `404` `{ "error": "Note not found" }` |
| `GET /notes/xyz` | `404` `{ "error": "Note not found" }` |

## How to check your work

1. **Tests:** `npm run test:express:12`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:12`. It starts your app on `http://localhost:3000` with the notes above. Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- Edit only `task12.ts`.
