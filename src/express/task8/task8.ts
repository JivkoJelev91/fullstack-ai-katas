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

  app.get("/products", (req, res) => {
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const pageSize = req.query.pageSize === undefined ? 5 : Number(req.query.pageSize);

    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).send({ error: "page must be a whole number >= 1" });
    }

    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
      return res.status(400).send({ error: "pageSize must be 1-50" });
    }
    const totalItems = products.length;
    const paginatedData = products.slice(
      pageSize * (page - 1),
      pageSize * page,
    );
    const totalPages = Math.ceil(totalItems / pageSize);

    return res.send({
      data: paginatedData,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    });
  });

  return app;
}
