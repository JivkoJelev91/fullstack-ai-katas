/**
 * EXPRESS-006: Search Products
 * Specification: ./task6.md (in this folder)
 * Run the tests:  npm run test:express:6
 * Run the server: npm run dev:express:6
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

export function createApp(initialProducts: Product[] = []): Express {
  const app = express();

  // Storage (no database), filled with initialProducts, in the order they were added.
  //   filter: products.filter((p) => ...)
  const products: Product[] = [...initialProducts];

  app.get("/products", (_req, _res) => {
    // The query parameters are in req.query: q, minPrice, maxPrice (strings or undefined)
    throw new Error("Not implemented: GET /products");
  });

  return app;
}
