import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp, type Note } from "../../src/express/task13/task13";
import { expectError, expectStatus } from "../support/http";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const sampleNotes = (): Note[] => [
  { id: "n1", ownerId: "u-alice", title: "Alice private", body: "secret", visibility: "private", createdAt: "2026-03-01T10:00:00.000Z", updatedAt: "2026-03-01T10:00:00.000Z" },
  { id: "n2", ownerId: "u-alice", title: "Alice team", body: "shared", visibility: "team", createdAt: "2026-03-01T10:01:00.000Z", updatedAt: "2026-03-01T10:01:00.000Z" },
  { id: "n3", ownerId: "u-bob", title: "Bob private", body: "bob secret", visibility: "private", createdAt: "2026-03-01T10:02:00.000Z", updatedAt: "2026-03-01T10:02:00.000Z" },
  { id: "n4", ownerId: "u-bob", title: "Bob team", body: "bob shared", visibility: "team", createdAt: "2026-03-01T10:03:00.000Z", updatedAt: "2026-03-01T10:03:00.000Z" },
];

let app: Express;

beforeEach(() => {
  app = createApp(sampleNotes());
});

const patch = (token: string, id: string, body: Record<string, unknown>) =>
  request(app).patch(`/notes/${id}`).set(auth(token)).send(body);
const del = (token: string, id: string) => request(app).delete(`/notes/${id}`).set(auth(token));

describe("EXPRESS-013", () => {
  describe("PATCH /notes/:id", () => {
    it("lets the owner change one field and refreshes updatedAt", async () => {
      const res = await patch("token-alice", "n1", { visibility: "team" });
      expectStatus(res, 200, "Alice owns n1, so PATCH /notes/n1 must return 200.");
      expect(res.body, "Only visibility must change; id, ownerId, title, body and createdAt stay the same").toMatchObject({
        id: "n1", ownerId: "u-alice", title: "Alice private", body: "secret", visibility: "team", createdAt: "2026-03-01T10:00:00.000Z",
      });
      expect(Date.parse(res.body.updatedAt), "updatedAt must be set to the current time").toBeGreaterThan(Date.parse("2026-03-01T10:00:00.000Z"));
    });

    it("changes several fields and trims the title", async () => {
      const res = await patch("token-alice", "n1", { title: "  New title  ", body: "" });
      expectStatus(res, 200, "PATCH /notes/n1 as Alice must return 200.");
      expect(res.body, 'title must be saved trimmed, body "" is allowed').toMatchObject({ title: "New title", body: "", visibility: "private" });
    });

    it("ignores id, ownerId and createdAt sent by the client", async () => {
      const res = await patch("token-alice", "n1", { title: "X", id: "other", ownerId: "u-bob", createdAt: "2000-01-01T00:00:00.000Z" });
      expectStatus(res, 200, "PATCH /notes/n1 as Alice must return 200.");
      expect(res.body, "id, ownerId and createdAt must never change").toMatchObject({
        id: "n1", ownerId: "u-alice", createdAt: "2026-03-01T10:00:00.000Z",
      });
    });

    it("saves the change", async () => {
      await patch("token-alice", "n2", { title: "Renamed" });
      const res = await patch("token-alice", "n2", { body: "new body" });
      expect(res.body, "The title from the first PATCH must still be there after the second one").toMatchObject({ title: "Renamed", body: "new body" });
    });

    it("lets an admin change any note", async () => {
      const res = await patch("token-root", "n3", { title: "Edited" });
      expectStatus(res, 200, "Admins may change every note, so PATCH /notes/n3 as admin must return 200.");
      expect(res.body, "The title must change and ownerId must stay u-bob").toMatchObject({ title: "Edited", ownerId: "u-bob" });
    });

    it("returns 404 for a note the user can't see", async () => {
      expectError(await patch("token-bob", "n1", { title: "x" }), 404, "n1 is Alice's private note, so Bob must get 404 (not 403).");
    });

    it("returns 404 for an unknown id", async () => {
      expectError(await patch("token-alice", "xyz", { title: "x" }), 404, "There is no note xyz, so PATCH /notes/xyz must return 404.");
    });

    it("returns 403 for a visible note the user doesn't own, and changes nothing", async () => {
      expectError(await patch("token-bob", "n2", { title: "Hacked" }), 403, "n2 is Alice's team note: Bob can see it but not change it, so 403.");
      const check = await patch("token-alice", "n2", {});
      expect(check.body.title, "After the 403, n2 must still have its old title").toBe("Alice team");
    });

    it("checks permission (403) before validation (400)", async () => {
      expectError(await patch("token-bob", "n2", { title: "" }), 403, "Bob may not change n2, so he must get 403 even though the title is also invalid.");
    });

    it.each([
      [{ title: "" }],
      [{ title: "   " }],
      [{ title: "a".repeat(201) }],
      [{ body: 42 }],
      [{ body: "x".repeat(10001) }],
      [{ visibility: "public" }],
    ])("returns 400 for %j and changes nothing", async (body) => {
      // A valid visibility change is sent along with the invalid field: it must not be saved either.
      expectError(await patch("token-alice", "n1", { visibility: "team", ...body }), 400, `${JSON.stringify(body).slice(0, 60)} is invalid and must return 400.`);
      const check = await patch("token-alice", "n1", {});
      expect(check.body.visibility, "After a 400 nothing may change, also not the valid fields of the same request").toBe("private");
    });
  });

  describe("DELETE /notes/:id", () => {
    it("lets the owner delete a note: 204 with an empty body", async () => {
      const res = await del("token-alice", "n1");
      expectStatus(res, 204, "Alice owns n1, so DELETE /notes/n1 must return 204.");
      expect(res.text ?? "", "A 204 response must have an empty body").toBe("");
      expectError(await del("token-alice", "n1"), 404, "n1 was deleted, so deleting it again must return 404.");
    });

    it("removes only that note", async () => {
      await del("token-alice", "n1");
      expectStatus(await del("token-alice", "n2"), 204, "Deleting n1 must not remove n2.");
    });

    it("lets an admin delete any note", async () => {
      expectStatus(await del("token-root", "n3"), 204, "Admins may delete every note, so DELETE /notes/n3 as admin must return 204.");
    });

    it("returns 403 for a visible note the user doesn't own, and keeps it", async () => {
      expectError(await del("token-bob", "n2"), 403, "n2 is Alice's team note: Bob can see it but not delete it, so 403.");
      expectStatus(await del("token-alice", "n2"), 204, "After Bob's 403, n2 must still exist, so Alice can delete it.");
    });

    it("returns 404 for a note the user can't see or an unknown id", async () => {
      expectError(await del("token-bob", "n1"), 404, "n1 is Alice's private note, so Bob must get 404 (not 403).");
      expectError(await del("token-bob", "xyz"), 404, "There is no note xyz, so DELETE /notes/xyz must return 404.");
    });
  });
});
