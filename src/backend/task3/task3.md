# Database Migrations

**Task ID:** BACKEND-003 · **Level:** 1–2 · **File:** `src/backend/task3/task3.ts` · **Tests:** `npm run test:backend:3`

A migration is one versioned change to the database schema. The app keeps a list of them, and a runner applies the ones the database doesn't have yet. That way every environment (your laptop, tests, production) gets the same schema.

You write two things: the SQL of the three migrations, and the `migrate` runner. The tests use PGlite, an in-memory PostgreSQL, so nothing needs to be installed.

## 1. The migrations

Each `sql` is **one** `CREATE TABLE` statement.

**users**

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `email` | `TEXT` | not null, unique |
| `created_at` | `TIMESTAMPTZ` | not null, default `now()` |

**conversations**

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `user_id` | `TEXT` | not null, references `users(id)`, deleted together with the user (`ON DELETE CASCADE`) |
| `title` | `TEXT` | not null |
| `created_at` | `TIMESTAMPTZ` | not null, default `now()` |

**messages**

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `TEXT` | primary key |
| `conversation_id` | `TEXT` | not null, references `conversations(id)`, `ON DELETE CASCADE` |
| `role` | `TEXT` | not null, only `'user'` or `'assistant'` (`CHECK`) |
| `content` | `TEXT` | not null |
| `created_at` | `TIMESTAMPTZ` | not null, default `now()` |

## 2. migrate(db, list = migrations)

**REQUIREMENT:**

1. Create the table `schema_migrations` if it doesn't exist: `id TEXT PRIMARY KEY`, `applied_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
2. Read which ids are already in `schema_migrations`.
3. For each migration in `list` that isn't applied yet, in list order: run its `sql` **and** insert its id into `schema_migrations`, both in **one transaction**. If the SQL fails, the transaction rolls back, so the id is not recorded, and `migrate` rejects with that error.
4. Return the ids applied in this run.

**Examples:**

| Call | Returns |
| --- | --- |
| `migrate(db)` on an empty database | `["001_create_users", "002_create_conversations", "003_create_messages"]` |
| `migrate(db)` again | `[]` (nothing new) |
| `migrate(db, [...migrations, { id: "004_add_x", sql: "..." }])` | `["004_add_x"]` |

## How to check your work

Run `npm run test:backend:3`. The tests check the constraints by inserting rows that must be rejected (a duplicate email, a conversation for an unknown user, a message with role `'system'`).

## Rules

- Edit only `task3.ts`.
