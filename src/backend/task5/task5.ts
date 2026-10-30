/**
 * BACKEND-005: Cursor Pagination
 * Specification: ./task5.md (in this folder)
 * Run the tests: npm run test:backend:5
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import type { SqlExecutor } from "../shared";

export interface Message {
  id: string;
  seq: number;
  role: "user" | "assistant";
  content: string;
}

export interface Page {
  items: Message[];
  /** Pass it back as `cursor` to get the next page. null when there are no more messages. */
  nextCursor: string | null;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;

export async function listMessagesPage(
  _db: SqlExecutor,
  _conversationId: string,
  _options: { limit?: number; cursor?: string | null } = {},
): Promise<Page> {
  throw new Error("Not implemented: listMessagesPage");
}
