/**
 * BACKEND-004: Conversation Repository
 * Specification: ./task4.md (in this folder)
 * Run the tests: npm run test:backend:4
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import { randomUUID } from "node:crypto";
import type { SqlDatabase } from "../shared";

export type Role = "user" | "assistant";

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: Date;
}

export interface ConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  /** null when the conversation has no messages. */
  lastMessageAt: Date | null;
}

export function createConversationRepository(db: SqlDatabase) {
  // Query with parameters: await db.query<RowType>("SELECT ... WHERE id = $1", [id]) -> { rows }
  // New id: randomUUID()
  void db;
  void randomUUID;

  return {
    async createConversation(_userId: string, _title: string): Promise<Conversation> {
      throw new Error("Not implemented: createConversation");
    },

    async addMessage(_conversationId: string, _role: Role, _content: string): Promise<Message> {
      throw new Error("Not implemented: addMessage");
    },

    async listMessages(_conversationId: string): Promise<Message[]> {
      throw new Error("Not implemented: listMessages");
    },

    async listConversations(_userId: string): Promise<ConversationSummary[]> {
      throw new Error("Not implemented: listConversations");
    },
  };
}
