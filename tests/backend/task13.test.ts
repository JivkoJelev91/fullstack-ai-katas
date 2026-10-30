import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp, MODEL, type StreamingLLM } from "../../src/backend/task13/task13";
import { expectError, expectStatus } from "../support/http";

/** A fake streaming model that yields the given pieces, then optionally throws. */
function fakeLLM(pieces: string[], failAfter = false) {
  const stream = vi.fn(async function* () {
    for (const piece of pieces) yield piece;
    if (failAfter) throw new Error("connection lost");
  });
  return { stream } as StreamingLLM & { stream: typeof stream };
}

function fakeStore() {
  const saved: Array<[string, string, string]> = [];
  return { saved, save: vi.fn(async (id: string, role: string, content: string) => void saved.push([id, role, content])) };
}

/** Parses an SSE body into [{ event, data }]. */
function parseEvents(text: string) {
  return text
    .split("\n\n")
    .filter((block) => block.trim() !== "")
    .map((block) => {
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      return { event, data: data === undefined ? undefined : JSON.parse(data) };
    });
}

function setup(pieces: string[], failAfter = false) {
  const llm = fakeLLM(pieces, failAfter);
  const store = fakeStore();
  const app = createApp({ llm, store });
  const send = (content: unknown) => request(app).post("/conversations/c1/stream").send({ content }).buffer(true);
  return { llm, store, send };
}

describe("BACKEND-013", () => {
  describe("POST /conversations/:id/stream", () => {
    it("responds with Content-Type text/event-stream", async () => {
      const { send } = setup(["Hello!"]);
      const res = await send("Hi");
      expectStatus(res, 200, "A stream response has status 200.");
      expect(res.headers["content-type"], "Content-Type must be text/event-stream").toMatch(/^text\/event-stream/);
    });

    it("sends one token event per piece, then a done event", async () => {
      const { send, llm } = setup(["Hel", "lo", "!"]);
      const res = await send("Hi");
      expect(parseEvents(res.text), "Events must be token, token, token, done").toEqual([
        { event: "token", data: { text: "Hel" } },
        { event: "token", data: { text: "lo" } },
        { event: "token", data: { text: "!" } },
        { event: "done", data: {} },
      ]);
      expect(llm.stream, "The model must get the model name and the user message").toHaveBeenCalledWith({
        model: MODEL,
        messages: [{ role: "user", content: "Hi" }],
      });
    });

    it("saves the user message and the full answer", async () => {
      const { send, store } = setup(["Hel", "lo", "!"]);
      await send("Hi");
      expect(store.saved, "Save the user message, then the joined answer").toEqual([
        ["c1", "user", "Hi"],
        ["c1", "assistant", "Hello!"],
      ]);
    });

    it("sends an error event when the stream fails and does not save the answer", async () => {
      const { send, store } = setup(["Hel"], true);
      const res = await send("Hi");
      const events = parseEvents(res.text);
      expect(events[0], "The piece before the failure is still sent").toEqual({ event: "token", data: { text: "Hel" } });
      expect(events.at(-1)?.event, 'The last event must be "error"').toBe("error");
      expect(typeof events.at(-1)?.data?.error, 'The error event data must be {"error": "<message>"}').toBe("string");
      expect(events.some((e) => e.event === "done"), 'There must be no "done" event after an error').toBe(false);
      expect(store.saved, "Only the user message may be saved").toEqual([["c1", "user", "Hi"]]);
    });

    it("returns 400 JSON for empty content, without calling the model", async () => {
      const { send, llm } = setup(["unused"]);
      const res = await send("");
      expectError(res, 400, "Empty content must return 400 before streaming starts.");
      expect(llm.stream, "The model must not be called").not.toHaveBeenCalled();
    });
  });
});
