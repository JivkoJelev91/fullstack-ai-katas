import { createHash } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApiKeyStore, createApp } from "../../src/backend/task10/task10";
import { expectError, expectStatus } from "../support/http";

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describe("BACKEND-010", () => {
  describe("createApiKeyStore", () => {
    it('creates keys like "sk_" + 48 hex characters, each one different', () => {
      const store = createApiKeyStore();
      const a = store.create("u1");
      const b = store.create("u1");
      expect(a.key, 'A key is "sk_" followed by 48 hex characters').toMatch(/^sk_[0-9a-f]{48}$/);
      expect(typeof a.id, "create must return an id").toBe("string");
      expect(a.key, "Every key must be different").not.toBe(b.key);
    });

    it("stores only the SHA-256 hash, never the key", () => {
      const store = createApiKeyStore();
      const { id, key } = store.create("u1");
      const records = store.records();
      expect(records, "There must be one stored record").toHaveLength(1);
      expect(records[0], "The record must be { id, userId, keyHash: sha256(key) as hex, revoked: false }").toEqual({
        id,
        userId: "u1",
        keyHash: sha256(key),
        revoked: false,
      });
      expect(JSON.stringify(records), "The full key must not be stored anywhere").not.toContain(key);
    });

    it("verifies a key and returns its owner", () => {
      const store = createApiKeyStore();
      const { key } = store.create("u1");
      store.create("u2");
      expect(store.verify(key), "A valid key returns its owner").toBe("u1");
      expect(store.verify("sk_" + "0".repeat(48)), "An unknown key returns null").toBeNull();
    });

    it("rejects a revoked key", () => {
      const store = createApiKeyStore();
      const { id, key } = store.create("u1");
      expect(store.revoke(id), "revoke returns true for an existing key").toBe(true);
      expect(store.verify(key), "A revoked key returns null").toBeNull();
      expect(store.revoke("no-such-id"), "revoke returns false for an unknown id").toBe(false);
    });
  });

  describe("requireApiKey", () => {
    it("lets a valid key through", async () => {
      const store = createApiKeyStore();
      const { key } = store.create("u1");
      const res = await request(createApp(store)).get("/whoami").set("x-api-key", key);
      expectStatus(res, 200, "A valid key must reach the handler.");
      expect(res.body, "res.locals.userId must be the key's owner").toEqual({ userId: "u1" });
    });

    it("returns 401 for a missing, wrong or revoked key", async () => {
      const store = createApiKeyStore();
      const { id, key } = store.create("u1");
      const app = createApp(store);
      expectError(await request(app).get("/whoami"), 401, "No x-api-key header must return 401.");
      expectError(await request(app).get("/whoami").set("x-api-key", "sk_wrong"), 401, "A wrong key must return 401.");
      store.revoke(id);
      expectError(await request(app).get("/whoami").set("x-api-key", key), 401, "A revoked key must return 401.");
    });
  });
});
