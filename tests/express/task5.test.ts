import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type Product } from "../../src/express/task5/task5";
import { expectError, expectStatus } from "../support/http";

const sampleProducts = (): Product[] => [
  { id: "p1", name: "Trail Shoes", category: "footwear", priceCents: 12999, rating: 4.6, inStock: true, tags: ["running", "outdoor"] },
  { id: "p2", name: "Road Shoes", category: "footwear", priceCents: 10999, rating: 4.2, inStock: false, tags: ["running"] },
  { id: "p3", name: "Rain Jacket", category: "apparel", priceCents: 8999, rating: 4.1, inStock: true, tags: ["outdoor", "waterproof"] },
  { id: "p4", name: "Wool Socks", category: "apparel", priceCents: 1499, rating: 4.6, inStock: true, tags: ["winter"] },
  { id: "p5", name: "Headlamp", category: "gear", priceCents: 3999, rating: 4.5, inStock: true, tags: ["camping", "night"] },
  { id: "p6", name: "Camping Stove", category: "gear", priceCents: 8999, rating: 4.3, inStock: false, tags: ["camping", "cooking"] },
  { id: "p7", name: "water bottle", category: "gear", priceCents: 1999, rating: 4.0, inStock: true, tags: ["hydration"] },
  { id: "p8", name: "Sleeping Bag", category: "Gear", priceCents: 15999, rating: 4.9, inStock: true, tags: ["camping", "winter"] },
];

async function get(query: string) {
  const res = await request(createApp(sampleProducts())).get(`/products${query}`);
  expectStatus(res, 200, `GET /products${query} must return 200.`);
  return res;
}

const ids = (res: request.Response) => (res.body.data as Product[] | undefined)?.map((p) => p.id);

describe("EXPRESS-005", () => {
  describe("GET /products", () => {
    it("returns all products in the order they were added", async () => {
      const res = await get("");
      expect(res.body, 'The body must be { "data": [p1 … p8] } with the full product objects').toEqual({ data: sampleProducts() });
    });

    it("returns { data: [] } when there are no products", async () => {
      const res = await request(createApp([])).get("/products");
      expectStatus(res, 200, "GET /products must return 200.");
      expect(res.body, 'The body must be { "data": [] }').toEqual({ data: [] });
    });

    it("filters by category", async () => {
      expect(ids(await get("?category=apparel")), "?category=apparel must return p3 and p4").toEqual(["p3", "p4"]);
    });

    it("ignores upper/lower case in category", async () => {
      expect(ids(await get("?category=gear")), '?category=gear must also return p8 (category "Gear")').toEqual(["p5", "p6", "p7", "p8"]);
      expect(ids(await get("?category=GEAR")), "?category=GEAR must return the same as ?category=gear").toEqual(["p5", "p6", "p7", "p8"]);
    });

    it("returns { data: [] } when no product has that category", async () => {
      expect((await get("?category=toys")).body, '?category=toys has no matches, so the body must be { "data": [] }').toEqual({ data: [] });
    });

    it("filters by inStock=true and inStock=false", async () => {
      expect(ids(await get("?inStock=true")), "?inStock=true must return p1 p3 p4 p5 p7 p8").toEqual(["p1", "p3", "p4", "p5", "p7", "p8"]);
      expect(ids(await get("?inStock=false")), "?inStock=false must return p2 and p6").toEqual(["p2", "p6"]);
    });

    it("combines category and inStock", async () => {
      expect(ids(await get("?category=gear&inStock=true")), "?category=gear&inStock=true must return p5 p7 p8").toEqual(["p5", "p7", "p8"]);
    });

    it("ignores unknown query parameters", async () => {
      expect(ids(await get("?color=red")), "?color=red is unknown, so all products must be returned").toHaveLength(8);
    });

    it.each(["yes", "1", "TRUE", ""])("returns 400 for inStock=%s", async (value) => {
      const res = await request(createApp(sampleProducts())).get(`/products?inStock=${value}`);
      expectError(res, 400, `?inStock=${value} is not "true" or "false" and must return 400.`);
    });
  });
});
