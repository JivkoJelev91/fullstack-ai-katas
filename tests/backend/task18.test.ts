import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  buildPrompt,
  createApp,
  extractCitations,
  MODEL,
  NO_ANSWER,
  SYSTEM_PROMPT,
  type RetrievedChunk,
} from "../../src/backend/task18/task18";
import { expectError, expectStatus } from "../support/http";
import { reply, scriptedLLM } from "../support/mock-llm";

const chunks: RetrievedChunk[] = [
  { chunkId: "d1:0", documentId: "d1", text: "Cats sleep 16 hours a day." },
  { chunkId: "d2:3", documentId: "d2", text: "Dogs need daily walks." },
];

function setup(found: RetrievedChunk[], ...steps: Parameters<typeof scriptedLLM>) {
  const fake = scriptedLLM(...steps);
  const retrieve = vi.fn(async () => found);
  const app = createApp({ llm: fake.llm, retrieve });
  const ask = (question: unknown) => request(app).post("/ask").set("x-user-id", "u1").send({ question });
  return { ...fake, retrieve, ask };
}

describe("BACKEND-018", () => {
  describe("buildPrompt", () => {
    it("builds the system message and the numbered sources", () => {
      expect(buildPrompt("How long do cats sleep?", chunks), "The two messages must match the spec exactly").toEqual([
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: "Sources:\n[1] Cats sleep 16 hours a day.\n[2] Dogs need daily walks.\n\nQuestion: How long do cats sleep?",
        },
      ]);
    });
  });

  describe("extractCitations", () => {
    it("maps each [n] to its chunk, once, in order of first use", () => {
      expect(extractCitations("Dogs walk daily [2]. Cats sleep 16 hours [1]. Again [2].", chunks), "Sources 2 then 1, each once").toEqual([
        { source: 2, chunkId: "d2:3", documentId: "d2" },
        { source: 1, chunkId: "d1:0", documentId: "d1" },
      ]);
    });

    it("ignores numbers without a matching chunk", () => {
      expect(extractCitations("Maybe [0], [2] or [7].", chunks), "Only [2] matches a chunk").toEqual([
        { source: 2, chunkId: "d2:3", documentId: "d2" },
      ]);
      expect(extractCitations("No idea.", chunks), "No citations gives []").toEqual([]);
    });
  });

  describe("POST /ask", () => {
    it("answers from the retrieved chunks with citations", async () => {
      const { ask, retrieve, calls } = setup(chunks, reply("Cats sleep about 16 hours a day [1]."));
      const res = await ask("How long do cats sleep?");
      expectStatus(res, 200, "A valid question must return 200.");
      expect(res.body, "The body must be { answer, citations }").toEqual({
        answer: "Cats sleep about 16 hours a day [1].",
        citations: [{ source: 1, chunkId: "d1:0", documentId: "d1" }],
      });
      expect(retrieve, "retrieve must be called with (userId, question, 3)").toHaveBeenCalledWith("u1", "How long do cats sleep?", 3);
      expect(calls[0]?.model, `model must be "${MODEL}"`).toBe(MODEL);
      expect(calls[0]?.messages, "The model must get buildPrompt(question, chunks)").toEqual(buildPrompt("How long do cats sleep?", chunks));
    });

    it("answers NO_ANSWER without calling the model when nothing is found", async () => {
      const { ask, complete } = setup([], reply("unused"));
      const res = await ask("What is the capital of Mars?");
      expectStatus(res, 200, "No sources still returns 200.");
      expect(res.body, "The body must be { answer: NO_ANSWER, citations: [] }").toEqual({ answer: NO_ANSWER, citations: [] });
      expect(complete, "The model must not be called without sources").not.toHaveBeenCalled();
    });

    it("returns 400 for an empty question and 502 when the model fails", async () => {
      expectError(await setup(chunks, reply("unused")).ask(""), 400, "An empty question must return 400.");
      expectError(await setup(chunks, new Error("provider down")).ask("Cats?"), 502, "A failing model must return 502.");
    });
  });
});
