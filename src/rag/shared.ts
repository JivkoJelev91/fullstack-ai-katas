/**
 * Shared contracts for the RAG tasks.
 */

/** Minimal SQL client interface. PGlite and other PostgreSQL clients can satisfy it. */
export interface SqlExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface SqlDatabase extends SqlExecutor {
  /** Runs `fn` inside a transaction; commits if it resolves, rolls back if it rejects. */
  transaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

/** Turns texts into embedding vectors. */
export interface Embedder {
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}
