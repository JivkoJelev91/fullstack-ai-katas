import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { rateLimit } from "../../src/backend/task11/task11";
import { expectError, expectStatus } from "../support/http";

function setup() {
  const clock = { now: 0 };
  let handled = 0;
  const app = express();
  app.get(
    "/chat",
    rateLimit({ limit: 3, windowMs: 60_000, keyOf: (req) => req.header("x-user-id") ?? "anonymous", now: () => clock.now }),
    (_req, res) => {
      handled++;
      res.json({ ok: true });
    },
  );
  const send = (userId = "u1") => request(app).get("/chat").set("x-user-id", userId);
  return { clock, send, handled: () => handled };
}

describe("BACKEND-011", () => {
  describe("rateLimit", () => {
    it("allows up to the limit", async () => {
      const { send } = setup();
      for (let i = 1; i <= 3; i++) expectStatus(await send(), 200, `Request ${i} of 3 is within the limit and must be allowed.`);
    });

    it("returns 429 over the limit and does not run the handler", async () => {
      const { send, handled } = setup();
      for (let i = 0; i < 3; i++) await send();
      expectError(await send(), 429, "The 4th request in the window must return 429.");
      expect(handled(), "Only the 3 allowed requests may reach the handler").toBe(3);
    });

    it("sets Retry-After to the seconds left in the window", async () => {
      const { clock, send } = setup();
      await send();
      clock.now = 1000;
      await send();
      clock.now = 2000;
      await send();
      clock.now = 15_000;
      const res = await send();
      expectStatus(res, 429, "The 4th request must return 429.");
      expect(res.headers["retry-after"], "The window started at 0 and ends at 60000, so 45 seconds are left").toBe("45");
    });

    it("rounds Retry-After up to whole seconds", async () => {
      const { clock, send } = setup();
      for (let i = 0; i < 3; i++) await send();
      clock.now = 59_500;
      const res = await send();
      expect(res.headers["retry-after"], "500 ms left must be sent as 1 second (round up)").toBe("1");
    });

    it("counts each user separately", async () => {
      const { send } = setup();
      for (let i = 0; i < 3; i++) await send("u1");
      expectStatus(await send("u2"), 200, "u2 has their own counter and must be allowed.");
    });

    it("starts a new window when the old one is over", async () => {
      const { clock, send } = setup();
      for (let i = 0; i < 3; i++) await send();
      expectStatus(await send(), 429, "The 4th request must return 429.");
      clock.now = 60_000;
      for (let i = 1; i <= 3; i++) expectStatus(await send(), 200, `In the new window, request ${i} of 3 must be allowed.`);
      expectStatus(await send(), 429, "The new window also allows only 3 requests.");
    });
  });
});
