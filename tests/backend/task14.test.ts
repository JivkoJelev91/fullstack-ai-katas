import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, MODEL } from "../../src/backend/task14/task14";
import { expectError, expectStatus } from "../support/http";
import { reply, scriptedLLM } from "../support/mock-llm";

const answer = reply("Sure!", { usage: { inputTokens: 1000, outputTokens: 2000 } }); // costs 0.0035 USD

function setup(budgetUsd: number, ...steps: Parameters<typeof scriptedLLM>) {
  const fake = scriptedLLM(...steps);
  const app = createApp({ llm: fake.llm, budgetUsd });
  return {
    ...fake,
    chat: (prompt: unknown, userId = "u1") => request(app).post("/chat").set("x-user-id", userId).send({ prompt }),
    usage: (userId = "u1") => request(app).get("/usage").set("x-user-id", userId),
  };
}

describe("BACKEND-014", () => {
  describe("POST /chat", () => {
    it("returns the text and the cost of the call", async () => {
      const { chat, calls } = setup(1, answer);
      const res = await chat("Write a haiku");
      expectStatus(res, 200, "A valid prompt must return 200.");
      expect(res.body.text, "text must be the model's text").toBe("Sure!");
      expect(res.body.costUsd, "1000 input × 0.5/1M + 2000 output × 1.5/1M = 0.0035").toBeCloseTo(0.0035, 10);
      expect(calls[0]?.model, `model must be "${MODEL}"`).toBe(MODEL);
      expect(calls[0]?.messages, "The prompt must be sent as one user message").toEqual([{ role: "user", content: "Write a haiku" }]);
    });

    it("returns 402 once the budget is used up, without calling the model", async () => {
      const { chat, complete } = setup(0.005, answer);
      expectStatus(await chat("one"), 200, "1st call: spent 0 < 0.005, allowed.");
      expectStatus(await chat("two"), 200, "2nd call: spent 0.0035 < 0.005, allowed.");
      expectError(await chat("three"), 402, "3rd call: spent 0.007 >= 0.005, must return 402.");
      expect(complete, "The model must not be called once the budget is used up").toHaveBeenCalledTimes(2);
    });

    it("returns 400 for an empty prompt", async () => {
      const { chat, complete } = setup(1, answer);
      expectError(await chat(""), 400, "An empty prompt must return 400.");
      expect(complete, "The model must not be called").not.toHaveBeenCalled();
    });

    it("returns 502 when the model fails, without changing the usage", async () => {
      const { chat, usage } = setup(1, new Error("provider down"));
      expectError(await chat("Hi"), 502, "A failing model call must return 502.");
      expect((await usage()).body, "A failed call must not be counted").toEqual({ requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    });
  });

  describe("GET /usage", () => {
    it("adds up the caller's requests, tokens and cost", async () => {
      const { chat, usage } = setup(1, answer);
      await chat("one");
      await chat("two");
      const res = await usage();
      expectStatus(res, 200, "GET /usage must return 200.");
      expect(res.body, "Totals after 2 calls").toMatchObject({ requests: 2, inputTokens: 2000, outputTokens: 4000 });
      expect(res.body.costUsd, "Total cost after 2 calls is 0.007").toBeCloseTo(0.007, 10);
    });

    it("keeps each user's usage separate", async () => {
      const { chat, usage } = setup(1, answer);
      await chat("one", "u1");
      expect((await usage("u2")).body, "u2 made no calls, so all values are 0").toEqual({ requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 });
    });
  });
});
