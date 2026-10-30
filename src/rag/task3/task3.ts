/**
 * RAG-003: Hybrid Search with Reciprocal Rank Fusion and Reranking
 * Specification: ./task3.md (in this folder)
 * Run the tests: npm run test:rag:3
 *
 * Keep the exported types and signature unchanged; the tests depend on them.
 */
import { ValidationError } from "../../shared/errors";
import type { Embedder, SqlDatabase } from "../shared";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface Reranker {
  rerank(query: string, candidates: Array<{ id: string; content: string }>): Promise<Array<{ id: string; score: number }>>;
}

export interface HybridDeps {
  embedder: Embedder;
  reranker?: Reranker;
}

export interface HybridQuery {
  tenantId: string;
  text: string;
  k?: number;
  candidates?: number;
  rrfK?: number;
  weights?: { keyword: number; vector: number };
  rerankTop?: number;
}

export interface HybridResult {
  id: string;
  content: string;
  /** Fused RRF score. */
  score: number;
  keywordRank: number | null;
  vectorRank: number | null;
  rerankScore: number | null;
}

export interface HybridSearchResponse {
  results: HybridResult[];
  reranked: boolean;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export async function hybridSearch(db: SqlDatabase, deps: HybridDeps, query: HybridQuery): Promise<HybridSearchResponse> {
  // TODO: defaults
  // TODO: keyword and vector retrieval
  // TODO: reciprocal rank fusion
  // TODO: optional reranking with graceful fallback
  // TODO: result shape
  throw new Error("RAG-003 hybridSearch is not implemented yet");
}
