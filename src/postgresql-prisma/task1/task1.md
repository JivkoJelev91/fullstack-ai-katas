# Library Catalog Data Access Layer

**Task ID:** PRISMA-001 · **Level:** 1 · **File:** `src/postgresql-prisma/task1/task1.ts` · **Tests:** `npm run test:prisma:1`

Write 6 functions that read and write authors and books with Prisma.

## Setup

- The tables `Author` and `Book` already exist in `prisma/schema.prisma`. An author has many books.
- Each function gets a `PrismaClient` as `db`. Use it, and don't create your own client.
- The tests need a test database. See "Database setup" in `README.md` (check it with `npm run db:test:check`).

## The records

| Author      | Who sets it                                  |
| ----------- | -------------------------------------------- |
| `id`        | Database (auto-increment)                    |
| `name`      | You (trimmed)                                |
| `email`     | You (trimmed + lower-cased), unique          |
| `createdAt` | Database (`@default(now())`)                 |

| Book            | Who sets it                                |
| --------------- | ------------------------------------------ |
| `id`            | Database (auto-increment)                  |
| `title`         | You (trimmed)                              |
| `isbn`          | You (hyphens and spaces removed), unique   |
| `publishedYear` | You                                        |
| `authorId`      | You                                        |
| `createdAt`     | Database                                   |

## Errors

Throw these classes from `src/shared/errors.ts`:

| Error           | When                                                   |
| --------------- | ------------------------------------------------------ |
| `ValidationError` | Input breaks a rule                                   |
| `NotFoundError`   | The author or book doesn't exist                      |
| `ConflictError`   | Duplicate email or ISBN, or deleting an author who still has books |

Don't let raw Prisma errors escape, and don't write anything to the database when you throw.

## Validation

| Field           | Rule                                                 |
| --------------- | ---------------------------------------------------- |
| `name`          | 1–100 characters after trimming                      |
| `email`         | looks like `local@domain.tld`, no spaces             |
| `title`         | 1–200 characters after trimming                      |
| `isbn`          | exactly 13 digits after removing hyphens and spaces  |
| `publishedYear` | integer from 1450 to the current year                |
| `page`          | integer ≥ 1 (default `1`)                            |
| `pageSize`      | integer 1–50 (default `10`)                          |

## Functions

| Function | Returns | Throws |
| -------- | ------- | ------ |
| `createAuthor(db, { name, email })` | the new `Author` | `ValidationError`, `ConflictError` (email taken) |
| `createBook(db, { title, isbn, publishedYear, authorId })` | the new `Book` | `ValidationError`, `NotFoundError` (no author), `ConflictError` (ISBN taken) |
| `getAuthorWithBooks(db, authorId)` | the author + `books` array, sorted by `publishedYear` descending, then `title` A→Z | `NotFoundError` |
| `listBooks(db, { authorId?, search?, page?, pageSize? })` | `{ items, total, page, pageSize, totalPages }` | `ValidationError` (bad page/pageSize) |
| `updateBook(db, bookId, { title?, publishedYear?, authorId? })` | the updated `Book` | `ValidationError` (bad value, or no fields given), `NotFoundError` (no book or no author) |
| `deleteAuthor(db, authorId)` | nothing | `NotFoundError`, `ConflictError` (author still has books) |

**`listBooks` details:**
- `authorId` keeps only that author's books.
- `search` keeps books whose title contains the text, ignoring case. It is trimmed first, and blank means no filter.
- Items are sorted by `id` ascending. Each item is a `Book` plus `author: { id, name }`, without the email.
- `total` is the number of matching books. `totalPages` is `Math.ceil(total / pageSize)`.
- Use `skip`/`take` so the database does the paging.

## Examples

**createAuthor**

```ts
await createAuthor(db, { name: "  Ursula K. Le Guin ", email: " Ursula@Example.COM " });
// → { id: 1, name: "Ursula K. Le Guin", email: "ursula@example.com", createdAt: Date }

await createAuthor(db, { name: "Someone", email: "URSULA@example.com" });
// → throws ConflictError

await createAuthor(db, { name: "", email: "nope" });
// → throws ValidationError
```

**createBook**

```ts
await createBook(db, { title: "The Dispossessed", isbn: "978-0-06-051275-4", publishedYear: 1974, authorId: 1 });
// → { id: 1, title: "The Dispossessed", isbn: "9780060512754", publishedYear: 1974, authorId: 1, createdAt: Date }

await createBook(db, { title: "Ghost", isbn: "9780000000001", publishedYear: 2000, authorId: 999 });
// → throws NotFoundError
```

**getAuthorWithBooks**

```ts
await getAuthorWithBooks(db, 1);
// → { id: 1, name: "Ursula K. Le Guin", email: "ursula@example.com", createdAt: Date,
//     books: [ { id: 1, title: "The Dispossessed", isbn: "9780060512754", publishedYear: 1974, authorId: 1, createdAt: Date } ] }

await getAuthorWithBooks(db, 999);
// → throws NotFoundError
```

**listBooks**

```ts
await listBooks(db, { search: "dispo", pageSize: 5 });
// → { items: [ { id: 1, title: "The Dispossessed", isbn: "9780060512754", publishedYear: 1974, authorId: 1,
//                createdAt: Date, author: { id: 1, name: "Ursula K. Le Guin" } } ],
//     total: 1, page: 1, pageSize: 5, totalPages: 1 }

await listBooks(db, { pageSize: 51 });
// → throws ValidationError
```

**updateBook**

```ts
await updateBook(db, 1, { title: "  The Dispossessed (2nd ed.) " });
// → { id: 1, title: "The Dispossessed (2nd ed.)", isbn: "9780060512754", publishedYear: 1974, authorId: 1, createdAt: Date }

await updateBook(db, 1, {});
// → throws ValidationError

await updateBook(db, 999, { title: "x" });
// → throws NotFoundError
```

**deleteAuthor**

```ts
await deleteAuthor(db, 1);
// → throws ConflictError (the author still has a book)

await deleteAuthor(db, 2);   // author without books
// → undefined (deleted)

await deleteAuthor(db, 999);
// → throws NotFoundError
```

## Rules

- Don't change `prisma/schema.prisma` or the function signatures.
- Edit only `task1.ts`. Do not change the tests.
