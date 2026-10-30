import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client";
import {
  createAuthor,
  createBook,
  deleteAuthor,
  getAuthorWithBooks,
  listBooks,
  updateBook,
} from "../../src/postgresql-prisma/task1/task1";
import { ConflictError, NotFoundError, ValidationError } from "../../src/shared/errors";
import { createTestPrisma, truncate } from "../support/db";

let db: PrismaClient;

beforeAll(() => {
  db = createTestPrisma();
});

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(async () => {
  await truncate(db, ["Book", "Author"]);
});

// Test data is inserted directly with Prisma so that each test only depends on the function it checks.
async function seedAuthor(name = "Octavia Butler", email = `${name.toLowerCase().replace(/\W+/g, ".")}@example.com`) {
  return db.author.create({ data: { name, email } });
}

let isbnCounter = 0;
async function seedBook(authorId: number, title: string, publishedYear = 2000) {
  isbnCounter++;
  return db.book.create({
    data: { title, publishedYear, authorId, isbn: String(9780000000000 + isbnCounter) },
  });
}

async function expectRejects<T extends Error>(promise: Promise<unknown>, type: new (...args: never[]) => T): Promise<T> {
  let error: unknown;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  expect(error, `expected the call to throw ${type.name}`).toBeDefined();
  expect(error, `expected ${type.name}, received ${(error as Error)?.constructor?.name}: ${(error as Error)?.message}`).toBeInstanceOf(type);
  return error as T;
}

// The field names in the test tables only document which rule is broken; only the error class is checked.
async function expectValidation(promise: Promise<unknown>, ..._fields: string[]) {
  await expectRejects(promise, ValidationError);
}

const currentYear = new Date().getFullYear();

