/**
 * BACKEND-016: Ingestion Pipeline
 * Specification: ./task16.md (in this folder)
 * Run the tests: npm run test:backend:16
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import type { Embedder } from "../shared";

export interface DocumentRecord {
  id: string;
  userId: string;
  content: string;
  status: "pending" | "ready" | "failed";
  chunkCount?: number;
  error?: string;
}

export interface Chunk {
  /** `${documentId}:${index}` */
  id: string;
  documentId: string;
  userId: string;
  index: number;
  text: string;
  vector: number[];
}

export interface IngestionDeps {
  documents: Map<string, DocumentRecord>;
  /** All chunks of all documents. Add to it and remove from it in place. */
  chunks: Chunk[];
  embedder: Embedder;
}

export function splitIntoChunks(_content: string): string[] {
  throw new Error("Not implemented: splitIntoChunks");
}

export async function ingestDocument(_documentId: string, _deps: IngestionDeps): Promise<void> {
  // Embed many texts in one call: await deps.embedder.embed(["text 1", "text 2"]) -> [[...], [...]]
  throw new Error("Not implemented: ingestDocument");
}
