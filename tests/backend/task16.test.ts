import { describe, expect, it, vi } from "vitest";
import { ingestDocument, splitIntoChunks, type Chunk, type DocumentRecord, type IngestionDeps } from "../../src/backend/task16/task16";

/** Fake embedder: the vector of a text is [its length, 1]. */
function fakeEmbedder(fail = false) {
  const embed = vi.fn(async (texts: string[]) => {
    if (fail) throw new Error("embedding service unavailable");
    return texts.map((t) => [t.length, 1]);
  });
  return { dimensions: 2, embed };
}

function setup(content: string, fail = false) {
  const documents = new Map<string, DocumentRecord>([["d1", { id: "d1", userId: "u1", content, status: "pending" }]]);
  const other: Chunk = { id: "d9:0", documentId: "d9", userId: "u2", index: 0, text: "other doc", vector: [9, 1] };
  const embedder = fakeEmbedder(fail);
  const deps: IngestionDeps = { documents, chunks: [other], embedder };
  return { deps, embedder, doc: () => documents.get("d1")!, own: () => deps.chunks.filter((c) => c.documentId === "d1") };
}

describe("BACKEND-016", () => {
  describe("splitIntoChunks", () => {
    it("splits on blank lines, trims and drops empty parts", () => {
      expect(splitIntoChunks("First paragraph.\n\nSecond one.\n\n\n  Third.  "), "Three trimmed paragraphs").toEqual([
        "First paragraph.",
        "Second one.",
        "Third.",
      ]);
      expect(splitIntoChunks("Line one\nline two"), "A single newline does not split a paragraph").toEqual(["Line one\nline two"]);
      expect(splitIntoChunks("   \n\n  "), "Only whitespace gives no chunks").toEqual([]);
    });
  });

  describe("ingestDocument", () => {
    it("stores one chunk per paragraph with its vector", async () => {
      const { deps, own } = setup("Cats purr.\n\nDogs bark.");
      await ingestDocument("d1", deps);
      expect(own(), "Chunks must be { id: d1:index, documentId, userId, index, text, vector }").toEqual([
        { id: "d1:0", documentId: "d1", userId: "u1", index: 0, text: "Cats purr.", vector: [10, 1] },
        { id: "d1:1", documentId: "d1", userId: "u1", index: 1, text: "Dogs bark.", vector: [10, 1] },
      ]);
    });

    it("embeds all chunks in one call", async () => {
      const { deps, embedder } = setup("A.\n\nB.\n\nC.");
      await ingestDocument("d1", deps);
      expect(embedder.embed, "embed must be called once with all chunk texts").toHaveBeenCalledExactlyOnceWith(["A.", "B.", "C."]);
    });

    it("marks the document ready with its chunk count", async () => {
      const { deps, doc } = setup("Cats purr.\n\nDogs bark.");
      await ingestDocument("d1", deps);
      expect(doc(), 'The document must have status "ready" and chunkCount 2').toMatchObject({ status: "ready", chunkCount: 2 });
    });

    it("marks the document failed when embedding fails, without storing chunks", async () => {
      const { deps, doc, own } = setup("Cats purr.", true);
      await ingestDocument("d1", deps);
      expect(doc(), 'status must be "failed" with the error message').toMatchObject({ status: "failed", error: "embedding service unavailable" });
      expect(own(), "No chunks may be stored").toEqual([]);
    });

    it("marks a document without text as failed", async () => {
      const { deps, doc, embedder } = setup("  \n\n  ");
      await ingestDocument("d1", deps);
      expect(doc(), 'A document without text must be "failed" with "Document has no text"').toMatchObject({
        status: "failed",
        error: "Document has no text",
      });
      expect(embedder.embed, "There is nothing to embed").not.toHaveBeenCalled();
    });

    it("does not duplicate chunks when run twice", async () => {
      const { deps, own } = setup("Cats purr.\n\nDogs bark.");
      await ingestDocument("d1", deps);
      await ingestDocument("d1", deps);
      expect(own().map((c) => c.id), "A second run must replace the old chunks, not add more").toEqual(["d1:0", "d1:1"]);
      expect(deps.chunks.some((c) => c.id === "d9:0"), "Chunks of other documents must stay").toBe(true);
    });
  });
});
