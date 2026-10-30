import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hybridSearch, type Reranker } from "../../src/rag/task3/task3";
import { createVectorDb, toVectorLiteral } from "../support/pglite";

let db: PGlite;

const ROWS: Array<[string, string, string, number[]]> = [
  ["acme", "d1", "invoice invoice invoice payment overdue", [1, 0, 0, 0]],
  ["acme", "d2", "payment methods and invoice copies", [0, 1, 0, 0]],
  ["acme", "d3", "reset password instructions", [0.9, 0.1, 0, 0]],
  ["acme", "d4", "shipping times for international orders", [0, 0, 1, 0]],
  ["globex", "x1", "invoice invoice invoice invoice invoice", [1, 0, 0, 0]],
];

const QUERY_VECTORS: Record<string, number[]> = {
  invoice: [1, 0, 0, 0],
  "the and of": [0, 0, 1, 0],
  "international shipping": [0, 0, 1, 0],
};

function makeEmbedder() {
  return { dimensions: 4, embed: vi.fn(async (texts: string[]) => texts.map((t) => QUERY_VECTORS[t] ?? [0, 0, 0, 1])) };
}

beforeEach(async () => {
  db = await createVectorDb();
  await db.exec(`CREATE TABLE kb_chunks (
    tenant_id text NOT NULL, id text NOT NULL, content text NOT NULL, embedding vector(4) NOT NULL,
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED, PRIMARY KEY (tenant_id, id))`);
  for (const [tenant, id, content, vec] of ROWS) {
    await db.query("INSERT INTO kb_chunks (tenant_id, id, content, embedding) VALUES ($1, $2, $3, $4::vector)", [tenant, id, content, toVectorLiteral(vec)]);
  }
});

afterEach(async () => {
  await db.close();
});

const rrf = (...ranks: Array<number | null>) => ranks.reduce<number>((s, r) => s + (r === null ? 0 : 1 / (60 + r)), 0);

