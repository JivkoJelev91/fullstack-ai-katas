import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type Note } from "../../src/express/task11/task11";
import { expectError, expectStatus } from "../support/http";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const sampleNotes = (): Note[] => [
  { id: "n1", ownerId: "u-alice", title: "Alice private", body: "secret", visibility: "private", createdAt: "2026-03-01T10:00:00.000Z", updatedAt: "2026-03-01T10:00:00.000Z" },
  { id: "n2", ownerId: "u-alice", title: "Alice team", body: "shared", visibility: "team", createdAt: "2026-03-01T10:01:00.000Z", updatedAt: "2026-03-01T10:01:00.000Z" },
  { id: "n3", ownerId: "u-bob", title: "Bob private", body: "bob secret", visibility: "private", createdAt: "2026-03-01T10:02:00.000Z", updatedAt: "2026-03-01T10:02:00.000Z" },
  { id: "n4", ownerId: "u-bob", title: "Bob team", body: "bob shared", visibility: "team", createdAt: "2026-03-01T10:03:00.000Z", updatedAt: "2026-03-01T10:03:00.000Z" },
];

const isIsoDate = (value: unknown) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;

describe("EXPRESS-011", () => {
  describe("POST /notes", () => {
    it("returns 201 and the new note owned by the logged-in user", async () => {
      const res = await request(createApp()).post("/notes").set(auth("token-alice")).send({ title: "Plan", body: "Draft", visibility: "team" });
      expectStatus(res, 201, "POST /notes with a valid body must return 201.");
      expect(res.body, "The note must have ownerId u-alice and the sent title, body and visibility").toMatchObject({
        ownerId: "u-alice", title: "Plan", body: "Draft", visibility: "team",
      });
      expect(typeof res.body.id, "id must be a string").toBe("string");
      expect(isIsoDate(res.body.createdAt), "createdAt must be an ISO date string, e.g. new Date().toISOString()").toBe(true);
      expect(res.body.updatedAt, "updatedAt must be the same as createdAt").toBe(res.body.createdAt);
    });

    it("trims the title and uses visibility 'private' by default", async () => {
      const res = await request(createApp()).post("/notes").set(auth("token-bob")).send({ title: "  Plan  ", body: "" });
      expectStatus(res, 201, "POST /notes with an empty body text must return 201.");
      expect(res.body, 'title must be saved trimmed, body "" is allowed, visibility defaults to "private"').toMatchObject({
        ownerId: "u-bob", title: "Plan", body: "", visibility: "private",
      });
    });

    it("ignores id and ownerId sent by the client", async () => {
      const res = await request(createApp()).post("/notes").set(auth("token-alice")).send({ title: "Mine", body: "x", id: "custom", ownerId: "u-bob" });
      expectStatus(res, 201, "POST /notes must return 201.");
      expect(res.body.ownerId, "ownerId must come from the logged-in user, not from the body").toBe("u-alice");
      expect(res.body.id, "id must be created by the server, not taken from the body").not.toBe("custom");
    });

    it("gives every note a different id", async () => {
      const app = createApp();
      const a = await request(app).post("/notes").set(auth("token-alice")).send({ title: "A", body: "" });
      const b = await request(app).post("/notes").set(auth("token-alice")).send({ title: "B", body: "" });
      expect(a.body.id, "Two notes must not have the same id").not.toBe(b.body.id);
    });

    it.each([
      [{ body: "no title" }],
      [{ title: "   ", body: "x" }],
      [{ title: 42, body: "x" }],
      [{ title: "a".repeat(201), body: "x" }],
      [{ title: "No body" }],
      [{ title: "Long", body: "x".repeat(10001) }],
      [{ title: "Bad", body: "x", visibility: "public" }],
    ])("returns 400 for %j", async (body) => {
      const res = await request(createApp()).post("/notes").set(auth("token-alice")).send(body);
      expectError(res, 400, `${JSON.stringify(body).slice(0, 60)} is invalid and must return 400.`);
    });

    it("saves nothing when the body is invalid", async () => {
      const app = createApp();
      await request(app).post("/notes").set(auth("token-alice")).send({ title: "" });
      const res = await request(app).get("/notes").set(auth("token-alice"));
      expect(res.body, 'After an invalid POST, GET /notes must return { "data": [] }').toEqual({ data: [] });
    });
  });

  describe("GET /notes", () => {
    it("returns only the logged-in user's notes, in the order they were added", async () => {
      const res = await request(createApp(sampleNotes())).get("/notes").set(auth("token-bob"));
      expectStatus(res, 200, "GET /notes must return 200.");
      expect(res.body, "Bob must get only his notes n3 and n4, not Alice's team note").toEqual({ data: sampleNotes().slice(2) });
    });

    it("returns { data: [] } for a user without notes", async () => {
      const res = await request(createApp(sampleNotes())).get("/notes").set(auth("token-root"));
      expectStatus(res, 200, "GET /notes must return 200.");
      expect(res.body, 'u-root has no notes, so the body must be { "data": [] }').toEqual({ data: [] });
    });

    it("includes a note created with POST /notes", async () => {
      const app = createApp(sampleNotes());
      const created = await request(app).post("/notes").set(auth("token-alice")).send({ title: "New", body: "x" });
      const res = await request(app).get("/notes").set(auth("token-alice"));
      expect(res.body.data?.map((n: Note) => n.title), "Alice's notes must be n1, n2 and then the new one").toEqual(["Alice private", "Alice team", "New"]);
      expect(res.body.data?.[2], "The listed note must be the same object POST returned").toEqual(created.body);
    });
  });
});
