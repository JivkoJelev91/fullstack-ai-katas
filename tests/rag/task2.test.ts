import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmbeddingError, ingestDocuments, migrate, searchChunks, type IngestDocument } from "../../src/rag/task2/task2";
import { ValidationError } from "../../src/shared/errors";
import { expectRejects } from "../support/expect-rejects";
import { cosine, keywordEmbedder } from "../support/fake-embedder";
import { createVectorDb } from "../support/pglite";

const TOPICS = [["refund", "money", "charge"], ["ship", "deliver", "express"], ["account", "password", "login"], ["misc"]];

let db: PGlite;
let embedder: ReturnType<typeof keywordEmbedder>;

beforeEach(async () => {
  db = await createVectorDb();
  embedder = keywordEmbedder(TOPICS);
});

afterEach(async () => {
  await db.close();
});

const docs = (): IngestDocument[] => [
  { id: "refunds", title: "Refund policy", chunks: [{ text: "Refunds are issued within 14 days.", metadata: { lang: "en" } }] },
  { id: "shipping", title: "Shipping", chunks: [{ text: "We ship worldwide." }, { text: "Express delivery takes 2 days." }] },
];

async function chunkRows(tenant = "acme") {
  return (
    await db.query<{ id: string; document_id: string; chunk_index: number; content: string; metadata: unknown; embedding: string }>(
      "SELECT id, document_id, chunk_index, content, metadata, embedding::text AS embedding FROM rag_chunks WHERE tenant_id = $1 ORDER BY id",
      [tenant],
    )
  ).rows;
}

async function docRows(tenant = "acme") {
  return (await db.query<{ id: string; title: string; content_hash: string; updated_at: Date }>("SELECT id, title, content_hash, updated_at FROM rag_documents WHERE tenant_id = $1 ORDER BY id", [tenant])).rows;
}

const parseVector = (text: string) => JSON.parse(text) as number[];

