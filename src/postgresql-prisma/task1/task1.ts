/**
 * PRISMA-001: Library Catalog Data Access Layer
 * Specification: ./task1.md (in this folder)
 * Run the tests: npm run test:prisma:1   (requires the test database, see README.md)
 *
 * Keep the exported types and signatures unchanged; the tests depend on them.
 */
import type { Author, Book, PrismaClient } from "../../generated/prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export interface CreateAuthorInput {
  name: string;
  email: string;
}

export interface CreateBookInput {
  title: string;
  isbn: string;
  publishedYear: number;
  authorId: number;
}

export interface UpdateBookInput {
  title?: string;
  publishedYear?: number;
  authorId?: number;
}

export interface ListBooksQuery {
  authorId?: number;
  search?: string;
  page?: number;
  pageSize?: number;
}

export type BookListItem = Book & { author: { id: number; name: string } };

export interface BookPage {
  items: BookListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Data access functions
// ---------------------------------------------------------------------------

export async function createAuthor(db: PrismaClient, input: CreateAuthorInput): Promise<Author> {
  // TODO: "Functions" section
  throw new Error("PRISMA-001 createAuthor is not implemented yet");
}

export async function createBook(db: PrismaClient, input: CreateBookInput): Promise<Book> {
  // TODO: "Functions" section
  throw new Error("PRISMA-001 createBook is not implemented yet");
}

export async function getAuthorWithBooks(db: PrismaClient, authorId: number): Promise<Author & { books: Book[] }> {
  // TODO: "Functions" section
  throw new Error("PRISMA-001 getAuthorWithBooks is not implemented yet");
}

export async function listBooks(db: PrismaClient, query: ListBooksQuery): Promise<BookPage> {
  // TODO: "Functions" section
  throw new Error("PRISMA-001 listBooks is not implemented yet");
}

export async function updateBook(db: PrismaClient, bookId: number, changes: UpdateBookInput): Promise<Book> {
  // TODO: "Functions" section
  throw new Error("PRISMA-001 updateBook is not implemented yet");
}

export async function deleteAuthor(db: PrismaClient, authorId: number): Promise<void> {
  // TODO: "Functions" section
  throw new Error("PRISMA-001 deleteAuthor is not implemented yet");
}
