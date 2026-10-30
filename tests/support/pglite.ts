import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

/**
 * Creates a fresh in-memory PostgreSQL (PGlite) with the pgvector extension available.
 * Each call returns an isolated database, so tests never share state.
 */
export async function createVectorDb(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { vector } });
  await db.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  return db;
}

/** Formats a number array as a pgvector literal, e.g. "[1,0,0.5]". */
export const toVectorLiteral = (values: number[]) => `[${values.join(",")}]`;
