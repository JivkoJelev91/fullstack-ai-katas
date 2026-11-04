import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type Product } from "../../src/express/task6/task6";
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

describe("EXPRESS-006", () => {
  describe("GET /products", () => {
    it("returns all products without query parameters", async () => {
      expect((await get("")).body, 'The body must be { "data": [p1 … p8] }').toEqual({ data: sampleProducts() });
    });

    it("searches in the name", async () => {
      expect(ids(await get("?q=jacket")), '?q=jacket must return p3 ("Rain Jacket")').toEqual(["p3"]);
    });

    it("searches in the tags", async () => {
      expect(ids(await get("?q=winter")), '?q=winter must return p4 and p8 (tag "winter")').toEqual(["p4", "p8"]);
    });

    it("matches part of a word, in the name or the tags", async () => {
      expect(ids(await get("?q=camp")), '?q=camp must return p5 (tag), p6 (name) and p8 (tag)').toEqual(["p5", "p6", "p8"]);
    });

    it("ignores upper/lower case", async () => {
      expect(ids(await get("?q=SHOES")), "?q=SHOES must return p1 and p2").toEqual(["p1", "p2"]);
      expect(ids(await get("?q=Water")), '?q=Water must return p3 (tag "waterproof") and p7 ("water bottle")').toEqual(["p3", "p7"]);
    });

    it("trims spaces around q", async () => {
      expect(ids(await get("?q=%20%20socks%20%20")), '?q="  socks  " must be trimmed and return p4').toEqual(["p4"]);
    });

    it("returns { data: [] } when nothing matches", async () => {
      expect((await get("?q=kayak")).body, '?q=kayak has no matches, so the body must be { "data": [] }').toEqual({ data: [] });
    });

    it("filters by minPrice (inclusive)", async () => {
      expect(ids(await get("?minPrice=8999")), "?minPrice=8999 must return p1 p2 p3 p6 p8").toEqual(["p1", "p2", "p3", "p6", "p8"]);
    });

    it("filters by maxPrice (inclusive)", async () => {
      expect(ids(await get("?maxPrice=1999")), "?maxPrice=1999 must return p4 and p7").toEqual(["p4", "p7"]);
    });

    it("filters by a price range", async () => {
      expect(ids(await get("?minPrice=4000&maxPrice=9000")), "?minPrice=4000&maxPrice=9000 must return p3 and p6").toEqual(["p3", "p6"]);
      expect(ids(await get("?minPrice=8999&maxPrice=8999")), "?minPrice=8999&maxPrice=8999 must return p3 and p6").toEqual(["p3", "p6"]);
    });

    it("combines q and price", async () => {
      expect(ids(await get("?q=camp&maxPrice=9000")), "?q=camp&maxPrice=9000 must return p5 and p6").toEqual(["p5", "p6"]);
    });

    it.each(["minPrice=-1", "maxPrice=abc", "minPrice=9.5","minPrice=5000&maxPrice=1000"])(
      "returns 400 for ?%s",
      async (query) => {
        const res = await request(createApp(sampleProducts())).get(`/products?${query}`);
        expectError(res, 400, `?${query} is invalid and must return 400.`);
      },
    );
  });
});