describe("RAG-002", () => {
  describe("migrate", () => {
    it("creates the documented tables and columns", async () => {
      await migrate(db, { dimensions: 4 });
      const columns = await db.query<{ table_name: string; column_name: string; data_type: string; is_nullable: string }>(
        "SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name IN ('rag_documents','rag_chunks') ORDER BY table_name, column_name",
      );
      const map = Object.fromEntries(columns.rows.map((c) => [`${c.table_name}.${c.column_name}`, c.is_nullable]));
      expect(Object.keys(map).sort()).toEqual(
        [
          "rag_chunks.chunk_index", "rag_chunks.content", "rag_chunks.document_id", "rag_chunks.embedding", "rag_chunks.id", "rag_chunks.metadata", "rag_chunks.tenant_id",
          "rag_documents.content_hash", "rag_documents.id", "rag_documents.tenant_id", "rag_documents.title", "rag_documents.updated_at",
        ].sort(),
      );
      expect(Object.values(map).every((nullable) => nullable === "NO")).toBe(true);
      const type = await db.query<{ t: string }>(
        "SELECT format_type(atttypid, atttypmod) AS t FROM pg_attribute WHERE attrelid = 'rag_chunks'::regclass AND attname = 'embedding'",
      );
      expect(type.rows[0]!.t).toBe("vector(4)");
    });

    it("creates a cosine HNSW index and can run repeatedly", async () => {
      await migrate(db, { dimensions: 4 });
      await migrate(db, { dimensions: 4 });
      const idx = await db.query<{ indexdef: string }>("SELECT indexdef FROM pg_indexes WHERE tablename = 'rag_chunks'");
      expect(idx.rows.some((r) => /using hnsw/i.test(r.indexdef) && /vector_cosine_ops/.test(r.indexdef))).toBe(true);
    });

    it("enforces the primary and foreign keys", async () => {
      await migrate(db, { dimensions: 4 });
      await expect(
        db.query("INSERT INTO rag_chunks (tenant_id, id, document_id, chunk_index, content, embedding) VALUES ('t','x#0','x',0,'c','[1,0,0,0]')"),
      ).rejects.toThrow();
      await db.query("INSERT INTO rag_documents (tenant_id, id, title, content_hash) VALUES ('t','x','X','h')");
      await db.query("INSERT INTO rag_chunks (tenant_id, id, document_id, chunk_index, content, embedding) VALUES ('t','x#0','x',0,'c','[1,0,0,0]')");
      await db.query("DELETE FROM rag_documents WHERE tenant_id = 't' AND id = 'x'");
      expect((await db.query("SELECT * FROM rag_chunks")).rows).toHaveLength(0);
    });
  });

  describe("ingestDocuments", () => {
    beforeEach(async () => {
      await migrate(db, { dimensions: 4 });
    });

    it("adds new documents with their chunks, metadata and embeddings", async () => {
      const report = await ingestDocuments(db, embedder, docs(), { tenantId: "acme", batchSize: 2 });
      expect(report).toEqual({ added: ["refunds", "shipping"], updated: [], unchanged: [], deleted: [], chunksWritten: 3, embeddingCalls: 2 });

      const rows = await chunkRows();
      expect(rows.map((r) => [r.id, r.document_id, r.chunk_index, r.content])).toEqual([
        ["refunds#0", "refunds", 0, "Refunds are issued within 14 days."],
        ["shipping#0", "shipping", 0, "We ship worldwide."],
        ["shipping#1", "shipping", 1, "Express delivery takes 2 days."],
      ]);
      expect(rows[0]!.metadata).toEqual({ lang: "en" });
      expect(rows[1]!.metadata).toEqual({});
      expect(parseVector(rows[2]!.embedding)).toEqual(embedder.vectorFor("Express delivery takes 2 days."));

      const documents = await docRows();
      expect(documents.map((d) => d.title)).toEqual(["Refund policy", "Shipping"]);
      expect(documents.every((d) => /^[0-9a-f]{64}$/.test(d.content_hash))).toBe(true);
    });

    it("embeds in batches across documents in document and chunk order", async () => {
      const many: IngestDocument[] = [
        { id: "a", title: "A", chunks: [{ text: "a0" }, { text: "a1" }, { text: "a2" }] },
        { id: "b", title: "B", chunks: [{ text: "b0" }, { text: "b1" }] },
      ];
      const report = await ingestDocuments(db, embedder, many, { tenantId: "acme", batchSize: 2 });
      expect(embedder.embed.mock.calls.map(([texts]) => texts)).toEqual([["a0", "a1"], ["a2", "b0"], ["b1"]]);
      expect(report.embeddingCalls).toBe(3);
    });

    it("uses a default batch size of 16", async () => {
      const big: IngestDocument[] = [{ id: "big", title: "Big", chunks: Array.from({ length: 20 }, (_, i) => ({ text: `chunk ${i}` })) }];
      await ingestDocuments(db, embedder, big, { tenantId: "acme" });
      expect(embedder.embed.mock.calls.map(([texts]) => texts.length)).toEqual([16, 4]);
    });

    it("skips unchanged documents without embedding or rewriting them", async () => {
      await ingestDocuments(db, embedder, docs(), { tenantId: "acme" });
      const before = await docRows();
      embedder.embed.mockClear();
      await new Promise((r) => setTimeout(r, 5));

      const report = await ingestDocuments(db, embedder, docs(), { tenantId: "acme" });
      expect(report).toEqual({ added: [], updated: [], unchanged: ["refunds", "shipping"], deleted: [], chunksWritten: 0, embeddingCalls: 0 });
      expect(embedder.embed).not.toHaveBeenCalled();
      expect(await docRows()).toEqual(before);
    });

    it("replaces all chunks of an updated document and leaves no stale chunks", async () => {
      await ingestDocuments(db, embedder, docs(), { tenantId: "acme" });
      const before = (await docRows()).find((d) => d.id === "shipping")!;
      await new Promise((r) => setTimeout(r, 5));
      embedder.embed.mockClear();

      const changed = docs();
      changed[1] = { id: "shipping", title: "Shipping (2026)", chunks: [{ text: "We ship to 40 countries." }] };
      const report = await ingestDocuments(db, embedder, changed, { tenantId: "acme" });

      expect(report).toMatchObject({ added: [], updated: ["shipping"], unchanged: ["refunds"], chunksWritten: 1, embeddingCalls: 1 });
      expect(embedder.embed.mock.calls[0]![0]).toEqual(["We ship to 40 countries."]);
      expect((await chunkRows()).map((r) => r.id)).toEqual(["refunds#0", "shipping#0"]);
      const after = (await docRows()).find((d) => d.id === "shipping")!;
      expect(after.title).toBe("Shipping (2026)");
      expect(after.content_hash).not.toBe(before.content_hash);
      expect(new Date(after.updated_at).getTime()).toBeGreaterThan(new Date(before.updated_at).getTime());
    });

    it("treats a metadata change as an update", async () => {
      await ingestDocuments(db, embedder, docs(), { tenantId: "acme" });
      const changed = docs();
      changed[0]!.chunks[0]!.metadata = { lang: "de" };
      expect((await ingestDocuments(db, embedder, changed, { tenantId: "acme" })).updated).toEqual(["refunds"]);
      expect((await chunkRows())[0]!.metadata).toEqual({ lang: "de" });
    });

    it("deletes missing documents only when requested", async () => {
      await ingestDocuments(db, embedder, [...docs(), { id: "old", title: "Old", chunks: [{ text: "outdated" }] }], { tenantId: "acme" });
      expect((await ingestDocuments(db, embedder, docs(), { tenantId: "acme" })).deleted).toEqual([]);
      expect((await docRows()).map((d) => d.id)).toContain("old");

      const report = await ingestDocuments(db, embedder, docs().slice(0, 1), { tenantId: "acme", deleteMissing: true });
      expect(report.deleted).toEqual(["old", "shipping"]);
      expect((await docRows()).map((d) => d.id)).toEqual(["refunds"]);
      expect((await chunkRows()).map((r) => r.id)).toEqual(["refunds#0"]);
    });

    it("isolates tenants", async () => {
      await ingestDocuments(db, embedder, docs(), { tenantId: "acme" });
      const report = await ingestDocuments(db, embedder, docs(), { tenantId: "globex", deleteMissing: true });
      expect(report.added).toEqual(["refunds", "shipping"]);
      await ingestDocuments(db, embedder, [], { tenantId: "globex", deleteMissing: true });
      expect(await docRows("globex")).toEqual([]);
      expect((await docRows("acme")).map((d) => d.id)).toEqual(["refunds", "shipping"]);
    });

    it.each([
      ["an empty tenant id", docs(), { tenantId: "" }],
      ["duplicate document ids", [docs()[0]!, docs()[0]!], { tenantId: "acme" }],
      ["an empty document id", [{ ...docs()[0]!, id: "" }], { tenantId: "acme" }],
      ["a document without chunks", [{ id: "x", title: "X", chunks: [] }], { tenantId: "acme" }],
      ["a blank chunk", [{ id: "x", title: "X", chunks: [{ text: "  " }] }], { tenantId: "acme" }],
      ["batchSize 0", docs(), { tenantId: "acme", batchSize: 0 }],
      ["batchSize 257", docs(), { tenantId: "acme", batchSize: 257 }],
    ])("rejects %s before embedding or writing", async (_label, documents, options) => {
      await expectRejects(ingestDocuments(db, embedder, documents as IngestDocument[], options), ValidationError);
      expect(embedder.embed).not.toHaveBeenCalled();
      expect(await docRows()).toEqual([]);
    });

    it.each([
      ["too few vectors", async (texts: string[]) => texts.slice(1).map(() => [1, 0, 0, 0])],
      ["wrong dimensions", async (texts: string[]) => texts.map(() => [1, 0, 0])],
      ["non-finite values", async (texts: string[]) => texts.map(() => [1, Number.NaN, 0, 0])],
    ])("throws EmbeddingError for %s and writes nothing", async (_label, impl) => {
      embedder.embed.mockImplementation(impl);
      await expectRejects(ingestDocuments(db, embedder, docs(), { tenantId: "acme" }), EmbeddingError);
      expect(await docRows()).toEqual([]);
      expect(await chunkRows()).toEqual([]);
    });

    it("leaves existing data untouched when a later batch fails", async () => {
      await ingestDocuments(db, embedder, docs(), { tenantId: "acme" });
      const before = { docs: await docRows(), chunks: await chunkRows() };
      const changed: IngestDocument[] = [
        { id: "refunds", title: "Refund policy v2", chunks: [{ text: "Refunds within 7 days." }] },
        { id: "new", title: "New", chunks: [{ text: "new content" }] },
      ];
      embedder.embed.mockImplementationOnce(async (t) => t.map(() => [1, 0, 0, 0])).mockRejectedValueOnce(new Error("provider down"));
      await expect(ingestDocuments(db, embedder, changed, { tenantId: "acme", batchSize: 1, deleteMissing: true })).rejects.toThrow();
      expect({ docs: await docRows(), chunks: await chunkRows() }).toEqual(before);
    });
  });

  describe("searchChunks", () => {
    beforeEach(async () => {
      await migrate(db, { dimensions: 4 });
      await ingestDocuments(
        db,
        embedder,
        [
          { id: "refunds", title: "Refund policy", chunks: [{ text: "Refunds return your money within 14 days.", metadata: { lang: "en" } }, { text: "Rückerstattung refund", metadata: { lang: "de" } }] },
          { id: "shipping", title: "Shipping", chunks: [{ text: "We ship worldwide with express delivery.", metadata: { lang: "en" } }] },
          { id: "account", title: "Accounts", chunks: [{ text: "Reset your account password from the login page.", metadata: { lang: "en" } }] },
        ],
        { tenantId: "acme" },
      );
      await ingestDocuments(db, embedder, [{ id: "secret", title: "Other tenant", chunks: [{ text: "refund refund refund money" }] }], { tenantId: "globex" });
      embedder.embed.mockClear();
    });

    it("returns the closest chunks with cosine scores, titles and metadata", async () => {
      const results = await searchChunks(db, embedder, { tenantId: "acme", text: "refund my money", k: 2 });
      expect(results.map((r) => r.chunkId)).toEqual(["refunds#0", "refunds#1"]);
      expect(results[0]).toMatchObject({ documentId: "refunds", title: "Refund policy", content: "Refunds return your money within 14 days.", metadata: { lang: "en" } });
      const expected = cosine(embedder.vectorFor("refund my money"), embedder.vectorFor("Refunds return your money within 14 days."));
      expect(results[0]!.score).toBeCloseTo(expected, 5);
      expect(embedder.embed).toHaveBeenCalledTimes(1);
      expect(embedder.embed).toHaveBeenCalledWith(["refund my money"]);
    });

    it("orders by score and uses a default k of 5", async () => {
      const results = await searchChunks(db, embedder, { tenantId: "acme", text: "shipping express" });
      expect(results).toHaveLength(4);
      expect(results[0]!.chunkId).toBe("shipping#0");
      for (let i = 1; i < results.length; i++) expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score);
    });

    it("breaks score ties by chunk id", async () => {
      const results = await searchChunks(db, embedder, { tenantId: "acme", text: "misc", k: 5 });
      const scores = results.map((r) => r.score.toFixed(6));
      for (let i = 1; i < results.length; i++) {
        if (scores[i] === scores[i - 1]) expect(results[i - 1]!.chunkId < results[i]!.chunkId).toBe(true);
      }
    });

    it("applies minScore and metadata filters", async () => {
      const filtered = await searchChunks(db, embedder, { tenantId: "acme", text: "refund", k: 10, filter: { lang: "de" } });
      expect(filtered.map((r) => r.chunkId)).toEqual(["refunds#1"]);
      const strict = await searchChunks(db, embedder, { tenantId: "acme", text: "refund", k: 10, minScore: 0.9 });
      expect(strict.length).toBeGreaterThan(0);
      expect(strict.every((r) => r.score >= 0.9)).toBe(true);
      expect(strict.map((r) => r.documentId)).not.toContain("shipping");
    });

    it("never returns other tenants' chunks", async () => {
      const results = await searchChunks(db, embedder, { tenantId: "acme", text: "refund money", k: 50 });
      expect(results.map((r) => r.documentId)).not.toContain("secret");
      expect(await searchChunks(db, embedder, { tenantId: "nobody", text: "refund", k: 5 })).toEqual([]);
    });

    it("is safe against SQL injection in values", async () => {
      const results = await searchChunks(db, embedder, { tenantId: "acme' OR '1'='1", text: "refund", k: 5, filter: { "lang' OR '1'='1": "x" } });
      expect(results).toEqual([]);
      expect((await db.query("SELECT count(*)::int AS n FROM rag_chunks")).rows[0]).toEqual({ n: 5 });
    });
  });
});
