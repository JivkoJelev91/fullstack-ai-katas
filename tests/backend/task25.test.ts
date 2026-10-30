import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createAiBackend, MODEL, NO_ANSWER, SYSTEM_PROMPT, type TokenVerifier } from "../../src/backend/task25/task25";
import { keywordEmbedder } from "../support/fake-embedder";
import { expectError, expectStatus } from "../support/http";
import { reply, scriptedLLM } from "../support/mock-llm";

const verifier: TokenVerifier = {
  verify: async (token) =>
    token === "ana-token" ? { id: "u1", email: "ana@example.com" } : token === "bob-token" ? { id: "u2", email: "bob@example.com" } : null,
};

const cats = { title: "Cats", content: "Cats sleep 16 hours a day.\n\nCats purr when happy." };
const dogs = { title: "Dogs", content: "Dogs need daily walks.\n\nCooking soup for dogs is fine." };

function setup(options: { failEmbed?: boolean } = {}, ...steps: Parameters<typeof scriptedLLM>) {
  const fake = scriptedLLM(...(steps.length ? steps : [reply("unused")]));
  const base = keywordEmbedder([["cat", "purr"], ["dog", "walk"], ["soup", "cook"]]);
  const embed = options.failEmbed ? vi.fn(async () => Promise.reject(new Error("embedding down"))) : base.embed;
  const app = createAiBackend({ verifier, llm: fake.llm, embedder: { dimensions: 3, embed } });
  const as = (token: string) => ({
    get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string, body: object) => request(app).post(url).set("Authorization", `Bearer ${token}`).send(body),
    delete: (url: string) => request(app).delete(url).set("Authorization", `Bearer ${token}`),
  });
  return { ...fake, app, embed, ana: as("ana-token"), bob: as("bob-token") };
}

describe("BACKEND-025", () => {
  describe("health and auth", () => {
    it("serves /health without a token and protects everything else", async () => {
      const { app } = setup();
      expectStatus(await request(app).get("/health"), 200, "GET /health needs no token.");
      expectError(await request(app).get("/documents"), 401, "GET /documents without a token must return 401.");
      expectError(await request(app).post("/ask").send({ question: "Hi" }), 401, "POST /ask without a token must return 401.");
    });
  });

  describe("documents", () => {
    it("uploads a document as chunks and lists it", async () => {
      const { ana, embed } = setup();
      const res = await ana.post("/documents", cats);
      expectStatus(res, 201, "A valid upload must return 201.");
      expect(res.body, "The body must be { id, title, chunkCount }").toEqual({ id: res.body.id, title: "Cats", chunkCount: 2 });
      expect(embed, "Both paragraphs must be embedded in one call").toHaveBeenCalledExactlyOnceWith([
        "Cats sleep 16 hours a day.",
        "Cats purr when happy.",
      ]);
      const list = await ana.get("/documents");
      expect(list.body, "GET /documents lists the document").toEqual({ data: [{ id: res.body.id, title: "Cats", chunkCount: 2 }] });
    });

    it("returns 400 for invalid input and 502 when embedding fails", async () => {
      const { ana } = setup();
      expectError(await ana.post("/documents", { title: "", content: "x" }), 400, "An empty title must return 400.");
      expectError(await ana.post("/documents", { title: "Blank", content: "  \n\n  " }), 400, "Content without paragraphs must return 400.");
      const failing = setup({ failEmbed: true });
      expectError(await failing.ana.post("/documents", cats), 502, "A failing embedder must return 502.");
      expect((await failing.ana.get("/documents")).body, "Nothing may be stored after an embedding failure").toEqual({ data: [] });
    });

    it("deletes only the caller's own documents", async () => {
      const { ana, bob } = setup();
      const id = (await ana.post("/documents", cats)).body.id;
      expectError(await bob.delete(`/documents/${id}`), 404, "Bob may not delete Ana's document: 404.");
      expectStatus(await ana.delete(`/documents/${id}`), 204, "Ana deletes her document: 204.");
      expect((await ana.get("/documents")).body, "The document is gone").toEqual({ data: [] });
    });
  });

  describe("POST /ask", () => {
    it("answers from the best chunks with citations", async () => {
      const { ana, calls } = setup({}, reply("About 16 hours [1]."));
      const catsId = (await ana.post("/documents", cats)).body.id;
      await ana.post("/documents", dogs);

      const res = await ana.post("/ask", { question: "How long do cats sleep?" });
      expectStatus(res, 200, "A valid question must return 200.");
      expect(res.body, "The body must be { answer, citations: [{ source, documentId }] }").toEqual({
        answer: "About 16 hours [1].",
        citations: [{ source: 1, documentId: catsId }],
      });
      expect(calls[0]?.model, `model must be "${MODEL}"`).toBe(MODEL);
      expect(calls[0]?.messages[0], "The first message is the system prompt").toEqual({ role: "system", content: SYSTEM_PROMPT });
      const prompt = calls[0]?.messages[1]?.content ?? "";
      expect(prompt.startsWith("Sources:\n[1] Cats "), "Source [1] must be a cats chunk (the best match)").toBe(true);
      expect(prompt.match(/^\[\d\] /gm)?.length, "Only the best 3 of 4 chunks are sent").toBe(3);
      expect(prompt.endsWith("\n\nQuestion: How long do cats sleep?"), "The prompt ends with the question").toBe(true);
    });

    it("never uses another user's documents", async () => {
      const { ana, bob, complete } = setup({}, reply("unused"));
      await ana.post("/documents", cats);
      const res = await bob.post("/ask", { question: "How long do cats sleep?" });
      expect(res.body, "Bob has no documents, so he gets NO_ANSWER").toEqual({ answer: NO_ANSWER, citations: [] });
      expect(complete, "The model must not be called without sources").not.toHaveBeenCalled();
    });

    it("stops using a deleted document's chunks", async () => {
      const { ana, complete } = setup({}, reply("unused"));
      const id = (await ana.post("/documents", cats)).body.id;
      await ana.delete(`/documents/${id}`);
      const res = await ana.post("/ask", { question: "How long do cats sleep?" });
      expect(res.body, "After the delete there are no chunks left: NO_ANSWER").toEqual({ answer: NO_ANSWER, citations: [] });
      expect(complete, "The model must not be called").not.toHaveBeenCalled();
    });

    it("returns 400 for an empty question and 502 when the model fails", async () => {
      const ok = setup();
      expectError(await ok.ana.post("/ask", { question: "" }), 400, "An empty question must return 400.");
      const failing = setup({}, new Error("provider down"));
      await failing.ana.post("/documents", cats);
      expectError(await failing.ana.post("/ask", { question: "Cats?" }), 502, "A failing model must return 502.");
    });
  });
});
