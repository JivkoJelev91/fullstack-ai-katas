import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp, type Product, type ProductCatalog } from "../../src/express/task5/task5";

function fixtures(): Product[] {
  return [
    { id: "p01", name: "Trail Running Shoes", category: "footwear", priceCents: 12999, rating: 4.6, inStock: true, tags: ["running", "outdoor"], createdAt: "2026-01-05T10:00:00.000Z" },
    { id: "p02", name: "Road Running Shoes", category: "footwear", priceCents: 10999, rating: 4.2, inStock: false, tags: ["running"], createdAt: "2026-02-10T10:00:00.000Z" },
    { id: "p03", name: "Hiking Boots", category: "Footwear", priceCents: 18999, rating: 4.8, inStock: true, tags: ["outdoor", "winter"], createdAt: "2025-11-20T10:00:00.000Z" },
    { id: "p04", name: "Rain Jacket", category: "apparel", priceCents: 8999, rating: 4.1, inStock: true, tags: ["outdoor", "waterproof"], createdAt: "2026-03-01T10:00:00.000Z" },
    { id: "p05", name: "Merino T-Shirt", category: "apparel", priceCents: 4999, rating: 4.7, inStock: true, tags: ["base layer"], createdAt: "2026-01-15T10:00:00.000Z" },
    { id: "p06", name: "Insulated Vest", category: "apparel", priceCents: 8999, rating: 3.9, inStock: false, tags: ["winter"], createdAt: "2025-12-01T10:00:00.000Z" },
    { id: "p07", name: "Headlamp", category: "gear", priceCents: 3999, rating: 4.5, inStock: true, tags: ["camping", "night"], createdAt: "2026-02-20T10:00:00.000Z" },
    { id: "p08", name: "Camping Stove", category: "gear", priceCents: 6999, rating: 4.3, inStock: true, tags: ["camping", "cooking"], createdAt: "2025-10-10T10:00:00.000Z" },
    { id: "p09", name: "Water Bottle", category: "gear", priceCents: 1999, rating: 4.0, inStock: true, tags: ["hydration"], createdAt: "2026-03-05T10:00:00.000Z" },
    { id: "p10", name: "Trekking Poles", category: "gear", priceCents: 8999, rating: 4.4, inStock: false, tags: ["hiking", "outdoor"], createdAt: "2026-01-25T10:00:00.000Z" },
    { id: "p11", name: "running socks", category: "apparel", priceCents: 1499, rating: 4.6, inStock: true, tags: ["running"], createdAt: "2026-02-01T10:00:00.000Z" },
    { id: "p12", name: "Sleeping Bag", category: "gear", priceCents: 15999, rating: 4.9, inStock: true, tags: ["camping", "winter"], createdAt: "2025-09-15T10:00:00.000Z" },
  ];
}

function setup(products: Product[] = fixtures()) {
  const catalog: ProductCatalog = { getAll: vi.fn(async () => products) };
  return { app: createApp({ catalog }), catalog, products };
}

async function list(query: string, products?: Product[]) {
  const { app } = setup(products);
  return request(app).get(`/products${query}`);
}

const ids = (res: request.Response) => (res.body.data as Product[]).map((p) => p.id);

function expectError(res: request.Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(res.body?.error?.code).toBe(code);
  expect(typeof res.body.error.message).toBe("string");
}

