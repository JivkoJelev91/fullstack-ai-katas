# Edit and Delete Notes

**Task ID:** EXPRESS-013 · **Level:** 2 · **File:** `src/express/task13/task13.ts` · **Tests:** `npm run test:express:13`

Build two endpoints: `PATCH /notes/:id` changes a note and `DELETE /notes/:id` removes it. Only the **owner** or an **admin** may do that.

`createApp(initialNotes)` receives the notes the app starts with. The starter already puts them into the `notes` array. **Login is already done for you**: the logged-in user is in `res.locals.user`. The `Note` object and its validation rules are the same as in EXPRESS-011. "Can see" means the same as in EXPRESS-012.

The examples use the same notes and tokens as EXPRESS-012:

| id | ownerId | visibility |
| --- | --- | --- |
| n1 | u-alice | private |
| n2 | u-alice | team |
| n3 | u-bob | private |
| n4 | u-bob | team |

## The checks, in this order

Both endpoints run the same checks. Stop at the first one that fails:

| # | Check | If it fails |
| --- | --- | --- |
| 1 | The note exists **and** the user can see it | `404` `{ "error": "<any message>" }` |
| 2 | The user is the owner **or** an admin | `403` `{ "error": "<any message>" }` |
| 3 | (PATCH only) The body is valid | `400` `{ "error": "<any message>" }` |

So Bob gets `404` for Alice's private note `n1` (he can't even see it) and `403` for Alice's team note `n2` (he can see it, but it is not his).

## PATCH /notes/:id

**REQUIREMENT:**

- The body can contain any of `title`, `body` and `visibility`: one, several or all of them. Each sent field follows the rules of EXPRESS-011. `title` is saved trimmed.
- Change only the fields that are sent. The other fields keep their values.
- Set `updatedAt` to the current time. `id`, `ownerId` and `createdAt` never change, even if the client sends them.
- Return `200` with the updated note.
- If a sent field is invalid, change nothing.

**INPUT:**

```http
PATCH /notes/n1
Authorization: Bearer token-alice
{ "visibility": "team", "ownerId": "u-bob" }
```

**OUTPUT:** `ownerId` is ignored

```http
200 OK
{ "id": "n1", "ownerId": "u-alice", "title": "Alice private", "body": "secret", "visibility": "team",
  "createdAt": "2026-03-01T10:00:00.000Z", "updatedAt": "2026-10-30T12:00:00.000Z" }
```

## DELETE /notes/:id

**REQUIREMENT:** Remove the note and return `204` with an empty body.

**INPUT:**

```http
DELETE /notes/n3
Authorization: Bearer token-root
```

**OUTPUT:** an admin may delete any note

```http
204 No Content
(empty body)
```

**Error examples:**

| Input | Output |
| --- | --- |
| `PATCH /notes/n1` as Bob | `404` `{ "error": "Note not found" }` |
| `PATCH /notes/n2` as Bob | `403` `{ "error": "Only the owner can change this note" }` |
| `PATCH /notes/n2` as Bob with `{ "title": "" }` | `403` (the permission check comes before validation) |
| `PATCH /notes/n1` as Alice with `{ "title": "" }` | `400` `{ "error": "title must be 1-200 characters" }` |
| `DELETE /notes/n2` as Bob | `403` `{ "error": "Only the owner can delete this note" }` |
| `DELETE /notes/xyz` | `404` `{ "error": "Note not found" }` |

## How to check your work

1. **Tests:** `npm run test:express:13`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:13`. It starts your app on `http://localhost:3000` with the notes above and restarts it when you save (which also resets the notes). Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- You may use any npm package, for example `zod` for validation.
- Edit only `task13.ts`.
