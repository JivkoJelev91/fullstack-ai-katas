/**
 * EXPRESS-009: Products from an Async Catalog
 * Specification: ./task9.md (in this folder)
 * Run the tests:  npm run test:express:9
 * Run the server: npm run dev:express:9
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { type Express } from "express";

export interface Product {
  id: string;
  name: string;
  category: string;
  /** 8999 means 89.99 */
  priceCents: number;
  rating: number;
  inStock: boolean;
  tags: string[];
}

export interface ProductCatalog {
  /** Returns all products. Can throw (rejects) when the database is down. */
  getAll(): Promise<Product[]>;
}

export function createApp(deps: { catalog: ProductCatalog }): Express {
  const app = express();

  // No local storage: read the products with `await deps.catalog.getAll()` on every request.

  app.get("/products", async (_req, _res) => {
    throw new Error("Not implemented: GET /products");
  });

  app.get("/products/:id", async (_req, _res) => {
    throw new Error("Not implemented: GET /products/:id");
  });

  // If you use an error middleware, register it here, after the routes.

  return app;
}
