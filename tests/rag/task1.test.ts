import { describe, expect, it } from "vitest";
import { chunkDocument, type Chunk, type SourceDocument } from "../../src/rag/task1/task1";

const text = (t: string): SourceDocument => ({ id: "doc", format: "text", text: t });
const md = (t: string): SourceDocument => ({ id: "doc", format: "markdown", text: t });
const texts = (chunks: Chunk[]) => chunks.map((c) => c.text);

describe("RAG-001", () => {
  describe("Options", () => {

    it("returns no chunks for empty or whitespace-only documents", () => {
      expect(chunkDocument(text(""), { maxChars: 100, overlapChars: 0 })).toEqual([]);
      expect(chunkDocument(md("  \n\t \n"), { maxChars: 100, overlapChars: 0 })).toEqual([]);
    });
  });

  describe("Markdown sections", () => {
    it("splits at headings with heading paths and exact offsets", () => {
      const doc: SourceDocument = {
        id: "guide",
        format: "markdown",
        text: "# Setup\nInstall the CLI.\n\n## Linux\nRun the script.\n\n# Usage\nCall the API.",
        metadata: { source: "docs" },
      };
      expect(chunkDocument(doc, { maxChars: 200, overlapChars: 0 })).toEqual([
        { id: "guide#0", docId: "guide", index: 0, text: "# Setup\nInstall the CLI.", start: 0, end: 24, headingPath: ["Setup"], metadata: { source: "docs" } },
        { id: "guide#1", docId: "guide", index: 1, text: "## Linux\nRun the script.", start: 26, end: 50, headingPath: ["Setup", "Linux"], metadata: { source: "docs" } },
        { id: "guide#2", docId: "guide", index: 2, text: "# Usage\nCall the API.", start: 52, end: 73, headingPath: ["Usage"], metadata: { source: "docs" } },
      ]);
    });

    it("builds heading paths from heading levels", () => {
      const chunks = chunkDocument(md("# A\nx\n### C\ny\n## B\nz\n# D\nw"), { maxChars: 100, overlapChars: 0 });
      expect(chunks.map((c) => c.headingPath)).toEqual([["A"], ["A", "C"], ["A", "B"], ["D"]]);
    });

    it("keeps text before the first heading as its own section", () => {
      const chunks = chunkDocument(md("Intro text.\n# Heading\nBody"), { maxChars: 100, overlapChars: 0 });
      expect(chunks.map((c) => [c.text, c.headingPath])).toEqual([
        ["Intro text.", []],
        ["# Heading\nBody", ["Heading"]],
      ]);
    });

    it("trims heading text", () => {
      const chunks = chunkDocument(md("##   Spaced Title   \nBody"), { maxChars: 100, overlapChars: 0 });
      expect(chunks[0]!.headingPath).toEqual(["Spaced Title"]);
    });

    it("ignores lines that are not ATX headings", () => {
      const chunks = chunkDocument(md("# Real\n#NoSpace\n####### Seven hashes\n  # indented is still text? no\nend"), { maxChars: 200, overlapChars: 0 });
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.headingPath).toEqual(["Real"]);
    });

    it("treats a text document as a single section", () => {
      const chunks = chunkDocument(text("# Not a heading\nBecause this is plain text."), { maxChars: 200, overlapChars: 0 });
      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.headingPath).toEqual([]);
    });

    it("never lets a chunk span two sections, and keeps the heading path on every chunk", () => {
      const body = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(6);
      const chunks = chunkDocument(md(`# One\n${body}\n# Two\n${body}`), { maxChars: 120, overlapChars: 20 });
      const sectionTwoStart = `# One\n${body}\n`.length;
      for (const c of chunks) {
        expect(c.start < sectionTwoStart && c.end > sectionTwoStart).toBe(false);
        expect(c.headingPath).toEqual(c.start < sectionTwoStart ? ["One"] : ["Two"]);
      }
      expect(new Set(chunks.map((c) => c.headingPath[0]))).toEqual(new Set(["One", "Two"]));
    });
  });

  describe("Boundaries", () => {
    it("prefers paragraph breaks", () => {
      const t = "Alpha beta gamma delta. Epsilon zeta.\n\nEta theta iota kappa lambda mu nu.";
      const chunks = chunkDocument(text(t), { maxChars: 50, overlapChars: 0 });
      expect(chunks.map((c) => [c.start, c.end])).toEqual([[0, 37], [39, 73]]);
    });

    it("prefers line breaks over later sentence and word boundaries", () => {
      const chunks = chunkDocument(text("Words words words words words\nThis is it. More text here"), { maxChars: 50, overlapChars: 0 });
      expect(texts(chunks)).toEqual(["Words words words words words", "This is it. More text here"]);
    });

    it("prefers sentence ends over word boundaries", () => {
      const chunks = chunkDocument(text("One two three four five six seven. Eight nine ten eleven twelve thirteen"), { maxChars: 50, overlapChars: 0 });
      expect(texts(chunks)).toEqual(["One two three four five six seven.", "Eight nine ten eleven twelve thirteen"]);
    });

    it("only considers boundaries in the second half of the window", () => {
      // The paragraph break at position 5 is before maxChars / 2, so a word boundary is used instead.
      const t = "Tiny.\n\nThen a long run of words that goes past the limit";
      const chunks = chunkDocument(text(t), { maxChars: 50, overlapChars: 0 });
      expect(chunks[0]!.end).toBeGreaterThan(25);
      expect(chunks[0]!.text.startsWith("Tiny.\n\nThen")).toBe(true);
    });

    it("falls back to a hard cut", () => {
      const chunks = chunkDocument(text("x".repeat(120)), { maxChars: 50, overlapChars: 0 });
      expect(chunks.map((c) => [c.start, c.end])).toEqual([[0, 50], [50, 100], [100, 120]]);
    });
  });

  describe("Overlap", () => {
    const list = Array.from({ length: 40 }, (_, i) => String.fromCharCode(97 + (i % 26)).repeat(2));
    const words = list.join(" ");
    const span = (from: number, to: number) => list.slice(from, to + 1).join(" ");

    it("starts the next chunk at the first word start inside the overlap window", () => {
      const chunks = chunkDocument(text(words), { maxChars: 50, overlapChars: 12 });
      expect(texts(chunks)).toEqual([span(0, 16), span(13, 29), span(26, 39)]);
    });

    it("produces no overlap when overlapChars is 0", () => {
      const chunks = chunkDocument(text(words), { maxChars: 50, overlapChars: 0 });
      for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.start).toBeGreaterThanOrEqual(chunks[i - 1]!.end);
    });

    it("does not overlap when no word starts inside the overlap window", () => {
      const chunks = chunkDocument(text("x".repeat(120)), { maxChars: 50, overlapChars: 10 });
      expect(chunks.map((c) => [c.start, c.end])).toEqual([[0, 50], [50, 100], [100, 120]]);
    });

    it("never overlaps by more than overlapChars", () => {
      const t = "The quick brown fox jumps over the lazy dog. ".repeat(30);
      const chunks = chunkDocument(text(t), { maxChars: 100, overlapChars: 15 });
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i - 1]!.end - chunks[i]!.start).toBeLessThanOrEqual(15);
        expect(chunks[i]!.start).toBeGreaterThan(chunks[i - 1]!.start);
      }
    });
  });

  describe("Invariants", () => {
    const longDoc = md(
      [
        "Preamble paragraph with a few words.",
        "# Chapter 1",
        "First paragraph. ".repeat(20),
        "",
        "Second paragraph has a very long line " + "word ".repeat(80),
        "## Section 1.1",
        "```ts\nconst x = 1;\n# comment\n```",
        "Short.",
        "# Chapter 2",
        "z".repeat(700),
      ].join("\n"),
    );
    let cached: Chunk[] | undefined;
    const chunksOf = () => (cached ??= chunkDocument(longDoc, { maxChars: 150, overlapChars: 30 }));

    it("returns exact offsets, sequential ids and bounded sizes", () => {
      chunksOf().forEach((c, i) => {
        expect(c.text).toBe(longDoc.text.slice(c.start, c.end));
        expect(c.text.length).toBeLessThanOrEqual(150);
        expect(c.text.length).toBeGreaterThan(0);
        expect(c.text).toBe(c.text.trim());
        expect(c.index).toBe(i);
        expect(c.id).toBe(`doc#${i}`);
        expect(c.docId).toBe("doc");
      });
    });

    it("covers every non-whitespace character", () => {
      const covered = new Array(longDoc.text.length).fill(false);
      for (const c of chunksOf()) for (let i = c.start; i < c.end; i++) covered[i] = true;
      for (let i = 0; i < longDoc.text.length; i++) if (!/\s/.test(longDoc.text[i]!)) expect(covered[i], `position ${i} is not covered`).toBe(true);
    });

    it("is deterministic", () => {
      expect(chunkDocument(longDoc, { maxChars: 150, overlapChars: 30 })).toEqual(chunksOf());
    });

    it("copies metadata instead of sharing it", () => {
      const metadata = { source: "wiki" };
      const result = chunkDocument({ id: "m", format: "text", text: "Some text here.", metadata }, { maxChars: 100, overlapChars: 0 });
      metadata.source = "changed";
      expect(result[0]!.metadata).toEqual({ source: "wiki" });
      expect(chunkDocument(text("No metadata."), { maxChars: 100, overlapChars: 0 })[0]!.metadata).toEqual({});
    });
  });
});
