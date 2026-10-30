/**
 * BACKEND-003: Database Migrations
 * Specification: ./task3.md (in this folder)
 * Run the tests: npm run test:backend:3
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import type { SqlDatabase } from "../shared";

export interface Migration {
  /** Unique and sortable, e.g. "001_create_users". */
  id: string;
  /** Exactly one SQL statement. */
  sql: string;
}

export const migrations: Migration[] = [
  { id: "001_create_users", sql: "SELECT 'TODO: create the users table'" },
  { id: "002_create_conversations", sql: "SELECT 'TODO: create the conversations table'" },
  { id: "003_create_messages", sql: "SELECT 'TODO: create the messages table'" },
];

export async function migrate(_db: SqlDatabase, _list: Migration[] = migrations): Promise<string[]> {
  // Run a statement:            await db.query("SQL", [params])
  // Run several in a transaction: await db.transaction(async (tx) => { await tx.query(...); ... })
  throw new Error("Not implemented: migrate");
}
