import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { cosineSimilarity, createApp, type Chunk } from "../../src/backend/task17/task17";
import { expectError, expectStatus } from "../support/http";

// Vectors: [cats, dogs, cooking]
const chunks: Chunk[] = [
  { id: "d1:0", documentId: "d1", userId: "u1", text: "Cats purr.", vector: [1, 0, 0] },
  { id: "d1:1", documentId: "d1", userId: "u1", text: "Dogs bark.", vector: [0, 1, 0] },
  { id: "d2:0", documentId: "d2", userId: "u1", text: "Pets: cats and dogs.", vector: [1, 1, 0] },
  { id: "d2:1", documentId: "d2", userId: "u1", text: "Soup recipe.", vector: [0, 0, 1] },
  { id: "d9:0", documentId: "d9", userId: "u2", text: "Bob's cat diary.", vector: [1, 0, 0] },
];

const queries: Record<string, number[]> = { "tell me about cats": [1, 0.1, 0], "how to cook": [0, 0, 1] };

function setup() {
  const embed = vi.fn(async (texts: string[]) => texts.map((t) => queries[t] ?? [0.1, 0.1, 0.1]));
  const app = createApp({ embedder: { dimensions: 3, embed }, chunks });
  const search = (body: object, userId = "u1") => request(app).post("/search").set("x-user-id", userId).send(body);
  return { embed, search };
}

const ids = (res: request.Response) => (res.body.results ?? []).map((r: { chunkId: string }) => r.chunkId);

describe("BACKEND-017", () => {
  describe("cosineSimilarity", () => {
    it("measures the angle between vectors", () => {
      expect(cosineSimilarity([1, 0], [1, 0]), "Same direction gives 1").toBeCloseTo(1, 10);
      expect(cosineSimilarity([1, 0], [0, 1]), "Perpendicular gives 0").toBeCloseTo(0, 10);
      expect(cosineSimilarity([1, 0], [-1, 0]), "Opposite gives -1").toBeCloseTo(-1, 10);
      expect(cosineSimilarity([1, 1], [2, 2]), "Length does not matter").toBeCloseTo(1, 10);
      expect(cosineSimilarity([1, 2, 3], [3, 2, 1]), "(1×3 + 2×2 + 3×1) / (√14 × √14) = 10/14").toBeCloseTo(10 / 14, 10);
    });
  });

  describe("POST /search", () => {
    it("returns the most similar chunks first, with their scores", async () => {
      const { search, embed } = setup();
      const res = await search({ query: "tell me about cats", topK: 2 });
      expectStatus(res, 200, "A valid search must return 200.");
      expect(ids(res), "The cats chunk, then the cats-and-dogs chunk").toEqual(["d1:0", "d2:0"]);
      expect(res.body.results[0], "Each result is { chunkId, documentId, text, score }").toEqual({
        chunkId: "d1:0",
        documentId: "d1",
        text: "Cats purr.",
        score: res.body.results[0].score,
      });
      expect(res.body.results[0].score, "score must be the cosine similarity").toBeCloseTo(cosineSimilarity([1, 0.1, 0], [1, 0, 0]), 10);
      expect(embed, "The query must be embedded with one call: embed([query])").toHaveBeenCalledExactlyOnceWith(["tell me about cats"]);
    });

    it("returns 3 results by default", async () => {
      const { search } = setup();
      const res = await search({ query: "how to cook" });
      expectStatus(res, 200, "A search without topK must return 200.");
      expect(ids(res)[0], "The soup chunk must be first").toBe("d2:1");
      expect(ids(res).length, "Without topK, 3 results are returned").toBe(3);
    });

    it("never returns another user's chunks", async () => {
      const { search } = setup();
      const res = await search({ query: "tell me about cats", topK: 10 });
      expect(ids(res), "u1 has 4 chunks; u2's chunk d9:0 must not appear").not.toContain("d9:0");
      expect(ids(res).length, "All 4 of u1's chunks fit in topK 10").toBe(4);
    });

    it("returns 400 for an empty query or an invalid topK", async () => {
      const { search, embed } = setup();
      expectError(await search({ query: "" }), 400, "An empty query must return 400.");
      expectError(await search({ query: "cats", topK: 0 }), 400, "topK 0 must return 400.");
      expectError(await search({ query: "cats", topK: 11 }), 400, "topK 11 must return 400.");
      expect(embed, "Nothing may be embedded for invalid input").not.toHaveBeenCalled();
    });
  });
});
