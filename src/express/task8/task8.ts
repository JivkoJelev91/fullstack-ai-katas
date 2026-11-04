/**
 * EXPRESS-008: Paginate Products
 * Specification: ./task8.md (in this folder)
 * Run the tests:  npm run test:express:8
 * Run the server: npm run dev:express:8
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

export interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export function createApp(initialProducts: Product[] = []): Express {
  const app = express();

  // Storage (no database), filled with initialProducts, in the order they were added.
  //   one page: products.slice(start, end)  -> the items from index start up to (not including) end
  const products: Product[] = [...initialProducts];

  app.get("/products", (_req, _res) => {
    // page and pageSize are in req.query (strings or undefined)
    throw new Error("Not implemented: GET /products");
  });

  return app;
}
