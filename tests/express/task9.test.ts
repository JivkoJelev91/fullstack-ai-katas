import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type Product, type ProductCatalog } from "../../src/express/task9/task9";
import { expectError, expectStatus } from "../support/http";

const sampleProducts = (): Product[] => [
  { id: "p1", name: "Trail Shoes", category: "footwear", priceCents: 12999, rating: 4.6, inStock: true, tags: ["running", "outdoor"] },
  { id: "p2", name: "Road Shoes", category: "footwear", priceCents: 10999, rating: 4.2, inStock: false, tags: ["running"] },
  { id: "p3", name: "Rain Jacket", category: "apparel", priceCents: 8999, rating: 4.1, inStock: true, tags: ["outdoor", "waterproof"] },
  { id: "p4", name: "Wool Socks", category: "apparel", priceCents: 1499, rating: 4.6, inStock: true, tags: ["winter"] },
  { id: "p5", name: "Headlamp", category: "gear", priceCents: 3999, rating: 4.5, inStock: true, tags: ["camping", "night"] },
];

const catalogOf = (products: Product[]): ProductCatalog => ({ getAll: async () => products });

const SECRET = "connection refused: products-db.internal:5432";
const brokenCatalog: ProductCatalog = {
  getAll: async () => {
    throw new Error(SECRET);
  },
};

describe("EXPRESS-009", () => {
  describe("GET /products", () => {
    it("returns all products from the catalog", async () => {
      const res = await request(createApp({ catalog: catalogOf(sampleProducts()) })).get("/products");
      expectStatus(res, 200, "GET /products must return 200.");
      expect(res.body, 'The body must be { "data": [ ...all products ] }').toEqual({ data: sampleProducts() });
    });

    it("reads the catalog on every request", async () => {
      let current = sampleProducts();
      const app = createApp({ catalog: { getAll: async () => current } });

      const first = await request(app).get("/products");
      expect(first.body.data, "The first request must return 5 products").toHaveLength(5);

      current = current.slice(0, 2);
      const second = await request(app).get("/products");
      expect(second.body.data, "The catalog now has 2 products, so the second request must return 2. Call getAll() on every request.").toHaveLength(2);
    });

    it("returns 500 without the original error message when the catalog throws", async () => {
      const res = await request(createApp({ catalog: brokenCatalog })).get("/products");
      expectError(res, 500, "getAll() threw, so GET /products must return 500 with { error: string }.");
      expect(res.text, "The response must not contain the original error message").not.toContain("products-db");
    });
  });

  describe("GET /products/:id", () => {
    it("returns the product with that id", async () => {
      const res = await request(createApp({ catalog: catalogOf(sampleProducts()) })).get("/products/p3");
      expectStatus(res, 200, "GET /products/p3 must return 200.");
      expect(res.body, "The body must be the full p3 product").toEqual(sampleProducts()[2]);
    });

    it("returns 404 when no product has that id", async () => {
      const res = await request(createApp({ catalog: catalogOf(sampleProducts()) })).get("/products/p99");
      expectError(res, 404, "There is no product p99, so GET /products/p99 must return 404.");
    });

    it("reads the catalog on every request", async () => {
      let current: Product[] = [];
      const app = createApp({ catalog: { getAll: async () => current } });
      await request(app).get("/products/p1");
      current = sampleProducts();
      const res = await request(app).get("/products/p1");
      expectStatus(res, 200, "p1 was added to the catalog, so GET /products/p1 must now return 200. Call getAll() on every request.");
    });

    it("returns 500 without the original error message when the catalog throws", async () => {
      const res = await request(createApp({ catalog: brokenCatalog })).get("/products/p1");
      expectError(res, 500, "getAll() threw, so GET /products/p1 must return 500 with { error: string }.");
      expect(res.text, "The response must not contain the original error message").not.toContain("products-db");
    });
  });
});
