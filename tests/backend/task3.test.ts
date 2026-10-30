import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { migrate, migrations } from "../../src/backend/task3/task3";

let db: PGlite;

beforeEach(async () => {
  db = await PGlite.create();
});

const appliedIds = async () =>
  (await db.query<{ id: string }>("SELECT id FROM schema_migrations ORDER BY id")).rows.map((r) => r.id);

async function rejects(sql: string, params: unknown[] = []): Promise<boolean> {
  try {
    await db.query(sql, params);
    return false;
  } catch {
    return true;
  }
}

async function migrated() {
  await migrate(db);
  await db.query("INSERT INTO users (id, email) VALUES ('u1', 'ana@example.com')");
  await db.query("INSERT INTO conversations (id, user_id, title) VALUES ('c1', 'u1', 'Trip')");
}

describe("BACKEND-003", () => {
  describe("migrate", () => {
    it("applies all migrations on an empty database and returns their ids", async () => {
      const ids = await migrate(db);
      expect(ids, "migrate must return the ids it applied, in order").toEqual([
        "001_create_users",
        "002_create_conversations",
        "003_create_messages",
      ]);
      expect(await appliedIds(), "Every applied id must be recorded in schema_migrations").toEqual(ids);
    });

    it("applies nothing the second time", async () => {
      await migrate(db);
      const ids = await migrate(db);
      expect(ids, "A second run must return [] because everything is applied").toEqual([]);
      expect((await appliedIds()).length, "schema_migrations must still have 3 rows").toBe(3);
    });

    it("applies only new migrations and does not record a failed one", async () => {
      await migrate(db);
      const broken = { id: "004_add_notes", sql: "CREATE TABLE notes (id NO_SUCH_TYPE)" };
      let failed = false;
      try {
        await migrate(db, [...migrations, broken]);
      } catch {
        failed = true;
      }
      expect(failed, "migrate must reject when a migration's SQL fails").toBe(true);
      expect(await appliedIds(), "A failed migration must not be recorded (run it in a transaction)").not.toContain("004_add_notes");

      const fixed = { id: "004_add_notes", sql: "CREATE TABLE notes (id TEXT PRIMARY KEY)" };
      expect(await migrate(db, [...migrations, fixed]), "After the fix, only 004 must be applied").toEqual(["004_add_notes"]);
    });
  });

  describe("schema", () => {
    it("users: email is unique", async () => {
      await migrated();
      expect(await rejects("INSERT INTO users (id, email) VALUES ('u2', 'ana@example.com')"), "A duplicate email must be rejected").toBe(true);
    });

    it("conversations: user_id must reference an existing user", async () => {
      await migrated();
      expect(
        await rejects("INSERT INTO conversations (id, user_id, title) VALUES ('c2', 'nobody', 'X')"),
        "A conversation for an unknown user must be rejected (foreign key)",
      ).toBe(true);
    });

    it("messages: role must be 'user' or 'assistant'", async () => {
      await migrated();
      expect(
        await rejects("INSERT INTO messages (id, conversation_id, role, content) VALUES ('m1', 'c1', 'user', 'Hi')"),
        "A message with role 'user' must be accepted",
      ).toBe(false);
      expect(
        await rejects("INSERT INTO messages (id, conversation_id, role, content) VALUES ('m2', 'c1', 'system', 'Hi')"),
        "A message with role 'system' must be rejected (CHECK)",
      ).toBe(true);
    });

    it("deleting a user deletes their conversations and messages", async () => {
      await migrated();
      await db.query("INSERT INTO messages (id, conversation_id, role, content) VALUES ('m1', 'c1', 'user', 'Hi')");
      await db.query("DELETE FROM users WHERE id = 'u1'");
      const left = await db.query<{ n: number }>("SELECT (SELECT count(*) FROM conversations) + (SELECT count(*) FROM messages) AS n");
      expect(Number(left.rows[0]?.n), "Conversations and messages must be deleted with the user (ON DELETE CASCADE)").toBe(0);
    });
  });
});
