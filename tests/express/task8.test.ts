import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type Product } from "../../src/express/task8/task8";
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

async function get(query: string, products = sampleProducts()) {
  const res = await request(createApp(products)).get(`/products${query}`);
  expectStatus(res, 200, `GET /products${query} must return 200.`);
  return res;
}

const ids = (res: request.Response) => (res.body.data as Product[] | undefined)?.map((p) => p.id);

describe("EXPRESS-008", () => {
  describe("GET /products", () => {
    it("returns page 1 with 5 products by default", async () => {
      const res = await get("");
      expect(res.body.data, "data must be the full product objects p1 … p5").toEqual(sampleProducts().slice(0, 5));
      expect(res.body.pagination, "pagination must be { page: 1, pageSize: 5, totalItems: 8, totalPages: 2 }").toEqual({
        page: 1, pageSize: 5, totalItems: 8, totalPages: 2,
      });
    });

    it("returns the requested page", async () => {
      const res = await get("?page=2&pageSize=3");
      expect(ids(res), "page=2&pageSize=3 must return p4 p5 p6").toEqual(["p4", "p5", "p6"]);
      expect(res.body.pagination, "pagination must be { page: 2, pageSize: 3, totalItems: 8, totalPages: 3 }").toEqual({
        page: 2, pageSize: 3, totalItems: 8, totalPages: 3,
      });
    });

    it("returns a shorter last page", async () => {
      expect(ids(await get("?page=2")), "page=2 with the default pageSize 5 must return p6 p7 p8").toEqual(["p6", "p7", "p8"]);
      expect(ids(await get("?page=3&pageSize=3")), "page=3&pageSize=3 must return p7 p8").toEqual(["p7", "p8"]);
    });

    it("returns an empty page after the last one", async () => {
      const res = await get("?page=3");
      expect(res.body, "page=3 is after the last page, so data must be [] and pagination still filled in").toEqual({
        data: [],
        pagination: { page: 3, pageSize: 5, totalItems: 8, totalPages: 2 },
      });
    });

    it("reports 0 pages when there are no products", async () => {
      const res = await get("", []);
      expect(res.body, "With no products the body must be { data: [], pagination: { page: 1, pageSize: 5, totalItems: 0, totalPages: 0 } }").toEqual({
        data: [],
        pagination: { page: 1, pageSize: 5, totalItems: 0, totalPages: 0 },
      });
    });

    it("accepts pageSize 1 and 50", async () => {
      expect(ids(await get("?pageSize=1")), "pageSize=1 must return only p1").toEqual(["p1"]);
      expect(ids(await get("?pageSize=50")), "pageSize=50 must return all 8 products").toHaveLength(8);
    });

    it.each(["page=0", "page=-1", "page=abc", "page=1.5", "pageSize=0", "pageSize=51", "pageSize=x"])(
      "returns 400 for ?%s",
      async (query) => {
        const res = await request(createApp(sampleProducts())).get(`/products?${query}`);
        expectError(res, 400, `?${query} is invalid and must return 400.`);
      },
    );
  });
});
