/**
 * EXPRESS-009: Products from an Async Catalog
 * Specification: ./task9.md (in this folder)
 * Run the tests:  npm run test:express:9
 * Run the server: npm run dev:express:9
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";

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

  app.get("/products", async (_req, res) => {
    const products = await deps.catalog.getAll();
    res.send({ data: products });
  });

  app.get("/products/:id", async (req, res) => {
    const products = await deps.catalog.getAll();
    const currentProduct = products.find((prod) => prod.id === req.params.id);

    if (!currentProduct) {
      return res.status(404).send({ error: "Product was not found" });
    }

    res.send(currentProduct);
  });

  // If you use an error middleware, register it here, after the routes.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: "Something went wrong" });
  });

  return app;
}
