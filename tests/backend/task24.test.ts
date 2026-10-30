import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAiBackend, MODEL, SYSTEM_PROMPT, type TokenVerifier } from "../../src/backend/task24/task24";
import { expectError, expectStatus } from "../support/http";
import { reply, scriptedLLM } from "../support/mock-llm";

const verifier: TokenVerifier = {
  verify: async (token) =>
    token === "ana-token" ? { id: "u1", email: "ana@example.com" } : token === "bob-token" ? { id: "u2", email: "bob@example.com" } : null,
};

function setup(...steps: Parameters<typeof scriptedLLM>) {
  const fake = scriptedLLM(...steps);
  const app = createAiBackend({ verifier, llm: fake.llm });
  const as = (token: string) => ({
    get: (url: string) => request(app).get(url).set("Authorization", `Bearer ${token}`),
    post: (url: string, body: object) => request(app).post(url).set("Authorization", `Bearer ${token}`).send(body),
  });
  return { ...fake, app, ana: as("ana-token"), bob: as("bob-token") };
}

describe("BACKEND-024", () => {
  describe("health and auth", () => {
    it("serves GET /health without a token", async () => {
      const res = await request(setup().app).get("/health");
      expectStatus(res, 200, "GET /health needs no token and must return 200.");
      expect(res.body, 'The body must be { "status": "ok" }').toEqual({ status: "ok" });
    });

    it("returns 401 without a valid token", async () => {
      const { app } = setup();
      expectError(await request(app).get("/conversations"), 401, "No token must return 401.");
      expectError(await request(app).get("/conversations").set("Authorization", "Bearer wrong"), 401, "An invalid token must return 401.");
    });

    it("returns 404 JSON for an unknown route", async () => {
      expectError(await setup().ana.get("/no-such-route"), 404, "An unknown route must return 404 with { error }.");
    });
  });

  describe("conversation flow", () => {
    it("creates a conversation, chats and lists the history", async () => {
      const { ana, calls } = setup(reply("Try Lisbon."), reply("In spring."));
      const created = await ana.post("/conversations", { title: "Trip" });
      expectStatus(created, 201, "POST /conversations must return 201.");
      expect(created.body, "The body must be { id, title, createdAt }").toMatchObject({ title: "Trip" });
      const id = created.body.id;

      const first = await ana.post(`/conversations/${id}/messages`, { content: "Where to go?" });
      expectStatus(first, 201, "POST /conversations/:id/messages must return 201.");
      expect(first.body, 'The body must be { "reply": <model text> }').toEqual({ reply: "Try Lisbon." });
      expect(calls[0], "The model gets MODEL, maxTokens 500, system prompt and the message").toMatchObject({
        model: MODEL,
        maxTokens: 500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: "Where to go?" },
        ],
      });

      await ana.post(`/conversations/${id}/messages`, { content: "When?" });
      expect(calls[1]?.messages.length, "The second call must include the history: system + 2 saved + 1 new").toBe(4);

      const messages = await ana.get(`/conversations/${id}/messages`);
      expectStatus(messages, 200, "GET /conversations/:id/messages must return 200.");
      expect(messages.body.data, "All 4 messages, oldest first").toEqual([
        { role: "user", content: "Where to go?" },
        { role: "assistant", content: "Try Lisbon." },
        { role: "user", content: "When?" },
        { role: "assistant", content: "In spring." },
      ]);

      const list = await ana.get("/conversations");
      expectStatus(list, 200, "GET /conversations must return 200.");
      expect(list.body, "The list shows the conversation with messageCount 4").toEqual({ data: [{ id, title: "Trip", messageCount: 4 }] });
    });
  });

  describe("isolation, validation and failures", () => {
    it("keeps users apart", async () => {
      const { ana, bob, complete } = setup(reply("unused"));
      const id = (await ana.post("/conversations", { title: "Private" })).body.id;
      expect((await bob.get("/conversations")).body, "Bob must not see Ana's conversation").toEqual({ data: [] });
      expectError(await bob.get(`/conversations/${id}/messages`), 404, "Bob reading Ana's messages must get 404.");
      expectError(await bob.post(`/conversations/${id}/messages`, { content: "Hi" }), 404, "Bob posting to Ana's conversation must get 404.");
      expect(complete, "The model must not be called for Bob").not.toHaveBeenCalled();
    });

    it("returns 400 for an invalid title or content", async () => {
      const { ana, complete } = setup(reply("unused"));
      expectError(await ana.post("/conversations", { title: "" }), 400, "An empty title must return 400.");
      const id = (await ana.post("/conversations", { title: "Trip" })).body.id;
      expectError(await ana.post(`/conversations/${id}/messages`, { content: "" }), 400, "Empty content must return 400.");
      expect(complete, "The model must not be called for invalid input").not.toHaveBeenCalled();
    });

    it("returns 502 when the model fails and saves nothing", async () => {
      const { ana } = setup(new Error("provider down"));
      const id = (await ana.post("/conversations", { title: "Trip" })).body.id;
      expectError(await ana.post(`/conversations/${id}/messages`, { content: "Hi" }), 502, "A failing model must return 502.");
      expect((await ana.get(`/conversations/${id}/messages`)).body, "No message may be saved").toEqual({ data: [] });
    });
  });
});
