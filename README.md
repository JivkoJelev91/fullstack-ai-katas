# Fullstack AI Katas

A self-study repository of practical Full-Stack TypeScript, backend and AI engineering exercises (LLM APIs, RAG and vector databases, LangChain/LangGraph, agents, AI production engineering and fine-tuning workflows) — everything in TypeScript. Each task is a realistic work assignment with a written specification, a starter file with the required contract, and an automated test suite that checks your implementation.

## Layout

```
INDEX.md    All tasks with IDs, levels, prerequisites and commands
src/        One folder per task: the specification (taskN.md) next to its starter file (taskN.ts)
tests/      Automated tests (do not modify to make them pass)
prisma/     Prisma schema used by the PostgreSQL/Prisma tasks
```

| Path                         | Purpose                                                  |
| ---------------------------- | -------------------------------------------------------- |
| `INDEX.md`                   | All tasks with IDs, levels, prerequisites and commands   |
| `src/<category>/taskN/taskN.md` | The task specification (read this)                  |
| `src/<category>/taskN/taskN.ts` | The starter file — where you write your solution    |
| `src/shared/errors.ts`       | Error classes used by the data-access tasks              |
| `src/ai/shared/llm.ts`       | Provider-agnostic `LLMClient` contract for the AI tasks  |
| `src/agents/shared/tool-chat.ts` | Tool-calling model contract for the agent tasks     |
| `src/rag/shared.ts`          | `SqlDatabase` and `Embedder` contracts for the RAG tasks |
| `src/backend/shared.ts`      | Contracts and the chat database schema for the BACKEND tasks |
| `LEARNING-PATH.md`           | The recommended order of the categories                 |
| `src/generated/prisma/`      | Generated Prisma client (created by `npm install`)       |
| `tests/support/`             | Test reporter, database helpers, PGlite, mock LLMs, fake chat model and embedder |

## Workflow

Every task follows the same five steps:

1. **Read** the specification `src/<category>/taskN/taskN.md` (or start from `INDEX.md`).
2. **Open** the starter file in the same folder, e.g. `src/express/task1/task1.ts`.
3. **Implement** the solution in place of the `throw new Error("... not implemented ...")` lines.
4. **Run** the task's test command, e.g. `npm run test:express:1`.
5. **Read** the PASS/FAIL output and iterate until every test passes.

### What a starter file contains

- The imports you need to get going.
- The exported contract: types, interfaces, error classes and constants taken from the specification.
- The skeleton of every required export (function, `createApp`, client factory, route handlers) with the exact signature the tests use.
- `TODO` comments that point to sections of the specification — no hints about how to solve them.
- Every unimplemented piece throws `"... not implemented ..."`, so all tests fail until you implement the task. No test passes against an untouched starter file.

Keep the exported names, types and signatures unchanged. You may add your own helpers, files and dependencies.

Tasks that need a complete framework application (for example Next.js) ship with their own minimal project scaffold inside the task's directory, with the same workflow and their own test command.

## Requirements

- Node.js 20.19 or newer (developed with Node 24)
- npm 11 or newer is fine; install-script approvals for `esbuild` and `prisma` are already recorded in `package.json`
- PostgreSQL 14+ for the PostgreSQL/Prisma tasks only

## Setup

```bash
npm install          # also generates the Prisma client
npm run typecheck    # optional: type-check src/ and tests/
```

### Database setup (PostgreSQL/Prisma tasks only)

The database tests need a **dedicated, disposable** database. Every test empties the tables it uses.

1. Create a test database, for example:

   ```bash
   createdb -U postgres coding_practice_test
   ```

2. Copy the example environment file and adjust the URL (user, password, port):

   ```bash
   cp .env.test.example .env.test
   ```

3. Check the connection:

   ```bash
   npm run db:test:check
   ```

Safety rules built into the test setup:

- Tests only read `DATABASE_URL_TEST` (from `.env.test`), never `DATABASE_URL`.
- They refuse to run unless the database name contains `test`.
- Before the database tests run, the schema is synced with `prisma db push` (non-destructive). If a schema change ever requires dropping data, recreate the test database yourself and re-run.

Only the PostgreSQL/Prisma tasks need this. The RAG tasks that use PostgreSQL + pgvector run on **PGlite** (an in-process PostgreSQL build with pgvector) created fresh for every test, so they need no setup.

## Running tests

| Command                  | Runs                                         |
| ------------------------ | -------------------------------------------- |
| `npm test`               | Every task (needs the test database)         |
| `npm run test:unit`      | Every task that does not need a database     |
| `npm run test:db`        | Every database task                          |
| `npm run test:express`   | All Express tasks                            |
| `npm run test:express:1` | EXPRESS-001 (also `:2` … `:14`)              |
| `npm run test:backend`   | All BACKEND tasks (no database setup needed)  |
| `npm run test:backend:1` | BACKEND-001 (also `:2` … `:25`)               |
| `npm run dev:express:1`  | Starts EXPRESS-001 on port 3000 for manual requests (also `:2` … `:14`) |
| `npm run test:prisma`    | All PostgreSQL/Prisma tasks                  |
| `npm run test:prisma:1`  | PRISMA-001 (also `:2`)                       |
| `npm run test:ai`        | All LLM API integration tasks                |
| `npm run test:ai:1`      | AI-001 (also `:2` … `:5`)                    |
| `npm run test:rag:1`     | RAG-001 (also `:2` … `:6`; all: `test:rag`)   |
| `npm run test:langchain:1` | LC-001 (also `:2` … `:4`; all: `test:langchain`) |
| `npm run test:agents:1`  | AGENT-001 (also `:2`, `:3`; all: `test:agents`) |
| `npm run test:aiops:1`   | AIOPS-001 (also `:2` … `:5`; all: `test:aiops`) |
| `npm run test:ft:1`      | FT-001 (also `:2` … `:4`; all: `test:ft`)      |
| `npm run test:watch`     | Vitest in watch mode                         |

You can also run any test file directly with Vitest:

```bash
npx vitest run tests/express/task1.test.ts
```

Output looks like this:

```
PASS EXPRESS-001: POST /tasks > returns 201 and the new task
FAIL EXPRESS-001: POST /tasks > returns 400 when the priority is not low, medium or high
      priority "urgent" is invalid and must return 400.
      Expected status 400, got 500.
      Your code threw: Error: Not implemented: POST /tasks
      at tests/express/task1.test.ts:68

Final result: 1 passed, 1 failed.
```

Set `NO_COLOR=1` to disable colours.

## AI tasks

No AI task needs an API key, a paid service or network access:

- LLM calls go through small provider-agnostic interfaces (`LLMClient`, `ToolChatModel`, `Embedder`) that the tests replace with deterministic mocks.
- Provider HTTP APIs (Anthropic, OpenAI), Qdrant and fine-tuning providers are mocked at the interface or `fetch` level.
- LangChain/LangGraph tasks use the real libraries with a deterministic fake chat model and in-memory checkpointers.
- Tracing tasks use the real OpenTelemetry SDK with an in-memory exporter.
- Fine-tuning tasks are TypeScript engineering tasks around training (data preparation, loss masking, LoRA configuration, job orchestration and release gates); no model is trained locally.

## Ground rules

- Implement in `src/`; do not edit tests or the Prisma schema to make tests pass.
- Tests are independent of execution order and use isolated data.
- Track your progress in `PROGRESS.md`: change ⬜ to ✅ when a task passes.
