import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp, type AuthUser } from "../../src/backend/task7/task7";
import { expectError, expectStatus } from "../support/http";

const ana: AuthUser = { id: "u1", email: "ana@example.com" };

function makeVerifier() {
  const verify = vi.fn(async (token: string) => (token === "good-token" ? ana : null));
  return { verify };
}

describe("BACKEND-007", () => {
  describe("requireAuth", () => {
    it("lets a valid token through and sets res.locals.user", async () => {
      const verifier = makeVerifier();
      const res = await request(createApp(verifier)).get("/me").set("Authorization", "Bearer good-token");
      expectStatus(res, 200, "A valid token must reach the /me handler.");
      expect(res.body, "/me returns res.locals.user, which must be the verified user").toEqual(ana);
      expect(verifier.verify, 'verify must be called with only the token, "good-token"').toHaveBeenCalledWith("good-token");
    });

    it("returns 401 without an Authorization header", async () => {
      const verifier = makeVerifier();
      const res = await request(createApp(verifier)).get("/me");
      expectError(res, 401, "A request without a token must return 401.");
      expect(verifier.verify, "There is no token, so verify must not be called").not.toHaveBeenCalled();
    });

    it("returns 401 for a scheme other than Bearer", async () => {
      const res = await request(createApp(makeVerifier())).get("/me").set("Authorization", "Basic YW5hOnB3");
      expectError(res, 401, '"Basic ..." is not a Bearer token and must return 401.');
    });

    it("returns 401 for an empty token", async () => {
      const verifier = makeVerifier();
      const res = await request(createApp(verifier)).get("/me").set("Authorization", "Bearer ");
      expectError(res, 401, '"Bearer " with no token must return 401.');
      expect(verifier.verify, "An empty token must not be sent to verify").not.toHaveBeenCalled();
    });

    it("returns 401 when the verifier rejects the token", async () => {
      const res = await request(createApp(makeVerifier())).get("/me").set("Authorization", "Bearer expired-token");
      expectError(res, 401, "verify returned null, so the request must return 401.");
    });
  });
});
