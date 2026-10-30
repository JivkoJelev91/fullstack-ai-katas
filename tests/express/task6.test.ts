import type { Express } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type AuthUser, type TokenVerifier } from "../../src/express/task6/task6";

const USERS: Record<string, AuthUser> = {
  "token-alice": { id: "u-alice", role: "member" },
  "token-bob": { id: "u-bob", role: "member" },
  "token-root": { id: "u-root", role: "admin" },
};

type Note = {
  id: string;
  ownerId: string;
  title: string;
  body: string;
  visibility: "private" | "team";
  createdAt: string;
  updatedAt: string;
};

let app: Express;
let verify: ReturnType<typeof vi.fn<TokenVerifier["verify"]>>;

beforeEach(() => {
  verify = vi.fn<TokenVerifier["verify"]>(async (token) => USERS[token] ?? null);
  app = createApp({ tokens: { verify } });
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createNote(token: string, body: Record<string, unknown>): Promise<Note> {
  const res = await request(app).post("/notes").set(auth(token)).send(body);
  expect(res.status, `POST /notes should succeed, got ${JSON.stringify(res.body)}`).toBe(201);
  return res.body as Note;
}

async function seed() {
  const alicePrivate = await createNote("token-alice", { title: "Alice private", body: "secret", visibility: "private" });
  const aliceTeam = await createNote("token-alice", { title: "Alice team", body: "shared", visibility: "team" });
  const bobPrivate = await createNote("token-bob", { title: "Bob private", body: "bob secret" });
  const bobTeam = await createNote("token-bob", { title: "Bob team", body: "bob shared", visibility: "team" });
  return { alicePrivate, aliceTeam, bobPrivate, bobTeam };
}

function expectError(res: request.Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(res.body?.error?.code).toBe(code);
  expect(typeof res.body.error.message).toBe("string");
}

const isIsoDate = (value: unknown) =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;

describe("EXPRESS-006", () => {
  describe("GET /health", () => {
    it("works without a token", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: "ok" });
    });
  });

  describe("Login", () => {
    it("returns 401 without an Authorization header and does not call verify", async () => {
      expectError(await request(app).get("/notes"), 401, "UNAUTHENTICATED");
      expect(verify).not.toHaveBeenCalled();
    });

    it("returns 401 for a header that is not 'Bearer <token>'", async () => {
      for (const header of ["Basic abc", "Bearer", "token-alice"]) {
        expectError(await request(app).get("/notes").set("Authorization", header), 401, "UNAUTHENTICATED");
      }
      expect(verify).not.toHaveBeenCalled();
    });

    it("passes only the token to verify", async () => {
      await request(app).get("/notes").set(auth("token-alice")).expect(200);
      expect(verify).toHaveBeenCalledWith("token-alice");
    });

    it("returns 401 when verify returns null", async () => {
      expectError(await request(app).get("/notes").set(auth("expired")), 401, "UNAUTHENTICATED");
    });

    it("returns 503 without the original message when verify throws", async () => {
      const down = createApp({ tokens: { verify: async () => Promise.reject(new Error("idp.internal timeout")) } });
      const res = await request(down).get("/notes").set(auth("token-alice"));
      expectError(res, 503, "AUTH_UNAVAILABLE");
      expect(res.text).not.toContain("idp.internal");
    });

    it("protects /admin routes too", async () => {
      expectError(await request(app).get("/admin/stats"), 401, "UNAUTHENTICATED");
    });
  });

  describe("POST /notes", () => {
    it("creates a note owned by the logged-in user with defaults", async () => {
      const res = await request(app).post("/notes").set(auth("token-alice")).send({ title: "  Plan  ", body: "Draft" });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ ownerId: "u-alice", title: "Plan", body: "Draft", visibility: "private" });
      expect(typeof res.body.id).toBe("string");
      expect(isIsoDate(res.body.createdAt)).toBe(true);
      expect(res.body.updatedAt).toBe(res.body.createdAt);
    });

    it("ignores ownerId and id sent by the client", async () => {
      const note = await createNote("token-alice", { title: "Mine", body: "", ownerId: "u-bob", id: "custom" });
      expect(note.ownerId).toBe("u-alice");
      expect(note.id).not.toBe("custom");
    });

    it.each([
      [{ body: "no title" }],
      [{ title: "   ", body: "x" }],
      [{ title: "a".repeat(201), body: "x" }],
      [{ title: "No body" }],
      [{ title: "Long", body: "x".repeat(10001) }],
      [{ title: "Bad", body: "x", visibility: "public" }],
    ])("rejects %j", async (body) => {
      expectError(await request(app).post("/notes").set(auth("token-alice")).send(body), 400, "VALIDATION_ERROR");
    });
  });

  describe("Seeing notes", () => {
    it("members see their own notes and team notes, oldest first", async () => {
      await seed();
      const res = await request(app).get("/notes").set(auth("token-bob"));
      expect(res.status).toBe(200);
      expect((res.body.data as Note[]).map((n) => n.title)).toEqual(["Alice team", "Bob private", "Bob team"]);
    });

    it("admins see all notes", async () => {
      await seed();
      const res = await request(app).get("/notes").set(auth("token-root"));
      expect((res.body.data as Note[]).map((n) => n.title)).toEqual([
        "Alice private",
        "Alice team",
        "Bob private",
        "Bob team",
      ]);
    });

    it("returns a note the user can see", async () => {
      const { aliceTeam } = await seed();
      const res = await request(app).get(`/notes/${aliceTeam.id}`).set(auth("token-bob"));
      expect(res.status).toBe(200);
      expect(res.body).toEqual(aliceTeam);
    });

    it("returns 404 for another user's private note", async () => {
      const { alicePrivate } = await seed();
      expectError(await request(app).get(`/notes/${alicePrivate.id}`).set(auth("token-bob")), 404, "NOT_FOUND");
    });

    it("returns 404 for an unknown id", async () => {
      expectError(await request(app).get("/notes/missing").set(auth("token-alice")), 404, "NOT_FOUND");
    });
  });

  describe("PATCH /notes/:id", () => {
    it("lets the owner change fields and refreshes updatedAt", async () => {
      const { alicePrivate } = await seed();
      await new Promise((resolve) => setTimeout(resolve, 5));
      const res = await request(app)
        .patch(`/notes/${alicePrivate.id}`)
        .set(auth("token-alice"))
        .send({ visibility: "team", ownerId: "u-bob" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ visibility: "team", ownerId: "u-alice", title: "Alice private" });
      expect(Date.parse(res.body.updatedAt)).toBeGreaterThan(Date.parse(alicePrivate.updatedAt));
    });

    it("lets an admin change any note", async () => {
      const { bobPrivate } = await seed();
      const res = await request(app).patch(`/notes/${bobPrivate.id}`).set(auth("token-root")).send({ title: "Edited" });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe("Edited");
      expect(res.body.ownerId).toBe("u-bob");
    });

    it("returns 403 when a member edits a team note they don't own", async () => {
      const { aliceTeam } = await seed();
      const res = await request(app).patch(`/notes/${aliceTeam.id}`).set(auth("token-bob")).send({ title: "Hacked" });
      expectError(res, 403, "FORBIDDEN");
      const check = await request(app).get(`/notes/${aliceTeam.id}`).set(auth("token-alice"));
      expect(check.body.title).toBe("Alice team");
    });

    it("returns 404 (not 403) for another user's private note", async () => {
      const { alicePrivate } = await seed();
      const res = await request(app).patch(`/notes/${alicePrivate.id}`).set(auth("token-bob")).send({ title: "x" });
      expectError(res, 404, "NOT_FOUND");
    });

    it("returns 400 for invalid values", async () => {
      const { alicePrivate } = await seed();
      const res = await request(app).patch(`/notes/${alicePrivate.id}`).set(auth("token-alice")).send({ title: "" });
      expectError(res, 400, "VALIDATION_ERROR");
    });

    it("checks permission (403) before validation (400)", async () => {
      const { aliceTeam } = await seed();
      const res = await request(app).patch(`/notes/${aliceTeam.id}`).set(auth("token-bob")).send({ title: "" });
      expectError(res, 403, "FORBIDDEN");
    });
  });

  describe("DELETE /notes/:id", () => {
    it("lets the owner delete a note", async () => {
      const { alicePrivate } = await seed();
      const res = await request(app).delete(`/notes/${alicePrivate.id}`).set(auth("token-alice"));
      expect(res.status).toBe(204);
      expect(res.text ?? "").toBe("");
      expectError(await request(app).get(`/notes/${alicePrivate.id}`).set(auth("token-alice")), 404, "NOT_FOUND");
    });

    it("lets an admin delete any note", async () => {
      const { bobPrivate } = await seed();
      expect((await request(app).delete(`/notes/${bobPrivate.id}`).set(auth("token-root"))).status).toBe(204);
    });

    it("returns 403 for a visible note the user doesn't own and 404 for a hidden one", async () => {
      const { aliceTeam, alicePrivate } = await seed();
      expectError(await request(app).delete(`/notes/${aliceTeam.id}`).set(auth("token-bob")), 403, "FORBIDDEN");
      expectError(await request(app).delete(`/notes/${alicePrivate.id}`).set(auth("token-bob")), 404, "NOT_FOUND");
    });
  });

  describe("GET /admin/stats", () => {
    it("returns counts for admins", async () => {
      await seed();
      const res = await request(app).get("/admin/stats").set(auth("token-root"));
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ totalNotes: 4, private: 2, team: 2 });
    });

    it("returns zeros when there are no notes", async () => {
      const res = await request(app).get("/admin/stats").set(auth("token-root"));
      expect(res.body).toEqual({ totalNotes: 0, private: 0, team: 0 });
    });

    it("returns 403 for members", async () => {
      expectError(await request(app).get("/admin/stats").set(auth("token-alice")), 403, "FORBIDDEN");
    });
  });

  it("keeps notes separate between app instances", async () => {
    await seed();
    const other = createApp({ tokens: { verify } });
    const res = await request(other).get("/notes").set(auth("token-root"));
    expect(res.body).toEqual({ data: [] });
  });
});
