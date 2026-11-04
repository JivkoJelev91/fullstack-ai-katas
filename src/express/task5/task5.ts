/**
 * EXPRESS-005: Filter Products
 * Specification: ./task5.md (in this folder)
 * Run the tests:  npm run test:express:5
 * Run the server: npm run dev:express:5
 *
 * Keep the exported names and the createApp signature unchanged; the tests depend on them.
 */
import express, { type Express } from "express";

export interface Product {
  id: string;
  name: string;
  category: string;
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

  app.get("/products", (req, res) => {
    // The query parameters are in req.query, e.g. req.query.category (a string or undefined)
    const category = req.query.category;
    const inStock = req.query.inStock;
    
    let filteredProducts = category ? products.filter(
      (prod) => prod.category.toString().toLowerCase() ===
      category?.toString().toLowerCase()
    ) : products;

    if (inStock !== undefined && inStock !== 'true' && inStock !== 'false'){
      res.status(400).send({ error: "inStock must be true or false" });
    }

    if(inStock === 'true' ){
      filteredProducts = filteredProducts.filter(p => p.inStock === true)
    }
    if(inStock === 'false' ){
      filteredProducts = filteredProducts.filter(p => p.inStock === false)
    }

    return res.send({
      data: filteredProducts
    })
  });

  return app;
}
