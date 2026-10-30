# JSON Web Tokens (HS256)

**Task ID:** BACKEND-008 · **Level:** 2 · **File:** `src/backend/task8/task8.ts` · **Tests:** `npm run test:backend:8`

A JWT is a signed token: the server puts the user's id in it and signs it with a secret. Later the server can check the signature, without a database lookup, to be sure the token is its own and nobody changed it. Write `signToken` and `verifyToken` with Node's `crypto`, so you see exactly what a JWT library does.

## What a JWT looks like

Three base64url parts joined with dots: `header.payload.signature`

| Part | Content |
| --- | --- |
| header | the JSON `{"alg":"HS256","typ":"JWT"}`, base64url-encoded |
| payload | the JSON `{"sub":"u1","email":"ana@example.com","iat":1767225600,"exp":1767229200}`, base64url-encoded |
| signature | HMAC-SHA256 of the text `header.payload` (the first two parts with the dot), with the secret, base64url-encoded |

`iat` and `exp` are in **seconds**, while `Date.now()` is in **milliseconds**. Use `Math.floor(now / 1000)`.

## 1. signToken(claims, secret, { expiresInSeconds, now = Date.now() })

**REQUIREMENT:** Build the token above. `iat` is the current time in seconds and `exp` is `iat + expiresInSeconds`.

| Call | Payload inside the token |
| --- | --- |
| `signToken({ sub: "u1", email: "ana@example.com" }, "s3cret", { expiresInSeconds: 3600, now: 1767225600000 })` | `{ "sub": "u1", "email": "ana@example.com", "iat": 1767225600, "exp": 1767229200 }` |

## 2. verifyToken(token, secret, now = Date.now())

**REQUIREMENT:** Return the payload object if the token is valid, otherwise `null`. It must never throw. A token is valid only if all of these hold:

- It has exactly 3 parts.
- The header is JSON with `alg: "HS256"`. Rejecting other algorithms blocks the known `"alg": "none"` attack.
- The signature equals the one you compute from the first two parts and the secret. Compare with `timingSafeEqual`, and check that the lengths match first (it throws on different lengths).
- The payload is JSON and `exp` is later than now (in seconds).

| Case | Result |
| --- | --- |
| a token from `signToken` with the same secret | the payload |
| the same token, verified with another secret | `null` |
| the payload part replaced with a changed one | `null` |
| `now` at or after `exp` | `null` |
| `"abc"`, `"a.b"`, `"a.b.c"` | `null` |

## How to check your work

Run `npm run test:backend:8`. One test also checks a token built by a standard JWT implementation, to make sure your format is the real one.

## Rules

- Use only `node:crypto` (no JWT library). In real projects you would use a library such as `jose`.
- Edit only `task8.ts`.
