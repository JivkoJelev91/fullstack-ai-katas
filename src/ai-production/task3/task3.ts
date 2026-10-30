/**
 * AIOPS-003: LLM Response Cache: Exact, Single-Flight and Semantic
 * Specification: ./task3.md (in this folder)
 * Run the tests: npm run test:aiops:3
 *
 * Keep the exported types and signatures unchanged; the tests depend on them.
 */
import { createHash } from "node:crypto";
import type { CompletionRequest, CompletionResponse, LLMClient } from "../../ai/shared/llm";
import type { Embedder } from "../../rag/shared";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface CacheEntry {
  response: CompletionResponse;
  storedAt: number;
  expiresAt: number;
}

export interface CacheStore {
  get(key: string): Promise<CacheEntry | undefined>;
  set(key: string, entry: CacheEntry): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CacheOptions {
  store: CacheStore;
  ttlMs: number;
  promptVersion: string;
  now?: () => number;
  semantic?: { embedder: Embedder; threshold: number; maxEntries: number };
}

export type CacheStatus = "hit" | "miss" | "bypass" | "semantic_hit";

export interface CachedResponse extends CompletionResponse {
  cache: CacheStatus;
}

export interface CacheContext {
  tenantId: string;
  mode?: "default" | "bypass" | "refresh";
}

export interface CachedClient {
  complete(request: CompletionRequest, ctx: CacheContext): Promise<CachedResponse>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function cacheKey(request: CompletionRequest, scope: { tenantId: string; promptVersion: string }): string {
  // TODO: see the specification
  throw new Error("AIOPS-003 cacheKey is not implemented yet");
}

export function createCachedClient(inner: LLMClient, options: CacheOptions): CachedClient {

  return {
    async complete(request, ctx) {
      // TODO: cacheability and modes
      // TODO: exact hits and misses
      // TODO: single-flight
      // TODO: semantic cache
      // TODO: defensive copies
      throw new Error("AIOPS-003 complete is not implemented yet");
    },
  };
}