describe("RAG-003", () => {
  describe("Retrieval and fusion", () => {
    it("fuses keyword and vector rankings with RRF", async () => {
      const embedder = makeEmbedder();
      const { results, reranked } = await hybridSearch(db, { embedder }, { tenantId: "acme", text: "invoice" });
      expect(reranked).toBe(false);
      expect(results.map((r) => [r.id, r.keywordRank, r.vectorRank, r.rerankScore])).toEqual([
        ["d1", 1, 1, null],
        ["d2", 2, 3, null],
        ["d3", null, 2, null],
        ["d4", null, 4, null],
      ]);
      expect(results[0]!.score).toBeCloseTo(rrf(1, 1), 12);
      expect(results[1]!.score).toBeCloseTo(rrf(2, 3), 12);
      expect(results[2]!.score).toBeCloseTo(rrf(2), 12);
      expect(results[3]!.content).toBe("shipping times for international orders");
      expect(embedder.embed).toHaveBeenCalledTimes(1);
      expect(embedder.embed).toHaveBeenCalledWith(["invoice"]);
    });

    it("never returns other tenants' rows", async () => {
      const { results } = await hybridSearch(db, { embedder: makeEmbedder() }, { tenantId: "acme", text: "invoice", k: 50, candidates: 50 });
      expect(results.map((r) => r.id)).not.toContain("x1");
      expect(results).toHaveLength(4);
    });

    it("limits each retriever to `candidates` results", async () => {
      const { results } = await hybridSearch(db, { embedder: makeEmbedder() }, { tenantId: "acme", text: "invoice", k: 2, candidates: 2 });
      expect(results.map((r) => r.id)).toEqual(["d1", "d2"]);
      const all = await hybridSearch(db, { embedder: makeEmbedder() }, { tenantId: "acme", text: "invoice", k: 5, candidates: 5 });
      expect(all.results).toHaveLength(4);
      const two = await hybridSearch(db, { embedder: makeEmbedder() }, { tenantId: "acme", text: "invoice", k: 2, candidates: 2 });
      expect(two.results.find((r) => r.id === "d2")!.vectorRank).toBeNull();
    });

    it("returns only vector results for a query without searchable terms", async () => {
      const { results } = await hybridSearch(db, { embedder: makeEmbedder() }, { tenantId: "acme", text: "the and of" });
      expect(results.every((r) => r.keywordRank === null)).toBe(true);
      expect(results[0]!.id).toBe("d4");
    });

    it("supports websearch syntax such as quoted phrases", async () => {
      const { results } = await hybridSearch(db, { embedder: makeEmbedder() }, { tenantId: "acme", text: '"international orders"', k: 1 });
      expect(results[0]).toMatchObject({ id: "d4", keywordRank: 1 });
    });

    it("applies weights and a custom rrfK", async () => {
      const vectorOnly = await hybridSearch(db, { embedder: makeEmbedder() }, { tenantId: "acme", text: "invoice", weights: { keyword: 0, vector: 1 } });
      expect(vectorOnly.results.map((r) => r.id)).toEqual(["d1", "d3", "d2", "d4"]);

      const custom = await hybridSearch(db, { embedder: makeEmbedder() }, { tenantId: "acme", text: "invoice", rrfK: 1, weights: { keyword: 2, vector: 1 } });
      expect(custom.results[1]!.id).toBe("d2");
      expect(custom.results[1]!.score).toBeCloseTo(2 / 3 + 1 / 4, 12);
    });

    it("breaks fused score ties by id", async () => {
      await db.query("INSERT INTO kb_chunks (tenant_id, id, content, embedding) VALUES ('acme', 'd0', 'unrelated words', $1::vector)", ["[0,0,1,0]"]);
      const { results } = await hybridSearch(db, { embedder: makeEmbedder() }, { tenantId: "acme", text: "international shipping", k: 10, weights: { keyword: 0, vector: 1 } });
      // d0 and d4 have identical embeddings, so their vector ranks are decided by id.
      expect(results.slice(0, 2).map((r) => r.id)).toEqual(["d0", "d4"]);
    });

    it("is safe against SQL injection", async () => {
      const { results } = await hybridSearch(db, { embedder: makeEmbedder() }, { tenantId: "acme' OR '1'='1", text: "invoice'); DROP TABLE kb_chunks; --" });
      expect(results).toEqual([]);
      expect((await db.query("SELECT count(*)::int AS n FROM kb_chunks")).rows[0]).toEqual({ n: 5 });
    });
  });

  describe("Reranking", () => {
    const reverseReranker = (): Reranker & { rerank: ReturnType<typeof vi.fn> } => ({
      rerank: vi.fn(async (_q: string, docs: Array<{ id: string; content: string }>) => docs.map((d, i) => ({ id: d.id, score: i }))),
    });

    it("reranks the top candidates with a single call", async () => {
      const reranker = reverseReranker();
      const { results, reranked } = await hybridSearch(db, { embedder: makeEmbedder(), reranker }, { tenantId: "acme", text: "invoice", k: 2 });
      expect(reranked).toBe(true);
      expect(reranker.rerank).toHaveBeenCalledTimes(1);
      expect(reranker.rerank).toHaveBeenCalledWith("invoice", [
        { id: "d1", content: "invoice invoice invoice payment overdue" },
        { id: "d2", content: "payment methods and invoice copies" },
        { id: "d3", content: "reset password instructions" },
        { id: "d4", content: "shipping times for international orders" },
      ]);
      expect(results.map((r) => [r.id, r.rerankScore])).toEqual([
        ["d4", 3],
        ["d3", 2],
      ]);
      expect(results[0]!.score).toBeCloseTo(rrf(4), 12);
    });

    it("respects rerankTop", async () => {
      const reranker = reverseReranker();
      const { results } = await hybridSearch(db, { embedder: makeEmbedder(), reranker }, { tenantId: "acme", text: "invoice", k: 3, rerankTop: 2 });
      expect(reranker.rerank.mock.calls[0]![1].map((d: { id: string }) => d.id)).toEqual(["d1", "d2"]);
      expect(results.map((r) => r.id)).toEqual(["d2", "d1"]);
    });

    it("breaks rerank score ties by fused order", async () => {
      const reranker: Reranker = { rerank: async (_q, docs) => docs.map((d) => ({ id: d.id, score: 0.5 })).reverse() };
      const { results } = await hybridSearch(db, { embedder: makeEmbedder(), reranker }, { tenantId: "acme", text: "invoice" });
      expect(results.map((r) => r.id)).toEqual(["d1", "d2", "d3", "d4"]);
    });

    it.each([
      ["throws", async () => Promise.reject(new Error("reranker timeout"))],
      ["omits an id", async (_q: string, docs: Array<{ id: string }>) => docs.slice(1).map((d) => ({ id: d.id, score: 1 }))],
      ["returns an unknown id", async (_q: string, docs: Array<{ id: string }>) => [...docs.slice(1).map((d) => ({ id: d.id, score: 1 })), { id: "zzz", score: 9 }]],
      ["duplicates an id", async (_q: string, docs: Array<{ id: string }>) => [...docs.map((d) => ({ id: d.id, score: 1 })), { id: docs[0]!.id, score: 2 }]],
      ["returns a non-finite score", async (_q: string, docs: Array<{ id: string }>) => docs.map((d) => ({ id: d.id, score: Number.NaN }))],
    ])("falls back to the fused order when the reranker %s", async (_label, impl) => {
      const { results, reranked } = await hybridSearch(db, { embedder: makeEmbedder(), reranker: { rerank: impl as Reranker["rerank"] } }, { tenantId: "acme", text: "invoice" });
      expect(reranked).toBe(false);
      expect(results.map((r) => r.id)).toEqual(["d1", "d2", "d3", "d4"]);
      expect(results.every((r) => r.rerankScore === null)).toBe(true);
    });
  });
});
