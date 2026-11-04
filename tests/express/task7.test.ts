import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp, type Product } from "../../src/express/task7/task7";
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

const ids = (res: request.Response) => (res.body.data as Product[] | undefined)?.map((p) => p.id);

async function sorted(sort: string) {
  const res = await request(createApp(sampleProducts())).get(`/products?sort=${sort}`);
  expectStatus(res, 200, `GET /products?sort=${sort} must return 200.`);
  return ids(res);
}

describe("EXPRESS-007", () => {
  describe("GET /products", () => {
    it("keeps the original order without sort", async () => {
      const res = await request(createApp(sampleProducts())).get("/products");
      expectStatus(res, 200, "GET /products must return 200.");
      expect(res.body, 'Without sort the body must be { "data": [p1 … p8] }').toEqual({ data: sampleProducts() });
    });

    it("sort=price: cheapest first, ties by id", async () => {
      expect(await sorted("price"), "p3 and p6 both cost 8999, so p3 comes first").toEqual(["p4", "p7", "p5", "p3", "p6", "p2", "p1", "p8"]);
    });

    it("sort=-price: most expensive first, ties still by smaller id", async () => {
      expect(await sorted("-price"), "p3 and p6 both cost 8999, so p3 still comes first").toEqual(["p8", "p1", "p2", "p3", "p6", "p5", "p7", "p4"]);
    });

    it("sort=rating: lowest first, ties by id", async () => {
      expect(await sorted("rating"), "p1 and p4 both have 4.6, so p1 comes first").toEqual(["p7", "p3", "p2", "p6", "p5", "p1", "p4", "p8"]);
    });

    it("sort=-rating: highest first, ties still by smaller id", async () => {
      expect(await sorted("-rating"), "p1 and p4 both have 4.6, so p1 still comes first").toEqual(["p8", "p1", "p4", "p5", "p6", "p2", "p3", "p7"]);
    });

    it("sort=name: A to Z, ignoring upper/lower case", async () => {
      expect(await sorted("name"), '"water bottle" must be sorted between "Trail Shoes" and "Wool Socks"').toEqual(["p6", "p5", "p3", "p2", "p8", "p1", "p7", "p4"]);
    });

    it("sort=-name: Z to A, ignoring upper/lower case", async () => {
      expect(await sorted("-name"), "sort=-name must be the reverse of sort=name").toEqual(["p4", "p7", "p1", "p8", "p2", "p3", "p5", "p6"]);
    });

    it("does not change the stored order", async () => {
      const app = createApp(sampleProducts());
      await request(app).get("/products?sort=-price");
      const res = await request(app).get("/products");
      expect(ids(res), "After GET /products?sort=-price, GET /products must still return p1 … p8. Sort a copy of the array.").toEqual([
        "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8",
      ]);
    });

    it.each(["popularity", "", "Price", "price,name", "--price"])("returns 400 for sort=%s", async (sort) => {
      const res = await request(createApp(sampleProducts())).get(`/products?sort=${sort}`);
      expectError(res, 400, `sort=${sort} is not one of price, -price, rating, -rating, name, -name and must return 400.`);
    });
  });
});
