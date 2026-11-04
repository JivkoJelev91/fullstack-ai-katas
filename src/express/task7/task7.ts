/**
 * EXPRESS-007: Sort Products
 * Specification: ./task7.md (in this folder)
 * Run the tests:  npm run test:express:7
 * Run the server: npm run dev:express:7
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
  //   sort a copy: [...products].sort((a, b) => ...)
  //     the compare function returns a negative number if a comes first, positive if b comes first, 0 if equal
  const products: Product[] = [...initialProducts];

  app.get("/products", (_req, _res) => {
    // The sort value is in req.query.sort (a string or undefined)
    throw new Error("Not implemented: GET /products");
  });

  return app;
}
