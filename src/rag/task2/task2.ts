/**
 * RAG-002: Incremental Ingestion and Semantic Search with pgvector
 * Specification: ./task2.md (in this folder)
 * Run the tests: npm run test:rag:2
 *
 * Keep the exported types, class and signatures unchanged; the tests depend on them.
 */
import { createHash } from "node:crypto";
import { ValidationError } from "../../shared/errors";
import type { Embedder, SqlDatabase } from "../shared";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export type { Embedder, SqlDatabase };

export interface IngestChunk {
  text: string;
  metadata?: Record<string, string>;
}

export interface IngestDocument {
  id: string;
  title: string;
  chunks: IngestChunk[];
}

export interface IngestOptions {
  tenantId: string;
  batchSize?: number;
  deleteMissing?: boolean;
}

export interface IngestReport {
  added: string[];
  updated: string[];
  unchanged: string[];
  deleted: string[];
  chunksWritten: number;
  embeddingCalls: number;
}

export interface SearchQuery {
  tenantId: string;
  text: string;
  k?: number;
  minScore?: number;
  filter?: Record<string, string>;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  title: string;
  content: string;
  metadata: Record<string, string>;
  score: number;
}

export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingError";
  }
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function migrate(db: SqlDatabase, options: { dimensions: number }): Promise<void> {
  // TODO: see the specification
  throw new Error("RAG-002 migrate is not implemented yet");
}

export async function ingestDocuments(
  db: SqlDatabase,
  embedder: Embedder,
  documents: IngestDocument[],
  options: IngestOptions,
): Promise<IngestReport> {
  // TODO: validation
  // TODO: hashing and classification
  // TODO: batched embeddings
  // TODO: transactional writes
  // TODO: report
  throw new Error("RAG-002 ingestDocuments is not implemented yet");
}

export async function searchChunks(db: SqlDatabase, embedder: Embedder, query: SearchQuery): Promise<SearchResult[]> {
  // TODO: see the specification
  throw new Error("RAG-002 searchChunks is not implemented yet");
}
