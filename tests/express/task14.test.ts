import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type Note } from "../../src/express/task14/task14";
import { expectError, expectStatus } from "../support/http";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const note = (id: string, ownerId: string, visibility: Note["visibility"]): Note => ({
  id,
  ownerId,
  title: `Note ${id}`,
  body: "",
  visibility,
  createdAt: "2026-03-01T10:00:00.000Z",
  updatedAt: "2026-03-01T10:00:00.000Z",
});

const sampleNotes = (): Note[] => [
  note("n1", "u-alice", "private"),
  note("n2", "u-alice", "team"),
  note("n3", "u-bob", "private"),
  note("n4", "u-bob", "team"),
  note("n5", "u-alice", "private"),
];

describe("EXPRESS-014", () => {
  describe("GET /admin/stats", () => {
    it("returns the counts for an admin", async () => {
      const res = await request(createApp(sampleNotes())).get("/admin/stats").set(auth("token-root"));
      expectStatus(res, 200, "GET /admin/stats as admin must return 200.");
      expect(res.body, "5 notes: 3 private, 2 team; u-alice has 3, u-bob has 2").toEqual({
        totalNotes: 5, private: 3, team: 2, byOwner: { "u-alice": 3, "u-bob": 2 },
      });
    });

    it("returns zeros and an empty byOwner when there are no notes", async () => {
      const res = await request(createApp([])).get("/admin/stats").set(auth("token-root"));
      expectStatus(res, 200, "GET /admin/stats as admin must return 200.");
      expect(res.body, 'With no notes the body must be { "totalNotes": 0, "private": 0, "team": 0, "byOwner": {} }').toEqual({
        totalNotes: 0, private: 0, team: 0, byOwner: {},
      });
    });

    it("counts only the notes that exist", async () => {
      const res = await request(createApp([note("n9", "u-root", "team")])).get("/admin/stats").set(auth("token-root"));
      expect(res.body, 'One team note by u-root: { "totalNotes": 1, "private": 0, "team": 1, "byOwner": { "u-root": 1 } }').toEqual({
        totalNotes: 1, private: 0, team: 1, byOwner: { "u-root": 1 },
      });
    });

    it("returns 403 for members", async () => {
      const app = createApp(sampleNotes());
      expectError(await request(app).get("/admin/stats").set(auth("token-alice")), 403, "Alice is a member, so GET /admin/stats must return 403.");
      expectError(await request(app).get("/admin/stats").set(auth("token-bob")), 403, "Bob is a member, so GET /admin/stats must return 403.");
    });
  });
});
