/**
 * RAG-004: Qdrant Vector Store Adapter with Hybrid Queries
 * Specification: ./task4.md (in this folder)
 * Run the tests: npm run test:rag:4
 *
 * Keep the exported types and signatures unchanged; the tests depend on them.
 */
import { createHash } from "node:crypto";
import type { QdrantClient } from "@qdrant/js-client-rest";
import { ValidationError } from "../../shared/errors";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

/** The subset of the official Qdrant client used by the adapter. */
export type QdrantLike = Pick<QdrantClient, "collectionExists" | "createCollection" | "createPayloadIndex" | "upsert" | "query" | "delete">;

export interface SparseVector {
  indices: number[];
  values: number[];
}

export interface QdrantChunk {
  chunkId: string;
  docId: string;
  tenantId: string;
  text: string;
  dense: number[];
  sparse: SparseVector;
  metadata?: Record<string, string>;
}

export interface HybridQdrantQuery {
  tenantId: string;
  dense: number[];
  sparse: SparseVector;
  limit: number;
  prefetchLimit?: number;
  docIds?: string[];
}

export interface QdrantHit {
  chunkId: string;
  docId: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

export const RESERVED_PAYLOAD_KEYS = ["chunkId", "docId", "tenantId", "text"] as const;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function toPointId(chunkId: string): string {
  // TODO: see the specification
  throw new Error("RAG-004 toPointId is not implemented yet");
}

export async function ensureCollection(client: QdrantLike, options: { name: string; denseSize: number }): Promise<{ created: boolean }> {
  // TODO: see the specification
  throw new Error("RAG-004 ensureCollection is not implemented yet");
}

export async function upsertChunks(
  client: QdrantLike,
  collection: string,
  chunks: QdrantChunk[],
  options: { denseSize: number; batchSize?: number },
): Promise<number> {
  // TODO: see the specification
  throw new Error("RAG-004 upsertChunks is not implemented yet");
}

export async function hybridQuery(client: QdrantLike, collection: string, query: HybridQdrantQuery): Promise<QdrantHit[]> {
  // TODO: see the specification
  throw new Error("RAG-004 hybridQuery is not implemented yet");
}

export async function deleteDocument(client: QdrantLike, collection: string, target: { tenantId: string; docId: string }): Promise<void> {
  // TODO: see the specification
  throw new Error("RAG-004 deleteDocument is not implemented yet");
}
