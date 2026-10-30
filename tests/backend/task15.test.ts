import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp, MAX_CONTENT_LENGTH } from "../../src/backend/task15/task15";
import { expectError, expectStatus } from "../support/http";

const valid = { title: "Notes", mimeType: "text/plain", content: "Hello world" };

function setup() {
  const onUploaded = vi.fn();
  const app = createApp({ onUploaded });
  return {
    onUploaded,
    upload: (body: object, userId = "u1") => request(app).post("/documents").set("x-user-id", userId).send(body),
    get: (id: string, userId = "u1") => request(app).get(`/documents/${id}`).set("x-user-id", userId),
  };
}

describe("BACKEND-015", () => {
  describe("POST /documents", () => {
    it("returns 202 with the new id and status pending", async () => {
      const { upload } = setup();
      const res = await upload(valid);
      expectStatus(res, 202, "A valid upload must return 202 Accepted.");
      expect(typeof res.body.id, "id must be a string").toBe("string");
      expect(res.body.status, 'A new document has status "pending"').toBe("pending");
    });

    it("queues the document with onUploaded(id)", async () => {
      const { upload, onUploaded } = setup();
      const res = await upload(valid);
      expect(onUploaded, "onUploaded must be called once with the new document id").toHaveBeenCalledExactlyOnceWith(res.body.id);
    });

    it("returns 400 for a missing title or empty content", async () => {
      const { upload, onUploaded } = setup();
      expectError(await upload({ ...valid, title: "" }), 400, "An empty title must return 400.");
      expectError(await upload({ ...valid, title: "x".repeat(201) }), 400, "A title over 200 characters must return 400.");
      expectError(await upload({ ...valid, content: "" }), 400, "Empty content must return 400.");
      expect(onUploaded, "Nothing may be queued for invalid uploads").not.toHaveBeenCalled();
    });

    it("returns 415 for a type that is not text/plain or text/markdown", async () => {
      const { upload, onUploaded } = setup();
      expectError(await upload({ ...valid, mimeType: "application/pdf" }), 415, "application/pdf is not allowed: 415.");
      expect(onUploaded, "Nothing may be queued").not.toHaveBeenCalled();
    });

    it("returns 413 for content over the size limit", async () => {
      const { upload, onUploaded } = setup();
      expectStatus(await upload({ ...valid, content: "x".repeat(MAX_CONTENT_LENGTH) }), 202, "Exactly 100,000 characters is allowed.");
      expectError(await upload({ ...valid, content: "x".repeat(MAX_CONTENT_LENGTH + 1) }), 413, "100,001 characters is too large: 413.");
      expect(onUploaded, "Only the valid upload may be queued").toHaveBeenCalledTimes(1);
    });
  });

  describe("GET /documents/:id", () => {
    it("returns the caller's document without its content", async () => {
      const { upload, get } = setup();
      const { id } = (await upload(valid)).body;
      const res = await get(id);
      expectStatus(res, 200, "The owner must get 200.");
      expect(res.body, "The body must be the metadata with size and without content").toEqual({
        id,
        title: "Notes",
        mimeType: "text/plain",
        status: "pending",
        size: 11,
        createdAt: res.body.createdAt,
      });
      expect(Number.isNaN(Date.parse(res.body.createdAt)), "createdAt must be an ISO date string").toBe(false);
    });

    it("returns 404 for another user's or an unknown document", async () => {
      const { upload, get } = setup();
      const { id } = (await upload(valid, "u1")).body;
      expectError(await get(id, "u2"), 404, "u2 may not see u1's document: 404.");
      expectError(await get("nope"), 404, "An unknown id must return 404.");
    });
  });
});
