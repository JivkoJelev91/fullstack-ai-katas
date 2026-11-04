# Admin Stats

**Task ID:** EXPRESS-014 · **Level:** 1 · **File:** `src/express/task14/task14.ts` · **Tests:** `npm run test:express:14`

Build one endpoint that only admins may call: `GET /admin/stats` counts the notes.

`createApp(initialNotes)` receives the notes the app starts with. The starter already puts them into the `notes` array. **Login is already done for you**: the logged-in user is in `res.locals.user`. The `Note` object is the same as in EXPRESS-011.

## GET /admin/stats

**REQUIREMENT:**

- Only for admins (`user.role === "admin"`). A member gets `403` with `{ "error": "<any message>" }`.
- Return `200` with:

| Field | Meaning |
| --- | --- |
| `totalNotes` | How many notes there are |
| `private` | How many have `visibility: "private"` |
| `team` | How many have `visibility: "team"` |
| `byOwner` | An object: for each `ownerId`, how many notes they have. Owners without notes are not listed. |

Tip: write the admin check as a small middleware `requireAdmin(req, res, next)` and put it before the handler: `app.get("/admin/stats", requireAdmin, (req, res) => { ... })`.

The examples use an app started with these notes:

| id | ownerId | visibility |
| --- | --- | --- |
| n1 | u-alice | private |
| n2 | u-alice | team |
| n3 | u-bob | private |
| n4 | u-bob | team |
| n5 | u-alice | private |

**INPUT:**

```http
GET /admin/stats
Authorization: Bearer token-root
```

**OUTPUT:**

```http
200 OK
{ "totalNotes": 5, "private": 3, "team": 2, "byOwner": { "u-alice": 3, "u-bob": 2 } }
```

**INPUT:** no notes

```http
GET /admin/stats
Authorization: Bearer token-root
```

**OUTPUT:**

```http
200 OK
{ "totalNotes": 0, "private": 0, "team": 0, "byOwner": {} }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `GET /admin/stats` as Alice (member) | `403` `{ "error": "Admins only" }` |

## How to check your work

1. **Tests:** `npm run test:express:14`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:14`. It starts your app on `http://localhost:3000` with notes `n1` … `n4`. Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- Edit only `task14.ts`.
