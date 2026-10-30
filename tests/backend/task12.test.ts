import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, MAX_TOKENS, MODEL, SYSTEM_PROMPT, type Conversation } from "../../src/backend/task12/task12";
import { expectError, expectStatus } from "../support/http";
import { reply, scriptedLLM } from "../support/mock-llm";

const conversations = (): Conversation[] => [
  {
    id: "c1",
    userId: "u1",
    messages: [
      { role: "user", content: "Where should I travel?" },
      { role: "assistant", content: "Try Lisbon." },
    ],
  },
  { id: "c9", userId: "u2", messages: [] },
];

function setup(...steps: Parameters<typeof scriptedLLM>) {
  const fake = scriptedLLM(...steps);
  const app = createApp({ llm: fake.llm, conversations: conversations() });
  const send = (conversationId: string, content: unknown, userId = "u1") =>
    request(app).post(`/conversations/${conversationId}/messages`).set("x-user-id", userId).send({ content });
  return { ...fake, send };
}

describe("BACKEND-012", () => {
  describe("POST /conversations/:id/messages", () => {
    it("returns 201 with the model's reply", async () => {
      const { send } = setup(reply("The Canary Islands are warm in winter."));
      const res = await send("c1", "And in winter?");
      expectStatus(res, 201, "A valid message must return 201.");
      expect(res.body, 'The body must be { "reply": <model text> }').toEqual({ reply: "The Canary Islands are warm in winter." });
    });

    it("sends the system prompt, the history and the new message to the model", async () => {
      const { send, calls } = setup(reply("Canaries."));
      await send("c1", "And in winter?");
      expect(calls[0]?.model, `model must be "${MODEL}"`).toBe(MODEL);
      expect(calls[0]?.maxTokens, `maxTokens must be ${MAX_TOKENS}`).toBe(MAX_TOKENS);
      expect(calls[0]?.messages, "messages must be: system prompt, saved history (oldest first), new user message").toEqual([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Where should I travel?" },
        { role: "assistant", content: "Try Lisbon." },
        { role: "user", content: "And in winter?" },
      ]);
    });

    it("saves the exchange, so the next request includes it", async () => {
      const { send, calls } = setup(reply("Canaries."), reply("Yes, in July."));
      await send("c1", "And in winter?");
      await send("c1", "Is it hot in summer?");
      expect(calls[1]?.messages.slice(-3), "The second call must include the first exchange before the new message").toEqual([
        { role: "user", content: "And in winter?" },
        { role: "assistant", content: "Canaries." },
        { role: "user", content: "Is it hot in summer?" },
      ]);
    });

    it("returns 400 for empty or too long content, without calling the model", async () => {
      const { send, complete } = setup(reply("unused"));
      expectError(await send("c1", ""), 400, "Empty content must return 400.");
      expectError(await send("c1", 42), 400, "Content that is not a string must return 400.");
      expectError(await send("c1", "x".repeat(4001)), 400, "Content over 4000 characters must return 400.");
      expect(complete, "The model must not be called for invalid input").not.toHaveBeenCalled();
    });

    it("returns 404 for another user's or an unknown conversation", async () => {
      const { send, complete } = setup(reply("unused"));
      expectError(await send("c9", "Hi"), 404, "c9 belongs to u2, so u1 must get 404.");
      expectError(await send("nope", "Hi"), 404, "An unknown conversation must return 404.");
      expect(complete, "The model must not be called").not.toHaveBeenCalled();
    });

    it("returns 502 when the model fails and saves nothing", async () => {
      const { send, calls } = setup(new Error("provider down"), reply("Canaries."));
      expectError(await send("c1", "First try"), 502, "A failing model call must return 502.");
      await send("c1", "Second try");
      const contents = calls[1]?.messages.map((m) => m.content);
      expect(contents, 'The failed message "First try" must not be saved in the history').not.toContain("First try");
    });
  });
});
