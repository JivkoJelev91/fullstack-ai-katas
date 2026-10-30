/**
 * RAG-001: Structure-Aware Document Chunking
 * Specification: ./task1.md (in this folder)
 * Run the tests: npm run test:rag:1
 *
 * Keep the exported types and signature unchanged; the tests depend on them.
 */

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface SourceDocument {
  id: string;
  text: string;
  format: "markdown" | "text";
  metadata?: Record<string, string>;
}

export interface ChunkOptions {
  maxChars: number;
  overlapChars: number;
}

export interface Chunk {
  /** `<docId>#<index>` */
  id: string;
  docId: string;
  index: number;
  text: string;
  /** Inclusive start offset into the document text. */
  start: number;
  /** Exclusive end offset into the document text. */
  end: number;
  headingPath: string[];
  metadata: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function chunkDocument(document: SourceDocument, options: ChunkOptions): Chunk[] {
  // TODO: sections and heading paths
  // TODO: splitting and overlap
  // TODO: output
  throw new Error("RAG-001 chunkDocument is not implemented yet");
}
