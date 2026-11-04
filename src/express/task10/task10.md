# Login with a Bearer Token

**Task ID:** EXPRESS-010 · **Level:** 1 · **File:** `src/express/task10/task10.ts` · **Tests:** `npm run test:express:10`

Build a **login middleware** and two endpoints: `GET /health` (open to everyone) and `GET /me` (only for logged-in users).

`createApp(deps)` receives `deps.tokens`. `await deps.tokens.verify(token)`:

- returns the user `{ id, role }` for a good token (`role` is `"member"` or `"admin"`),
- returns `null` for a bad token,
- **throws** when the login service is down.

## How the client sends the token

```http
GET /me
Authorization: Bearer token-alice
```

The header value is the word `Bearer`, one space, then the token. Read it with `req.headers.authorization`.

## The login middleware

**REQUIREMENT:** Write a middleware `(req, res, next) => { ... }` and use it for `GET /me`:

| Situation | Response |
| --- | --- |
| No `Authorization` header, or it is not `Bearer <token>` | `401` `{ "error": "<any message>" }`. Don't call `verify`. |
| `verify(token)` returns `null` | `401` `{ "error": "<any message>" }` |
| `verify(token)` throws | `503` `{ "error": "<any message>" }`, without the original error message |
| `verify(token)` returns a user | Save it in `res.locals.user` and call `next()` |

`verify` gets only the token, e.g. `"token-alice"`, not `"Bearer token-alice"`.

## GET /health

**REQUIREMENT:** No login needed. Return `200` with `{ "status": "ok" }`.

## GET /me

**REQUIREMENT:** Login needed. Return `200` with the logged-in user.

The examples use these tokens:

| Token | `verify` returns |
| --- | --- |
| `token-alice` | `{ "id": "u-alice", "role": "member" }` |
| `token-root` | `{ "id": "u-root", "role": "admin" }` |
| anything else | `null` |

**INPUT:**

```http
GET /me
Authorization: Bearer token-alice
```

**OUTPUT:**

```http
200 OK
{ "id": "u-alice", "role": "member" }
```

**INPUT:**

```http
GET /health
```

**OUTPUT:**

```http
200 OK
{ "status": "ok" }
```

**Error examples:**

| Input | Output |
| --- | --- |
| `GET /me` without `Authorization` | `401` `{ "error": "Missing token" }` |
| `GET /me` with `Authorization: Basic abc` | `401` `{ "error": "Missing token" }` |
| `GET /me` with `Authorization: Bearer expired` | `401` `{ "error": "Invalid token" }` |
| `GET /me` while the login service is down | `503` `{ "error": "Try again later" }` |

## How to check your work

1. **Tests:** `npm run test:express:10`. A failed test names the rule it checks and shows what your app returned. For a `500`, it shows the error your code threw.
2. **Manual requests:** run `npm run dev:express:10`. It starts your app on `http://localhost:3000` with the tokens `token-alice`, `token-bob` and `token-root`. The token `token-down` makes `verify` throw, as if the login service were down. Send the requests in `requests.http` (VS Code extension **REST Client**).
3. **Breakpoints:** run either command in a VS Code **JavaScript Debug Terminal**.

## Rules

- Don't check token signatures. `verify` is the only source of the user.
- Edit only `task10.ts`.
