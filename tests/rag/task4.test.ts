import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  deleteDocument,
  ensureCollection,
  hybridQuery,
  toPointId,
  upsertChunks,
  type QdrantChunk,
  type QdrantLike,
} from "../../src/rag/task4/task4";
import { ValidationError } from "../../src/shared/errors";
import { expectRejects } from "../support/expect-rejects";

type Point = { id: string; score: number; payload?: Record<string, unknown> | null };

function fakeQdrant(options: { exists?: boolean; points?: Point[] } = {}) {
  const fake = {
    collectionExists: vi.fn(async (_name: string) => ({ exists: options.exists ?? false })),
    createCollection: vi.fn(async (_name: string, _body: unknown) => true),
    createPayloadIndex: vi.fn(async (_name: string, _body: unknown) => ({ operation_id: 1, status: "completed" })),
    upsert: vi.fn(async (_name: string, _body: unknown) => ({ operation_id: 1, status: "completed" })),
    query: vi.fn(async (_name: string, _body: unknown) => ({ points: options.points ?? [] })),
    delete: vi.fn(async (_name: string, _body: unknown) => ({ operation_id: 1, status: "completed" })),
  };
  return { fake, client: fake as unknown as QdrantLike };
}

const chunk = (overrides: Partial<QdrantChunk> = {}): QdrantChunk => ({
  chunkId: "refunds#0",
  docId: "refunds",
  tenantId: "acme",
  text: "Refunds take 14 days.",
  dense: [0.1, 0.2, 0.3],
  sparse: { indices: [42, 7], values: [0.5, 1.2] },
  metadata: { lang: "en" },
  ...overrides,
});

const tenantFilter = { must: [{ key: "tenantId", match: { value: "acme" } }] };

