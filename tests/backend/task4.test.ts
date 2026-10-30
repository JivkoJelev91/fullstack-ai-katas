import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { createConversationRepository } from "../../src/backend/task4/task4";
import { createChatDb } from "../support/chat-db";

let db: PGlite;
let repo: ReturnType<typeof createConversationRepository>;

beforeEach(async () => {
  db = await createChatDb();
  repo = createConversationRepository(db);
});

const pause = () => new Promise((resolve) => setTimeout(resolve, 5));

describe("BACKEND-004", () => {
  describe("createConversation", () => {
    it("inserts a conversation and returns it", async () => {
      const c = await repo.createConversation("u1", "Trip ideas");
      expect(typeof c.id, "id must be a string").toBe("string");
      expect(c.userId, "userId must be the given user").toBe("u1");
      expect(c.title, "title must be the given title").toBe("Trip ideas");
      expect(c.createdAt, "createdAt must be a Date (map created_at to createdAt)").toBeInstanceOf(Date);

      const row = await db.query("SELECT user_id, title FROM conversations WHERE id = $1", [c.id]);
      expect(row.rows, "The conversation must be saved in the database").toEqual([{ user_id: "u1", title: "Trip ideas" }]);
    });

    it("stores a title with a quote exactly (use query parameters)", async () => {
      const c = await repo.createConversation("u1", "Bob's plan");
      expect(c.title, "The title must be stored exactly").toBe("Bob's plan");
    });
  });

  describe("addMessage and listMessages", () => {
    it("returns the messages oldest first", async () => {
      const c = await repo.createConversation("u1", "Trip");
      const first = await repo.addMessage(c.id, "user", "Where should I go?");
      await repo.addMessage(c.id, "assistant", "Try Lisbon.");

      expect(first, "addMessage must return the message").toMatchObject({ conversationId: c.id, role: "user", content: "Where should I go?" });
      expect(first.createdAt, "createdAt must be a Date").toBeInstanceOf(Date);

      const messages = await repo.listMessages(c.id);
      expect(messages.map((m) => [m.role, m.content]), "Messages must be listed oldest first").toEqual([
        ["user", "Where should I go?"],
        ["assistant", "Try Lisbon."],
      ]);
    });

    it("lists only the messages of that conversation", async () => {
      const a = await repo.createConversation("u1", "A");
      const b = await repo.createConversation("u1", "B");
      await repo.addMessage(a.id, "user", "in A");
      await repo.addMessage(b.id, "user", "in B");
      expect((await repo.listMessages(a.id)).map((m) => m.content), "Only conversation A's messages").toEqual(["in A"]);
    });

    it("rejects a message for an unknown conversation", async () => {
      const c = await repo.createConversation("u1", "Trip");
      await repo.addMessage(c.id, "user", "This one works");
      let rejected = false;
      try {
        await repo.addMessage("no-such-conversation", "user", "Hi");
      } catch {
        rejected = true;
      }
      expect(rejected, "addMessage must reject when the conversation does not exist").toBe(true);
    });
  });

  describe("listConversations", () => {
    it("returns the user's conversations, newest first, with counts", async () => {
      const trip = await repo.createConversation("u1", "Trip");
      await repo.addMessage(trip.id, "user", "Hi");
      await repo.addMessage(trip.id, "assistant", "Hello");
      await pause();
      const empty = await repo.createConversation("u1", "Empty");
      await repo.createConversation("u2", "Not mine");

      const list = await repo.listConversations("u1");
      expect(
        list.map((c) => [c.id, c.title, c.messageCount]),
        "u1's conversations, newest first, with messageCount as a number",
      ).toEqual([
        [empty.id, "Empty", 0],
        [trip.id, "Trip", 2],
      ]);
      expect(list[0]?.lastMessageAt, "lastMessageAt must be null without messages").toBeNull();
      expect(list[1]?.lastMessageAt, "lastMessageAt must be a Date with messages").toBeInstanceOf(Date);
    });
  });
});