describe("EXPRESS-005", () => {
  describe("Pagination", () => {
    it("returns all products newest first with default pagination", async () => {
      const res = await list("");
      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(["p09", "p04", "p07", "p02", "p11", "p10", "p05", "p01", "p06", "p03", "p08", "p12"]);
      expect(res.body.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 12, totalPages: 1 });
    });

    it("returns the requested page", async () => {
      const res = await list("?page=2&pageSize=5");
      expect(ids(res)).toEqual(["p10", "p05", "p01", "p06", "p03"]);
      expect(res.body.pagination).toEqual({ page: 2, pageSize: 5, totalItems: 12, totalPages: 3 });
    });

    it("returns a partial last page", async () => {
      expect(ids(await list("?page=3&pageSize=5"))).toEqual(["p08", "p12"]);
    });

    it("returns an empty page past the end", async () => {
      const res = await list("?page=4&pageSize=5");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toEqual({ page: 4, pageSize: 5, totalItems: 12, totalPages: 3 });
    });

    it("reports 0 pages when nothing matches", async () => {
      const res = await list("?q=kayak");
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination).toEqual({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
    });

    it("accepts pageSize 1 and 100", async () => {
      expect(ids(await list("?pageSize=1"))).toEqual(["p09"]);
      expect((await list("?pageSize=100")).body.data).toHaveLength(12);
    });

    it.each(["page=0", "page=abc", "page=2.5", "pageSize=0", "pageSize=101", "pageSize=x"])(
      "rejects %s",
      async (query) => {
        expectError(await list(`?${query}`), 400, "INVALID_QUERY");
      },
    );

    it("returns products exactly as the catalog gives them", async () => {
      const res = await list("?pageSize=1");
      expect(res.body.data[0]).toEqual(fixtures().find((p) => p.id === "p09"));
    });
  });

  describe("Filters", () => {
    it("filters by category ignoring case", async () => {
      expect(ids(await list("?category=gear"))).toEqual(["p09", "p07", "p10", "p08", "p12"]);
      expect(ids(await list("?category=FOOTWEAR"))).toEqual(["p02", "p01", "p03"]);
    });

    it("filters by price range (inclusive)", async () => {
      expect(ids(await list("?minPrice=8999&maxPrice=8999&sort=price"))).toEqual(["p04", "p06", "p10"]);
      expect(ids(await list("?maxPrice=1999&sort=price"))).toEqual(["p11", "p09"]);
    });

    it.each(["minPrice=-1", "maxPrice=abc", "minPrice=5000&maxPrice=1000"])("rejects %s", async (query) => {
      expectError(await list(`?${query}`), 400, "INVALID_QUERY");
    });

    it("filters by inStock", async () => {
      expect(ids(await list("?inStock=false"))).toEqual(["p02", "p10", "p06"]);
      expect((await list("?inStock=true")).body.pagination.totalItems).toBe(9);
      expectError(await list("?inStock=yes"), 400, "INVALID_QUERY");
    });

    it("searches names and tags ignoring case", async () => {
      expect(ids(await list("?q=running"))).toEqual(["p02", "p11", "p01"]);
      expect(ids(await list("?q=OUTDOOR")).sort()).toEqual(["p01", "p03", "p04", "p10"]);
      expect(ids(await list("?q=camp")).sort()).toEqual(["p07", "p08", "p12"]);
    });

    it("trims the search text", async () => {
      expect(ids(await list("?q=%20%20running%20%20"))).toEqual(["p02", "p11", "p01"]);
    });

    it("combines filters, then sorts, then paginates", async () => {
      const res = await list("?category=gear&inStock=true&sort=price&pageSize=2&page=2");
      expect(ids(res)).toEqual(["p08", "p12"]);
      expect(res.body.pagination).toEqual({ page: 2, pageSize: 2, totalItems: 4, totalPages: 2 });
    });

    it("ignores unknown parameters", async () => {
      const res = await list("?color=red");
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(12);
    });
  });

  describe("Sorting", () => {
    it("sorts by price ascending, ties by id", async () => {
      expect(ids(await list("?sort=price"))).toEqual([
        "p11", "p09", "p07", "p05", "p08", "p04", "p06", "p10", "p02", "p01", "p12", "p03",
      ]);
    });

    it("sorts by rating descending, ties by id", async () => {
      expect(ids(await list("?sort=-rating"))).toEqual([
        "p12", "p03", "p05", "p01", "p11", "p07", "p10", "p08", "p02", "p04", "p09", "p06",
      ]);
    });

    it("sorts by name ignoring case", async () => {
      expect(ids(await list("?sort=name"))).toEqual([
        "p08", "p07", "p03", "p06", "p05", "p04", "p02", "p11", "p12", "p01", "p10", "p09",
      ]);
    });

    it("sorts by createdAt ascending", async () => {
      expect(ids(await list("?sort=createdAt&pageSize=3"))).toEqual(["p12", "p08", "p03"]);
    });

    it.each(["popularity", "", "price,name"])("rejects sort=%s", async (value) => {
      expectError(await list(`?sort=${value}`), 400, "INVALID_QUERY");
    });
  });

  describe("Catalog", () => {
    it("reads the catalog on every request", async () => {
      let current = fixtures();
      const app = createApp({ catalog: { getAll: async () => current } });
      expect((await request(app).get("/products")).body.pagination.totalItems).toBe(12);
      current = current.slice(0, 3);
      expect((await request(app).get("/products")).body.pagination.totalItems).toBe(3);
    });

    it("does not change the catalog's array", async () => {
      const { app, products } = setup();
      await request(app).get("/products?sort=price").expect(200);
      await request(app).get("/products?sort=-name").expect(200);
      expect(products).toEqual(fixtures());
    });

    it("responds 500 without the original error message when the catalog fails", async () => {
      const secret = "connection refused: inventory-db.internal:5432";
      const app = createApp({ catalog: { getAll: async () => Promise.reject(new Error(secret)) } });
      for (const path of ["/products", "/products/p01"]) {
        const res = await request(app).get(path);
        expectError(res, 500, "INTERNAL_ERROR");
        expect(res.text).not.toContain("inventory-db");
      }
    });
  });

  describe("GET /products/:id", () => {
    it("returns one product", async () => {
      const { app } = setup();
      const res = await request(app).get("/products/p05");
      expect(res.status).toBe(200);
      expect(res.body).toEqual(fixtures().find((p) => p.id === "p05"));
    });

    it("returns 404 for an unknown id", async () => {
      const { app } = setup();
      expectError(await request(app).get("/products/p99"), 404, "NOT_FOUND");
    });
  });
});