describe("PRISMA-001", () => {
  describe("createAuthor", () => {
    it("creates an author with a trimmed name and normalized email", async () => {
      const author = await createAuthor(db, { name: "  Ursula K. Le Guin ", email: " Ursula@Example.COM " });
      expect(author).toMatchObject({ name: "Ursula K. Le Guin", email: "ursula@example.com" });
      expect(typeof author.id).toBe("number");

      const stored = await db.author.findUnique({ where: { id: author.id } });
      expect(stored).toMatchObject({ name: "Ursula K. Le Guin", email: "ursula@example.com" });
    });

    it("accepts a 100-character name", async () => {
      await createAuthor(db, { name: "n".repeat(100), email: "long@example.com" });
    });

    it.each([
      [{ name: "", email: "a@example.com" }, ["name"]],
      [{ name: "   ", email: "a@example.com" }, ["name"]],
      [{ name: "n".repeat(101), email: "a@example.com" }, ["name"]],
      [{ name: "Valid", email: "not-an-email" }, ["email"]],
      [{ name: "Valid", email: "a b@example.com" }, ["email"]],
      [{ name: "Valid", email: "a@example" }, ["email"]],
      [{ name: " ", email: "nope" }, ["name", "email"]],
    ])("rejects invalid input %j", async (input, fields) => {
      await expectValidation(createAuthor(db, input), ...fields);
      expect(await db.author.count()).toBe(0);
    });

    it("rejects a duplicate email regardless of case with ConflictError", async () => {
      await createAuthor(db, { name: "First", email: "dup@example.com" });
      await expectRejects(createAuthor(db, { name: "Second", email: "DUP@example.com" }), ConflictError);
      expect(await db.author.count()).toBe(1);
    });

  });

  describe("createBook", () => {
    it("creates a book with a normalized ISBN and trimmed title", async () => {
      const author = await seedAuthor();
      const book = await createBook(db, {
        title: "  Kindred ",
        isbn: "978-0-80-708369-7",
        publishedYear: 1979,
        authorId: author.id,
      });
      expect(book).toMatchObject({ title: "Kindred", isbn: "9780807083697", publishedYear: 1979, authorId: author.id });
      expect(await db.book.count()).toBe(1);
    });

    it("removes spaces from the ISBN", async () => {
      const author = await seedAuthor();
      const book = await createBook(db, { title: "Dawn", isbn: "978 0 44 660378 1", publishedYear: 1987, authorId: author.id });
      expect(book.isbn).toBe("9780446603781");
    });

    it("throws NotFoundError for a missing author and writes nothing", async () => {
      await expectRejects(
        createBook(db, { title: "Orphan", isbn: "9780000000001", publishedYear: 2001, authorId: 999_999 }),
        NotFoundError,
      );
      expect(await db.book.count()).toBe(0);
    });

    it("rejects a duplicate ISBN even with different formatting", async () => {
      const author = await seedAuthor();
      await createBook(db, { title: "One", isbn: "9781234567897", publishedYear: 2001, authorId: author.id });
      await expectRejects(
        createBook(db, { title: "Two", isbn: "978-1-234-56789-7", publishedYear: 2002, authorId: author.id }),
        ConflictError,
      );
      expect(await db.book.count()).toBe(1);
    });

    it("accepts the boundary years 1450 and the current year", async () => {
      const author = await seedAuthor();
      await createBook(db, { title: "Old", isbn: "9780000000101", publishedYear: 1450, authorId: author.id });
      await createBook(db, { title: "New", isbn: "9780000000102", publishedYear: currentYear, authorId: author.id });
      expect(await db.book.count()).toBe(2);
    });

    it.each([
      [{ title: "", isbn: "9780000000001", publishedYear: 2000 }, ["title"]],
      [{ title: "t".repeat(201), isbn: "9780000000001", publishedYear: 2000 }, ["title"]],
      [{ title: "Short ISBN", isbn: "978000000000", publishedYear: 2000 }, ["isbn"]],
      [{ title: "Letters", isbn: "978000000000X", publishedYear: 2000 }, ["isbn"]],
      [{ title: "Too early", isbn: "9780000000001", publishedYear: 1449 }, ["publishedYear"]],
      [{ title: "Future", isbn: "9780000000001", publishedYear: currentYear + 1 }, ["publishedYear"]],
      [{ title: "Fraction", isbn: "9780000000001", publishedYear: 2000.5 }, ["publishedYear"]],
      [{ title: " ", isbn: "123", publishedYear: 2000 }, ["title", "isbn"]],
    ])("rejects invalid input %j", async (input, fields) => {
      const author = await seedAuthor();
      await expectValidation(createBook(db, { ...input, authorId: author.id }), ...fields);
      expect(await db.book.count()).toBe(0);
    });
  });

  describe("getAuthorWithBooks", () => {
    it("returns the author with books ordered by year descending, then title", async () => {
      const author = await seedAuthor();
      await seedBook(author.id, "Wild Seed", 1980);
      await seedBook(author.id, "Kindred", 1979);
      await seedBook(author.id, "Adulthood Rites", 1988);
      await seedBook(author.id, "Dawn", 1988);
      const other = await seedAuthor("Someone Else");
      await seedBook(other.id, "Unrelated", 1990);

      const result = await getAuthorWithBooks(db, author.id);
      expect(result).toMatchObject({ id: author.id, name: author.name, email: author.email });
      expect(result.books.map((b) => b.title)).toEqual(["Adulthood Rites", "Dawn", "Wild Seed", "Kindred"]);
    });

    it("returns an empty books array for an author without books", async () => {
      const author = await seedAuthor();
      expect((await getAuthorWithBooks(db, author.id)).books).toEqual([]);
    });

    it("throws NotFoundError for a missing author", async () => {
      await expectRejects(getAuthorWithBooks(db, 424_242), NotFoundError);
    });
  });

  describe("listBooks", () => {
    async function seedCatalog() {
      const butler = await seedAuthor("Octavia Butler");
      const leGuin = await seedAuthor("Ursula Le Guin");
      const titles: Array<[number, string]> = [
        [butler.id, "Kindred"],
        [leGuin.id, "The Left Hand of Darkness"],
        [butler.id, "Parable of the Sower"],
        [leGuin.id, "The Dispossessed"],
        [butler.id, "Parable of the Talents"],
        [leGuin.id, "A Wizard of Earthsea"],
        [butler.id, "Dawn"],
      ];
      const books = [];
      for (const [authorId, title] of titles) books.push(await seedBook(authorId, title));
      return { butler, leGuin, books };
    }

    it("returns the first page ordered by id with default page size", async () => {
      const { books } = await seedCatalog();
      const result = await listBooks(db, {});
      expect(result).toMatchObject({ total: 7, page: 1, pageSize: 10, totalPages: 1 });
      expect(result.items.map((b) => b.id)).toEqual(books.map((b) => b.id));
    });

    it("includes only the author's id and name on each item", async () => {
      const { butler } = await seedCatalog();
      const result = await listBooks(db, { pageSize: 1 });
      expect(result.items[0]!.author).toEqual({ id: butler.id, name: "Octavia Butler" });
      expect(JSON.stringify(result)).not.toContain("@example.com");
    });

    it("paginates in the database", async () => {
      const { books } = await seedCatalog();
      const page2 = await listBooks(db, { page: 2, pageSize: 3 });
      expect(page2).toMatchObject({ total: 7, page: 2, pageSize: 3, totalPages: 3 });
      expect(page2.items.map((b) => b.id)).toEqual(books.slice(3, 6).map((b) => b.id));

      const page3 = await listBooks(db, { page: 3, pageSize: 3 });
      expect(page3.items.map((b) => b.title)).toEqual(["Dawn"]);
    });

    it("returns an empty page beyond the last page", async () => {
      await seedCatalog();
      const result = await listBooks(db, { page: 5, pageSize: 3 });
      expect(result.items).toEqual([]);
      expect(result).toMatchObject({ total: 7, totalPages: 3 });
    });

    it("filters by author", async () => {
      const { leGuin } = await seedCatalog();
      const result = await listBooks(db, { authorId: leGuin.id });
      expect(result.total).toBe(3);
      expect(result.items.every((b) => b.authorId === leGuin.id)).toBe(true);
    });

    it("searches titles case-insensitively and trims the search text", async () => {
      await seedCatalog();
      const result = await listBooks(db, { search: "  PARABLE " });
      expect(result.items.map((b) => b.title)).toEqual(["Parable of the Sower", "Parable of the Talents"]);
      expect(result.total).toBe(2);
    });

    it("treats a whitespace-only search as no filter", async () => {
      await seedCatalog();
      expect((await listBooks(db, { search: "   " })).total).toBe(7);
    });

    it("combines author and search filters", async () => {
      const { leGuin } = await seedCatalog();
      const result = await listBooks(db, { authorId: leGuin.id, search: "the" });
      expect(result.items.map((b) => b.title)).toEqual(["The Left Hand of Darkness", "The Dispossessed"]);
    });

    it("returns zero pages when nothing matches", async () => {
      await seedCatalog();
      expect(await listBooks(db, { search: "nothing like this" })).toMatchObject({ items: [], total: 0, totalPages: 0 });
    });

    it.each([
      [{ page: 0 }, "page"],
      [{ page: 1.5 }, "page"],
      [{ pageSize: 0 }, "pageSize"],
      [{ pageSize: 51 }, "pageSize"],
    ])("rejects invalid pagination %j", async (query, field) => {
      await expectValidation(listBooks(db, query), field);
    });
  });

  describe("updateBook", () => {
    it("updates only the provided fields", async () => {
      const author = await seedAuthor();
      const book = await seedBook(author.id, "Original", 1990);
      const updated = await updateBook(db, book.id, { title: "  Revised ", publishedYear: 1991 });
      expect(updated).toMatchObject({ id: book.id, title: "Revised", publishedYear: 1991, isbn: book.isbn, authorId: author.id });
      expect(await db.book.findUnique({ where: { id: book.id } })).toMatchObject({ title: "Revised", publishedYear: 1991 });
    });

    it("moves a book to another author", async () => {
      const a = await seedAuthor("Author A");
      const b = await seedAuthor("Author B");
      const book = await seedBook(a.id, "Movable");
      expect((await updateBook(db, book.id, { authorId: b.id })).authorId).toBe(b.id);
    });

    it("throws NotFoundError for a missing target author and leaves the book unchanged", async () => {
      const author = await seedAuthor();
      const book = await seedBook(author.id, "Stays");
      await expectRejects(updateBook(db, book.id, { authorId: 987_654, title: "Changed" }), NotFoundError);
      expect(await db.book.findUnique({ where: { id: book.id } })).toMatchObject({ authorId: author.id, title: "Stays" });
    });

    it("throws NotFoundError for a missing book", async () => {
      await expectRejects(updateBook(db, 123_456, { title: "Ghost" }), NotFoundError);
    });

    it("rejects an empty change set and invalid values", async () => {
      const author = await seedAuthor();
      const book = await seedBook(author.id, "Valid");
      await expectRejects(updateBook(db, book.id, {}), ValidationError);
      await expectValidation(updateBook(db, book.id, { title: "", publishedYear: 1000 }), "title", "publishedYear");
      expect(await db.book.findUnique({ where: { id: book.id } })).toMatchObject({ title: "Valid" });
    });
  });

  describe("deleteAuthor", () => {
    it("deletes an author without books", async () => {
      const author = await seedAuthor();
      await deleteAuthor(db, author.id);
      expect(await db.author.findUnique({ where: { id: author.id } })).toBeNull();
    });

    it("refuses to delete an author who still has books", async () => {
      const author = await seedAuthor();
      await seedBook(author.id, "Keeps the author alive");
      await expectRejects(deleteAuthor(db, author.id), ConflictError);
      expect(await db.author.count()).toBe(1);
      expect(await db.book.count()).toBe(1);
    });

    it("throws NotFoundError for a missing author", async () => {
      await expectRejects(deleteAuthor(db, 555_555), NotFoundError);
    });
  });

});
