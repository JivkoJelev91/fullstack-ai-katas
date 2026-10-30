import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { listMessagesPage } from "../../src/backend/task5/task5";
import { createChatDb, insertConversation, insertMessages } from "../support/chat-db";

let db: PGlite;

beforeEach(async () => {
  db = await createChatDb();
  await insertConversation(db, "c1", "u1");
  await insertConversation(db, "c2", "u1");
  await insertMessages(db, "c1", ["one", "two", "three", "four", "five"]);
  await insertMessages(db, "c2", ["other"]);
});

const contents = (page: { items: { content: string }[] }) => page.items.map((m) => m.content);

describe("BACKEND-005", () => {
  describe("listMessagesPage", () => {
    it("returns the first page and a cursor", async () => {
      const page = await listMessagesPage(db, "c1", { limit: 2 });
      expect(contents(page), "The first page must hold the 2 oldest messages").toEqual(["one", "two"]);
      expect(typeof page.nextCursor, "nextCursor must be a string when more messages exist").toBe("string");
      expect(page.items[0], "Each item must be { id, seq, role, content }").toEqual({ id: "c1-m1", seq: page.items[0]?.seq, role: "user", content: "one" });
    });

    it("walks through all pages with the cursor, without gaps or repeats", async () => {
      const seen: string[] = [];
      let cursor: string | null = null;
      for (let i = 0; i < 5; i++) {
        const page = await listMessagesPage(db, "c1", { limit: 2, cursor });
        seen.push(...contents(page));
        cursor = page.nextCursor;
        if (cursor === null) break;
      }
      expect(seen, "Following nextCursor must return every message once, in order").toEqual(["one", "two", "three", "four", "five"]);
      expect(cursor, "The last page must have nextCursor null").toBeNull();
    });

    it("returns nextCursor null when the last page is exactly full", async () => {
      await db.query("DELETE FROM messages WHERE id = 'c1-m5'");
      const first = await listMessagesPage(db, "c1", { limit: 2 });
      const second = await listMessagesPage(db, "c1", { limit: 2, cursor: first.nextCursor });
      expect(contents(second), "The second page must hold three and four").toEqual(["three", "four"]);
      expect(second.nextCursor, "Nothing comes after four, so nextCursor must be null (fetch limit + 1 rows to know)").toBeNull();
    });

    it("uses limit 20 by default", async () => {
      const page = await listMessagesPage(db, "c1");
      expect(contents(page), "Without a limit, all 5 messages fit in one page").toEqual(["one", "two", "three", "four", "five"]);
      expect(page.nextCursor, "Everything fit, so nextCursor must be null").toBeNull();
    });

    it("never returns more than 50 messages", async () => {
      await db.query(
        "INSERT INTO messages (id, conversation_id, role, content) SELECT 'big-' || i, 'c1', 'user', 'm' || i FROM generate_series(1, 60) AS i",
      );
      const page = await listMessagesPage(db, "c1", { limit: 1000 });
      expect(page.items.length, "limit 1000 must be treated as 50").toBe(50);
    });

    it("returns only that conversation's messages", async () => {
      const page = await listMessagesPage(db, "c2");
      expect(contents(page), "c2 has only one message").toEqual(["other"]);
    });

    it("returns an empty page for a conversation without messages", async () => {
      await insertConversation(db, "c3", "u1");
      const page = await listMessagesPage(db, "c3");
      expect(page, "An empty conversation gives { items: [], nextCursor: null }").toEqual({ items: [], nextCursor: null });
    });
  });
});
