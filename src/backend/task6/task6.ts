/**
 * BACKEND-006: Transactions
 * Specification: ./task6.md (in this folder)
 * Run the tests: npm run test:backend:6
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import { randomUUID } from "node:crypto";
import type { SqlDatabase } from "../shared";

export interface SavedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface Exchange {
  conversationId: string;
  userContent: string;
  assistantContent: string;
}

export async function saveExchange(
  _db: SqlDatabase,
  _exchange: Exchange,
): Promise<{ userMessage: SavedMessage; assistantMessage: SavedMessage }> {
  // await db.transaction(async (tx) => { ... tx.query(...) ... })
  // New id: randomUUID()
  void randomUUID;
  throw new Error("Not implemented: saveExchange");
}
