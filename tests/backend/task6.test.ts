import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { saveExchange, type Exchange } from "../../src/backend/task6/task6";
import { createChatDb, insertConversation } from "../support/chat-db";

let db: PGlite;
const OLD = "2020-01-01T00:00:00.000Z";

beforeEach(async () => {
  db = await createChatDb();
  await insertConversation(db, "c1", "u1");
  await db.query("UPDATE conversations SET updated_at = $1 WHERE id = 'c1'", [OLD]);
});

const messages = async () =>
  (await db.query<{ role: string; content: string }>("SELECT role, content FROM messages WHERE conversation_id = 'c1' ORDER BY seq")).rows;

/** A valid exchange in another conversation, so the failure tests also need a working saveExchange. */
async function savesValidExchange() {
  await insertConversation(db, "c0", "u1");
  await saveExchange(db, { conversationId: "c0", userContent: "Works", assistantContent: "Yes" });
}
const updatedAt = async () =>
  (await db.query<{ updated_at: Date }>("SELECT updated_at FROM conversations WHERE id = 'c1'")).rows[0]!.updated_at.toISOString();

async function rejects(exchange: Exchange): Promise<boolean> {
  try {
    await saveExchange(db, exchange);
    return false;
  } catch {
    return true;
  }
}

describe("BACKEND-006", () => {
  describe("saveExchange", () => {
    it("saves the user message, then the assistant message", async () => {
      const result = await saveExchange(db, { conversationId: "c1", userContent: "Hi", assistantContent: "Hello!" });
      expect(await messages(), "Both messages must be saved, user first").toEqual([
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ]);
      expect(result.userMessage, "userMessage must be { id, role, content }").toMatchObject({ role: "user", content: "Hi" });
      expect(result.assistantMessage, "assistantMessage must be { id, role, content }").toMatchObject({ role: "assistant", content: "Hello!" });
      expect(typeof result.userMessage.id, "Each message needs an id").toBe("string");
    });

    it("updates the conversation's updated_at", async () => {
      await saveExchange(db, { conversationId: "c1", userContent: "Hi", assistantContent: "Hello!" });
      expect(await updatedAt(), "updated_at must be set to now()").not.toBe(OLD);
    });

    it("saves nothing when the assistant message fails", async () => {
      await savesValidExchange();
      const failed = await rejects({ conversationId: "c1", userContent: "Hi", assistantContent: null as unknown as string });
      expect(failed, "A null assistantContent violates NOT NULL, so saveExchange must reject").toBe(true);
      expect(await messages(), "The user message must be rolled back too (use one transaction and tx)").toEqual([]);
      expect(await updatedAt(), "updated_at must not change when the exchange fails").toBe(OLD);
    });

    it("saves nothing for an unknown conversation", async () => {
      await savesValidExchange();
      const failed = await rejects({ conversationId: "nope", userContent: "Hi", assistantContent: "Hello!" });
      expect(failed, "An unknown conversation must make saveExchange reject").toBe(true);
      const all = await db.query("SELECT 1 FROM messages WHERE conversation_id = 'nope'");
      expect(all.rows, "No message may be saved").toEqual([]);
    });
  });
});
