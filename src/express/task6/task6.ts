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

  // Parses an optional price query param.
  // Returns undefined (param missing), a number, or null (invalid).
  const parsePrice = (value: unknown): number | undefined | null => {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || value.trim() === "") return null;
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };

  app.get("/products", (req, res) => {
    // 1) Read + validate all params first
    const minPrice = parsePrice(req.query.minPrice);
    const maxPrice = parsePrice(req.query.maxPrice);

    if (minPrice === null) {
      return res.status(400).json({ error: "minPrice must be a whole number >= 0" });
    }
    if (maxPrice === null) {
      return res.status(400).json({ error: "maxPrice must be a whole number >= 0" });
    }
    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return res.status(400).json({ error: "minPrice must not be bigger than maxPrice" });
    }

    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

    // 2) One filter pass: every active criterion must match (AND).
    //    A missing criterion simply doesn't reject anything.
    const data = products.filter((p) => {
      if (q) {
        const inName = p.name.toLowerCase().includes(q);
        const inTags = p.tags.some((t) => t.toLowerCase().includes(q));
        if (!inName && !inTags) return false;
      }
      if (minPrice !== undefined && p.priceCents < minPrice) return false;
      if (maxPrice !== undefined && p.priceCents > maxPrice) return false;
      return true;
    });

    return res.status(200).json({ data });
  });

  return app;
}
