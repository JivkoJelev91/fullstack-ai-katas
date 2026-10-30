import { PGlite } from "@electric-sql/pglite";
import { CHAT_SCHEMA } from "../../src/backend/shared";

/** A fresh in-memory PostgreSQL with the chat schema and users u1 and u2. */
export async function createChatDb(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(CHAT_SCHEMA);
  await db.query("INSERT INTO users (id, email) VALUES ('u1', 'ana@example.com'), ('u2', 'bob@example.com')");
  return db;
}

/** Inserts a conversation directly with SQL. */
export async function insertConversation(db: PGlite, id: string, userId: string, title = `Conversation ${id}`) {
  await db.query("INSERT INTO conversations (id, user_id, title) VALUES ($1, $2, $3)", [id, userId, title]);
}

/** Inserts messages directly with SQL, in the given order. */
export async function insertMessages(db: PGlite, conversationId: string, contents: string[]) {
  for (const [i, content] of contents.entries()) {
    await db.query("INSERT INTO messages (id, conversation_id, role, content) VALUES ($1, $2, $3, $4)", [
      `${conversationId}-m${i + 1}`,
      conversationId,
      i % 2 === 0 ? "user" : "assistant",
      content,
    ]);
  }
}
