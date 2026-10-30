# Health Checks and Configuration

**Task ID:** BACKEND-022 · **Level:** 1 · **File:** `src/backend/task22/task22.ts` · **Tests:** `npm run test:backend:22`

Two things every deployed service needs:

- **Configuration from environment variables**, checked at startup. A missing `DATABASE_URL` should stop the app immediately with a clear message, not crash an hour later on the first query.
- **Health endpoints** that the platform (Docker, Kubernetes, a load balancer) calls: `/health` asks "is the process alive?", and `/ready` asks "can it handle traffic right now?".

## 1. loadConfig(env)

**REQUIREMENT:** Read the variables from `env` (in the app, `process.env`) and return the config:

| Variable | Required | Rule | Becomes |
| --- | --- | --- | --- |
| `PORT` | no, default `3000` | an integer from 1 to 65535 | `port` (a number) |
| `DATABASE_URL` | yes | non-empty | `databaseUrl` |
| `LLM_API_KEY` | yes | non-empty | `llmApiKey` |
| `LOG_LEVEL` | no, default `"info"` | `debug`, `info`, `warn` or `error` | `logLevel` |

If **any** variable is missing or invalid, throw `new ConfigError([...names])` listing **all** of them at once, so they can be fixed in one go, not one restart at a time.

| `env` | Result |
| --- | --- |
| `{ DATABASE_URL: "postgres://db", LLM_API_KEY: "sk-1" }` | `{ port: 3000, databaseUrl: "postgres://db", llmApiKey: "sk-1", logLevel: "info" }` |
| `{ PORT: "8080", DATABASE_URL: "…", LLM_API_KEY: "…", LOG_LEVEL: "debug" }` | `port: 8080`, `logLevel: "debug"` |
| `{ PORT: "abc" }` | throws `ConfigError` with `variables` `["PORT", "DATABASE_URL", "LLM_API_KEY"]` (any order) |

## 2. GET /health

**REQUIREMENT:** Always `200` `{ "status": "ok" }`, without running any checks. It only proves the process responds.

## 3. GET /ready

**REQUIREMENT:** Run **all** checks at the same time. Each check's result is `"ok"` if it resolves and `"failed"` if it rejects.

| Checks | Output |
| --- | --- |
| all resolve | `200` `{ "status": "ready", "checks": { "database": "ok", "llm": "ok" } }` |
| `llm` rejects | `503` `{ "status": "not_ready", "checks": { "database": "ok", "llm": "failed" } }` |

`503 Service Unavailable` tells the load balancer to send traffic to another instance for now.

## How to check your work

Run `npm run test:backend:22`.

## Rules

- Edit only `task22.ts`.