describe("RAG-004", () => {
  describe("toPointId", () => {
    it("formats the first 32 hex characters of the SHA-256 digest as a UUID", () => {
      const hex = createHash("sha256").update("refunds#0").digest("hex").slice(0, 32);
      const expected = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      expect(toPointId("refunds#0")).toBe(expected);
      expect(toPointId("refunds#0")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("is deterministic and distinguishes chunk ids", () => {
      expect(toPointId("a#1")).toBe(toPointId("a#1"));
      expect(new Set(["a#0", "a#1", "b#0", "A#0"].map(toPointId)).size).toBe(4);
    });
  });

  describe("ensureCollection", () => {
    it("creates the collection with dense and sparse vectors and keyword indexes", async () => {
      const { fake, client } = fakeQdrant();
      expect(await ensureCollection(client, { name: "kb", denseSize: 768 })).toEqual({ created: true });
      expect(fake.collectionExists).toHaveBeenCalledWith("kb");
      expect(fake.createCollection).toHaveBeenCalledWith("kb", {
        vectors: { dense: { size: 768, distance: "Cosine" } },
        sparse_vectors: { sparse: {} },
      });
      expect(fake.createPayloadIndex.mock.calls).toEqual([
        ["kb", { field_name: "tenantId", field_schema: "keyword", wait: true }],
        ["kb", { field_name: "docId", field_schema: "keyword", wait: true }],
      ]);
      expect(fake.createCollection.mock.invocationCallOrder[0]!).toBeLessThan(fake.createPayloadIndex.mock.invocationCallOrder[0]!);
    });

    it("does nothing when the collection exists", async () => {
      const { fake, client } = fakeQdrant({ exists: true });
      expect(await ensureCollection(client, { name: "kb", denseSize: 768 })).toEqual({ created: false });
      expect(fake.createCollection).not.toHaveBeenCalled();
      expect(fake.createPayloadIndex).not.toHaveBeenCalled();
    });
  });

  describe("upsertChunks", () => {
    it("upserts points with deterministic ids, sorted sparse vectors and payload", async () => {
      const { fake, client } = fakeQdrant();
      expect(await upsertChunks(client, "kb", [chunk()], { denseSize: 3 })).toBe(1);
      expect(fake.upsert).toHaveBeenCalledWith("kb", {
        wait: true,
        points: [
          {
            id: toPointId("refunds#0"),
            vector: { dense: [0.1, 0.2, 0.3], sparse: { indices: [7, 42], values: [1.2, 0.5] } },
            payload: { lang: "en", chunkId: "refunds#0", docId: "refunds", tenantId: "acme", text: "Refunds take 14 days." },
          },
        ],
      });
    });

    it("batches points in input order with a default batch size of 64", async () => {
      const { fake, client } = fakeQdrant();
      const many = Array.from({ length: 130 }, (_, i) => chunk({ chunkId: `doc#${i}`, metadata: undefined }));
      expect(await upsertChunks(client, "kb", many, { denseSize: 3 })).toBe(130);
      const sizes = fake.upsert.mock.calls.map(([, body]) => (body as { points: unknown[] }).points.length);
      expect(sizes).toEqual([64, 64, 2]);
      const ids = fake.upsert.mock.calls.flatMap(([, body]) => (body as { points: Array<{ id: string }> }).points.map((p) => p.id));
      expect(ids).toEqual(many.map((c) => toPointId(c.chunkId)));
      const first = (fake.upsert.mock.calls[0]![1] as { points: Array<{ payload: object }> }).points[0]!.payload;
      expect(first).toEqual({ chunkId: "doc#0", docId: "refunds", tenantId: "acme", text: "Refunds take 14 days." });
    });

    it("uses a custom batch size", async () => {
      const { fake, client } = fakeQdrant();
      await upsertChunks(client, "kb", Array.from({ length: 5 }, (_, i) => chunk({ chunkId: `c#${i}` })), { denseSize: 3, batchSize: 2 });
      expect(fake.upsert).toHaveBeenCalledTimes(3);
    });

    it.each<[string, Partial<QdrantChunk>]>([
      ["an empty chunk id", { chunkId: "" }],
      ["an empty tenant id", { tenantId: "" }],
      ["an empty doc id", { docId: "" }],
      ["a wrong dense size", { dense: [0.1, 0.2] }],
      ["sparse arrays of different lengths", { sparse: { indices: [1, 2], values: [0.5] } }],
      ["a reserved metadata key", { metadata: { tenantId: "globex" } }],
    ])("rejects %s without sending anything", async (_label, override) => {
      const { fake, client } = fakeQdrant();
      await expectRejects(upsertChunks(client, "kb", [chunk({ chunkId: "ok#0" }), chunk(override)], { denseSize: 3 }), ValidationError);
      expect(fake.upsert).not.toHaveBeenCalled();
    });

    it("propagates client errors unchanged", async () => {
      const { fake, client } = fakeQdrant();
      const error = new Error("Bad Request: wrong vector size");
      fake.upsert.mockRejectedValueOnce(error);
      await expect(upsertChunks(client, "kb", [chunk()], { denseSize: 3 })).rejects.toBe(error);
    });
  });

  describe("hybridQuery", () => {
    const points: Point[] = [
      { id: "p1", score: 0.5, payload: { chunkId: "refunds#0", docId: "refunds", tenantId: "acme", text: "Refunds take 14 days.", lang: "en" } },
      { id: "p2", score: 0.33, payload: { chunkId: "leak#0", docId: "leak", tenantId: "globex", text: "Other tenant" } },
      { id: "p3", score: 0.25, payload: null },
      { id: "p4", score: 0.2, payload: { chunkId: "ship#1", docId: "ship", tenantId: "acme", text: "Express", region: "eu" } },
    ];

    it("sends dense and sparse prefetches fused with RRF under a tenant filter", async () => {
      const { fake, client } = fakeQdrant({ points });
      await hybridQuery(client, "kb", { tenantId: "acme", dense: [0.1, 0.2, 0.3], sparse: { indices: [9, 3], values: [0.4, 0.8] }, limit: 5 });
      expect(fake.query).toHaveBeenCalledWith("kb", {
        prefetch: [
          { query: [0.1, 0.2, 0.3], using: "dense", limit: 20, filter: tenantFilter },
          { query: { indices: [3, 9], values: [0.8, 0.4] }, using: "sparse", limit: 20, filter: tenantFilter },
        ],
        query: { fusion: "rrf" },
        filter: tenantFilter,
        limit: 5,
        with_payload: true,
      });
    });

    it("adds a docId filter and a custom prefetch limit", async () => {
      const { fake, client } = fakeQdrant();
      await hybridQuery(client, "kb", { tenantId: "acme", dense: [1], sparse: { indices: [], values: [] }, limit: 3, prefetchLimit: 50, docIds: ["a", "b"] });
      const filter = { must: [{ key: "tenantId", match: { value: "acme" } }, { key: "docId", match: { any: ["a", "b"] } }] };
      const body = fake.query.mock.calls[0]![1] as { prefetch: Array<{ limit: number; filter: unknown }>; filter: unknown };
      expect(body.filter).toEqual(filter);
      expect(body.prefetch.map((p) => [p.limit, p.filter])).toEqual([
        [50, filter],
        [50, filter],
      ]);
    });

    it("ignores an empty docIds array", async () => {
      const { fake, client } = fakeQdrant();
      await hybridQuery(client, "kb", { tenantId: "acme", dense: [1], sparse: { indices: [1], values: [1] }, limit: 1, docIds: [] });
      expect((fake.query.mock.calls[0]![1] as { filter: unknown }).filter).toEqual(tenantFilter);
    });

    it("maps hits and drops foreign-tenant and payload-less points", async () => {
      const { client } = fakeQdrant({ points });
      const hits = await hybridQuery(client, "kb", { tenantId: "acme", dense: [1, 0, 0], sparse: { indices: [1], values: [1] }, limit: 5 });
      expect(hits).toEqual([
        { chunkId: "refunds#0", docId: "refunds", text: "Refunds take 14 days.", score: 0.5, metadata: { lang: "en" } },
        { chunkId: "ship#1", docId: "ship", text: "Express", score: 0.2, metadata: { region: "eu" } },
      ]);
    });
  });

  describe("deleteDocument", () => {
    it("deletes with a tenant-scoped filter", async () => {
      const { fake, client } = fakeQdrant();
      await deleteDocument(client, "kb", { tenantId: "acme", docId: "refunds" });
      expect(fake.delete).toHaveBeenCalledWith("kb", {
        wait: true,
        filter: { must: [{ key: "tenantId", match: { value: "acme" } }, { key: "docId", match: { value: "refunds" } }] },
      });
    });

    it("rejects empty identifiers", async () => {
      const { fake, client } = fakeQdrant();
      await expectRejects(deleteDocument(client, "kb", { tenantId: "", docId: "x" }), ValidationError);
      await expectRejects(deleteDocument(client, "kb", { tenantId: "acme", docId: "" }), ValidationError);
      expect(fake.delete).not.toHaveBeenCalled();
    });
  });
});
