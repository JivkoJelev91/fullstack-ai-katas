/**
 * EXPRESS-005: Product Catalog Search API
 * Specification: ./task5.md (in this folder)
 * Run the tests: npm run test:express:5
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { type Express } from "express";

// ---------------------------------------------------------------------------
// API contract (from the specification)
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  rating: number;
  inStock: boolean;
  tags: string[];
  /** ISO 8601 timestamp */
  createdAt: string;
}

export interface ProductCatalog {
  getAll(): Promise<Product[]>;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ProductListResponse {
  data: Product[];
  pagination: Pagination;
}

export type ErrorCode = "INVALID_QUERY" | "NOT_FOUND" | "INTERNAL_ERROR";

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

export function createApp(deps: { catalog: ProductCatalog }): Express {
  const app = express();

  app.get("/products", async (_req, _res) => {
    // TODO: "Query parameters" section
    throw new Error("Not implemented: GET /products");
  });

  app.get("/products/:id", async (_req, _res) => {
    // TODO: "Endpoints" section
    throw new Error("Not implemented: GET /products/:id");
  });

  // TODO: "Errors" section

  return app;
}
