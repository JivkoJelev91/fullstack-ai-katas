import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { cancelOrder, getOrder, InsufficientStockError, placeOrder } from "../../src/postgresql-prisma/task2/task2";
import { InvalidStateError, NotFoundError, ValidationError } from "../../src/shared/errors";
import { createTestPrisma, truncate } from "../support/db";

let db: PrismaClient;

beforeAll(() => {
  db = createTestPrisma();
});

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(async () => {
  await truncate(db, ["OrderItem", "Order", "Product", "Customer"]);
});

async function seed() {
  const customer = await db.customer.create({ data: { email: "kim@example.com", name: "Kim" } });
  const mug = await db.product.create({ data: { sku: "MUG-01", name: "Mug", priceCents: 1200, stock: 5 } });
  const tee = await db.product.create({ data: { sku: "TEE-01", name: "T-Shirt", priceCents: 2500, stock: 1 } });
  const old = await db.product.create({ data: { sku: "OLD-01", name: "Old poster", priceCents: 900, stock: 10, active: false } });
  return { customer, mug, tee, old };
}

async function stockOf(productId: number) {
  return (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock;
}

async function unitsSold(productId: number) {
  const rows = await db.orderItem.findMany({ where: { productId, order: { status: "PLACED" } } });
  return rows.reduce((sum, row) => sum + row.quantity, 0);
}

// Opens enough pooled connections up front so that concurrent calls really overlap.
async function warmPool(connections = 10) {
  await Promise.all(Array.from({ length: connections }, () => db.$executeRaw`SELECT pg_sleep(0.05)`));
}

async function counts() {
  return { orders: await db.order.count(), items: await db.orderItem.count() };
}

async function expectRejects<T extends Error>(promise: Promise<unknown>, type: new (...args: never[]) => T): Promise<T> {
  let error: unknown;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  expect(error, `expected the call to throw ${type.name}`).toBeDefined();
  expect(error, `expected ${type.name}, received ${(error as Error)?.constructor?.name}: ${(error as Error)?.message}`).toBeInstanceOf(type);
  return error as T;
}

describe("PRISMA-002", () => {
  describe("placeOrder", () => {
    it("places an order, captures prices and decrements stock", async () => {
      const { customer, mug, tee } = await seed();
      const order = await placeOrder(db, {
        customerId: customer.id,
        items: [
          { productId: mug.id, quantity: 2 },
          { productId: tee.id, quantity: 1 },
        ],
      });

      expect(order).toMatchObject({
        customerId: customer.id,
        status: "PLACED",
        totalCents: 4900,
        cancelledAt: null,
        items: [
          { productId: mug.id, quantity: 2, unitPriceCents: 1200 },
          { productId: tee.id, quantity: 1, unitPriceCents: 2500 },
        ],
      });
      expect(order.createdAt).toBeInstanceOf(Date);
      expect(await stockOf(mug.id)).toBe(3);
      expect(await stockOf(tee.id)).toBe(0);

      const stored = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { items: true } });
      expect(stored.totalCents).toBe(4900);
      expect(stored.items).toHaveLength(2);
    });

    it("returns items in input order", async () => {
      const { customer, mug, tee } = await seed();
      const order = await placeOrder(db, {
        customerId: customer.id,
        items: [
          { productId: tee.id, quantity: 1 },
          { productId: mug.id, quantity: 1 },
        ],
      });
      expect(order.items.map((i) => i.productId)).toEqual([tee.id, mug.id]);
    });

    it("keeps the historical price when the product price changes later", async () => {
      const { customer, mug } = await seed();
      const order = await placeOrder(db, { customerId: customer.id, items: [{ productId: mug.id, quantity: 1 }] });
      await db.product.update({ where: { id: mug.id }, data: { priceCents: 9999 } });

      const reloaded = await getOrder(db, order.id);
      expect(reloaded.items[0]!.unitPriceCents).toBe(1200);
      expect(reloaded.totalCents).toBe(1200);
    });

    it("allows ordering the entire remaining stock", async () => {
      const { customer, mug } = await seed();
      await placeOrder(db, { customerId: customer.id, items: [{ productId: mug.id, quantity: 5 }] });
      expect(await stockOf(mug.id)).toBe(0);
    });

    it("throws InsufficientStockError and rolls back every line", async () => {
      const { customer, mug, tee } = await seed();
      const error = await expectRejects(
        placeOrder(db, {
          customerId: customer.id,
          items: [
            { productId: mug.id, quantity: 1 },
            { productId: tee.id, quantity: 2 },
          ],
        }),
        InsufficientStockError,
      );
      expect(error.productId).toBe(tee.id);
      expect(await stockOf(mug.id)).toBe(5);
      expect(await stockOf(tee.id)).toBe(1);
      expect(await counts()).toEqual({ orders: 0, items: 0 });
    });

    it("rolls back when an earlier line succeeded but a later product is out of stock", async () => {
      const { customer, mug, tee } = await seed();
      await db.product.update({ where: { id: tee.id }, data: { stock: 0 } });
      await expectRejects(
        placeOrder(db, {
          customerId: customer.id,
          items: [
            { productId: mug.id, quantity: 5 },
            { productId: tee.id, quantity: 1 },
          ],
        }),
        InsufficientStockError,
      );
      expect(await stockOf(mug.id)).toBe(5);
      expect(await counts()).toEqual({ orders: 0, items: 0 });
    });

    it("throws NotFoundError for a missing customer", async () => {
      const { mug } = await seed();
      await expectRejects(placeOrder(db, { customerId: 999_999, items: [{ productId: mug.id, quantity: 1 }] }), NotFoundError);
      expect(await stockOf(mug.id)).toBe(5);
      expect(await counts()).toEqual({ orders: 0, items: 0 });
    });

    it("throws NotFoundError for a missing or inactive product and changes nothing", async () => {
      const { customer, mug, old } = await seed();
      await expectRejects(
        placeOrder(db, { customerId: customer.id, items: [{ productId: mug.id, quantity: 1 }, { productId: 999_999, quantity: 1 }] }),
        NotFoundError,
      );
      await expectRejects(
        placeOrder(db, { customerId: customer.id, items: [{ productId: mug.id, quantity: 1 }, { productId: old.id, quantity: 1 }] }),
        NotFoundError,
      );
      expect(await stockOf(mug.id)).toBe(5);
      expect(await stockOf(old.id)).toBe(10);
      expect(await counts()).toEqual({ orders: 0, items: 0 });
    });

    it.each([
      [{ items: [] }],
      [{ items: Array.from({ length: 21 }, (_, i) => ({ productId: i + 1, quantity: 1 })) }],
      [{ items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }] }],
      [{ items: [{ productId: 1, quantity: 0 }] }],
      [{ items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 101 }] }],
      [{ items: [{ productId: 1, quantity: 1.5 }] }],
      [{ items: [{ productId: -3, quantity: 1 }] }],
      [{ customerId: 0, items: [{ productId: 1, quantity: 1 }] }],
    ])("rejects invalid input %j", async (partial) => {
      const { customer } = await seed();
      const input = { customerId: customer.id, ...partial };
      await expectRejects(placeOrder(db, input), ValidationError);
      expect(await counts()).toEqual({ orders: 0, items: 0 });
    });

    it("accepts 20 lines and the maximum quantity of 100", async () => {
      const customer = await db.customer.create({ data: { email: "bulk@example.com", name: "Bulk" } });
      const products = [];
      for (let i = 0; i < 20; i++) {
        products.push(await db.product.create({ data: { sku: `BULK-${i}`, name: `Bulk ${i}`, priceCents: 100, stock: 100 } }));
      }
      const order = await placeOrder(db, {
        customerId: customer.id,
        items: products.map((p) => ({ productId: p.id, quantity: 100 })),
      });
      expect(order.items).toHaveLength(20);
      expect(order.totalCents).toBe(20 * 100 * 100);
    });

    it("never oversells under concurrent orders", async () => {
      const customer = await db.customer.create({ data: { email: "flash@example.com", name: "Flash" } });
      const limited = await db.product.create({ data: { sku: "LIMITED", name: "Limited", priceCents: 5000, stock: 3 } });
      await warmPool();

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => placeOrder(db, { customerId: customer.id, items: [{ productId: limited.id, quantity: 1 }] })),
      );

      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(succeeded).toHaveLength(3);
      for (const f of failed) expect(f.reason).toBeInstanceOf(InsufficientStockError);
      expect(await stockOf(limited.id)).toBe(0);
      expect(await unitsSold(limited.id)).toBe(3);
      expect(await db.order.count()).toBe(3);
    });

  });

  describe("cancelOrder", () => {
    it("cancels an order and restores stock", async () => {
      const { customer, mug, tee } = await seed();
      const order = await placeOrder(db, {
        customerId: customer.id,
        items: [
          { productId: mug.id, quantity: 2 },
          { productId: tee.id, quantity: 1 },
        ],
      });

      const cancelled = await cancelOrder(db, order.id);
      expect(cancelled).toMatchObject({ id: order.id, status: "CANCELLED", totalCents: 4900 });
      expect(cancelled.cancelledAt).toBeInstanceOf(Date);
      expect(await stockOf(mug.id)).toBe(5);
      expect(await stockOf(tee.id)).toBe(1);

      const stored = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(stored.status).toBe("CANCELLED");
      expect(stored.cancelledAt).not.toBeNull();
    });

    it("throws InvalidStateError when the order is already cancelled", async () => {
      const { customer, mug } = await seed();
      const order = await placeOrder(db, { customerId: customer.id, items: [{ productId: mug.id, quantity: 2 }] });
      await cancelOrder(db, order.id);
      await expectRejects(cancelOrder(db, order.id), InvalidStateError);
      expect(await stockOf(mug.id)).toBe(5);
    });

    it("throws NotFoundError for a missing order", async () => {
      await expectRejects(cancelOrder(db, 777_777), NotFoundError);
    });

    it("restores stock exactly once under concurrent cancellation", async () => {
      const { customer, mug } = await seed();
      const order = await placeOrder(db, { customerId: customer.id, items: [{ productId: mug.id, quantity: 3 }] });
      await warmPool();

      const results = await Promise.allSettled(Array.from({ length: 5 }, () => cancelOrder(db, order.id)));
      const succeeded = results.filter((r) => r.status === "fulfilled");
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(succeeded).toHaveLength(1);
      for (const f of failed) expect(f.reason).toBeInstanceOf(InvalidStateError);
      expect(await stockOf(mug.id)).toBe(5);
    });

    it("makes cancelled stock available to new orders", async () => {
      const { customer, tee } = await seed();
      const first = await placeOrder(db, { customerId: customer.id, items: [{ productId: tee.id, quantity: 1 }] });
      await expectRejects(placeOrder(db, { customerId: customer.id, items: [{ productId: tee.id, quantity: 1 }] }), InsufficientStockError);
      await cancelOrder(db, first.id);
      const second = await placeOrder(db, { customerId: customer.id, items: [{ productId: tee.id, quantity: 1 }] });
      expect(second.status).toBe("PLACED");
    });
  });

  describe("getOrder", () => {
    it("returns an order with items sorted by productId", async () => {
      const { customer, mug, tee } = await seed();
      const placed = await placeOrder(db, {
        customerId: customer.id,
        items: [
          { productId: tee.id, quantity: 1 },
          { productId: mug.id, quantity: 4 },
        ],
      });
      const order = await getOrder(db, placed.id);
      expect(order).toMatchObject({ id: placed.id, customerId: customer.id, status: "PLACED", totalCents: 7300 });
      expect(order.items).toMatchObject([
        { productId: mug.id, quantity: 4, unitPriceCents: 1200 },
        { productId: tee.id, quantity: 1, unitPriceCents: 2500 },
      ]);
    });

    it("throws NotFoundError for a missing order", async () => {
      await expectRejects(getOrder(db, 888_888), NotFoundError);
    });
  });
});
