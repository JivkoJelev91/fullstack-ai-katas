import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type Note } from "../../src/express/task12/task12";
import { expectError, expectStatus } from "../support/http";

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const sampleNotes = (): Note[] => [
  { id: "n1", ownerId: "u-alice", title: "Alice private", body: "secret", visibility: "private", createdAt: "2026-03-01T10:00:00.000Z", updatedAt: "2026-03-01T10:00:00.000Z" },
  { id: "n2", ownerId: "u-alice", title: "Alice team", body: "shared", visibility: "team", createdAt: "2026-03-01T10:01:00.000Z", updatedAt: "2026-03-01T10:01:00.000Z" },
  { id: "n3", ownerId: "u-bob", title: "Bob private", body: "bob secret", visibility: "private", createdAt: "2026-03-01T10:02:00.000Z", updatedAt: "2026-03-01T10:02:00.000Z" },
  { id: "n4", ownerId: "u-bob", title: "Bob team", body: "bob shared", visibility: "team", createdAt: "2026-03-01T10:03:00.000Z", updatedAt: "2026-03-01T10:03:00.000Z" },
];

const ids = (res: request.Response) => (res.body.data as Note[] | undefined)?.map((n) => n.id);

async function list(token: string) {
  const res = await request(createApp(sampleNotes())).get("/notes").set(auth(token));
  expectStatus(res, 200, "GET /notes must return 200.");
  return res;
}

const getOne = (token: string, id: string) => request(createApp(sampleNotes())).get(`/notes/${id}`).set(auth(token));

describe("EXPRESS-012", () => {
  describe("GET /notes", () => {
    it("a member sees own notes and team notes, in the order they were added", async () => {
      expect(ids(await list("token-bob")), "Bob must see n2 (team), n3 (his), n4 (his)").toEqual(["n2", "n3", "n4"]);
      expect(ids(await list("token-alice")), "Alice must see n1 (hers), n2 (hers), n4 (team)").toEqual(["n1", "n2", "n4"]);
    });

    it("an admin sees all notes", async () => {
      const res = await list("token-root");
      expect(res.body, 'The admin must get { "data": [n1, n2, n3, n4] } with the full note objects').toEqual({ data: sampleNotes() });
    });

    it("returns { data: [] } when there are no notes", async () => {
      const res = await request(createApp([])).get("/notes").set(auth("token-alice"));
      expectStatus(res, 200, "GET /notes must return 200.");
      expect(res.body, 'The body must be { "data": [] }').toEqual({ data: [] });
    });
  });

  describe("GET /notes/:id", () => {
    it("returns the user's own private note", async () => {
      const res = await getOne("token-alice", "n1");
      expectStatus(res, 200, "Alice owns n1, so GET /notes/n1 must return 200.");
      expect(res.body, "The body must be the full n1 note").toEqual(sampleNotes()[0]);
    });

    it("returns another user's team note", async () => {
      const res = await getOne("token-bob", "n2");
      expectStatus(res, 200, "n2 is a team note, so Bob may read it.");
      expect(res.body, "The body must be the full n2 note").toEqual(sampleNotes()[1]);
    });

    it("returns any note to an admin", async () => {
      const res = await getOne("token-root", "n3");
      expectStatus(res, 200, "Admins may read every note, so GET /notes/n3 as admin must return 200.");
      expect(res.body.id, "The body must be note n3").toBe("n3");
    });

    it("returns 404 for another user's private note", async () => {
      expectError(await getOne("token-bob", "n1"), 404, "n1 is Alice's private note, so Bob must get 404.");
    });

    it("returns 404 for an unknown id", async () => {
      expectError(await getOne("token-alice", "xyz"), 404, "There is no note xyz, so GET /notes/xyz must return 404.");
    });
  });
});
