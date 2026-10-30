# API Keys

**Task ID:** BACKEND-010 · **Level:** 2 · **File:** `src/backend/task10/task10.ts` · **Tests:** `npm run test:backend:10`

Scripts and other servers often authenticate with an API key instead of a login. An API key works like a password, so it's stored the same way: **only a hash of it**. If the database leaks, the attacker gets hashes, not working keys. The user sees the full key once, when it's created.

## 1. createApiKeyStore()

The starter gives you the `records` Map and a `records()` function the tests use to look at what you store.

**create(userId):**

- Make the key: `"sk_"` + 48 random hex characters (`randomBytes(24).toString("hex")`). The `sk_` prefix makes leaked keys easy to recognize, for example by secret scanners.
- Store `{ id: randomUUID(), userId, keyHash: sha256(key) as hex, revoked: false }`. Don't store the key itself.
- Return `{ id, key }`.

**verify(key):** hash the given key and find a record with that `keyHash` that isn't revoked. Return its `userId`, otherwise `null`.

**revoke(id):** set `revoked: true` on that record and return `true`. For an unknown id, return `false`.

| Call | Result |
| --- | --- |
| `create("u1")` | `{ id: "9b1c…", key: "sk_3f9a…" }` (51 characters) |
| `verify("sk_3f9a…")` | `"u1"` |
| `verify("sk_wrong")` | `null` |
| `revoke("9b1c…")`, then `verify("sk_3f9a…")` | `true`, then `null` |

## 2. requireApiKey(store)

**REQUIREMENT:** Read the key from the `x-api-key` header. If `store.verify(key)` returns a user id, set `res.locals.userId` and call `next()`. Otherwise (missing or invalid key), respond `401` with `{ "error": "<any message>" }`.

| Input | Output |
| --- | --- |
| `GET /whoami` with a valid `x-api-key` | `200` `{ "userId": "u1" }` |
| `GET /whoami` without the header, or with a wrong or revoked key | `401` `{ "error": "Invalid API key" }` |

## How to check your work

Run `npm run test:backend:10`.

## Rules

- Edit only `task10.ts`.
