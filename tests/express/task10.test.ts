import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type AuthUser, type TokenVerifier } from "../../src/express/task10/task10";
import { expectError, expectStatus } from "../support/http";

const USERS: Record<string, AuthUser> = {
  "token-alice": { id: "u-alice", role: "member" },
  "token-root": { id: "u-root", role: "admin" },
};

let app: Express;
let verify: ReturnType<typeof vi.fn<TokenVerifier["verify"]>>;

beforeEach(() => {
  verify = vi.fn<TokenVerifier["verify"]>(async (token) => USERS[token] ?? null);
  app = createApp({ tokens: { verify } });
});

describe("EXPRESS-010", () => {
  describe("GET /health", () => {
    it("returns { status: 'ok' } without a token", async () => {
      const res = await request(app).get("/health");
      expectStatus(res, 200, "GET /health must return 200 without a token.");
      expect(res.body, 'The body must be { "status": "ok" }').toEqual({ status: "ok" });
      expect(verify, "GET /health needs no login, so verify must not be called").not.toHaveBeenCalled();
    });
  });

  describe("GET /me", () => {
    it("returns the logged-in user", async () => {
      const res = await request(app).get("/me").set("Authorization", "Bearer token-alice");
      expectStatus(res, 200, "GET /me with a good token must return 200.");
      expect(res.body, 'The body must be { "id": "u-alice", "role": "member" }').toEqual({ id: "u-alice", role: "member" });
    });

    it("returns the admin user for the admin token", async () => {
      const res = await request(app).get("/me").set("Authorization", "Bearer token-root");
      expect(res.body, 'The body must be { "id": "u-root", "role": "admin" }').toEqual({ id: "u-root", role: "admin" });
    });

    it("passes only the token to verify", async () => {
      await request(app).get("/me").set("Authorization", "Bearer token-alice");
      expect(verify, 'verify must be called with "token-alice", without "Bearer "').toHaveBeenCalledWith("token-alice");
    });

    it("returns 401 without an Authorization header and does not call verify", async () => {
      expectError(await request(app).get("/me"), 401, "GET /me without a token must return 401.");
      expect(verify, "Without a header, verify must not be called").not.toHaveBeenCalled();
    });

    it.each(["Basic abc", "Bearer", "Bearer ", "token-alice"])(
      "returns 401 for the header %j and does not call verify",
      async (header) => {
        expectError(await request(app).get("/me").set("Authorization", header), 401, `"${header}" is not "Bearer <token>" and must return 401.`);
        expect(verify, `For the header "${header}", verify must not be called`).not.toHaveBeenCalled();
      },
    );

    it("returns 401 when verify returns null", async () => {
      const res = await request(app).get("/me").set("Authorization", "Bearer expired");
      expectError(res, 401, "verify returned null for this token, so GET /me must return 401.");
    });

    it("returns 503 without the original message when verify throws", async () => {
      const down = createApp({ tokens: { verify: async () => Promise.reject(new Error("login-service.internal timeout")) } });
      const res = await request(down).get("/me").set("Authorization", "Bearer token-alice");
      expectError(res, 503, "verify threw, so GET /me must return 503.");
      expect(res.text, "The response must not contain the original error message").not.toContain("login-service");
    });
  });
});
