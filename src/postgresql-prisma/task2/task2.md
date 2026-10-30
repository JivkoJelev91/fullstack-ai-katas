# Order Placement with Inventory

**Task ID:** PRISMA-002 · **Level:** 2–3 · **File:** `src/postgresql-prisma/task2/task2.ts` · **Tests:** `npm run test:prisma:2`

Place and cancel shop orders. Stock must stay correct even when many orders arrive at the same time. Use database transactions for this.

## Setup

- The tables `Customer`, `Product`, `Order` and `OrderItem` already exist in `prisma/schema.prisma`.
- Each function gets a `PrismaClient` as `db`. Use it, and don't create your own client.
- Don't use in-memory locks or queues. Correctness must come from the database.
- The tests need a test database. See "Database setup" in `README.md`.

## Errors

| Error                    | Where it comes from    | When |
| ------------------------ | ---------------------- | ---- |
| `ValidationError`        | `src/shared/errors.ts` | Input breaks a rule |
| `NotFoundError`          | `src/shared/errors.ts` | Customer, product or order doesn't exist, or the product is not `active` |
| `InsufficientStockError` | The task file          | A product doesn't have enough stock. Pass its `productId` to the constructor. |
| `InvalidStateError`      | `src/shared/errors.ts` | Cancelling an order that is already `CANCELLED` |

When a function throws, nothing may be written to the database.

## Validation (`placeOrder`)

| Input        | Rule                                          |
| ------------ | --------------------------------------------- |
| `customerId` | positive integer                              |
| `items`      | 1–20 lines, and no `productId` appears twice  |
| `productId`  | positive integer                              |
| `quantity`   | integer 1–100                                 |

## Functions

| Function | What it does | Returns |
| -------- | ------------ | ------- |
| `placeOrder(db, { customerId, items })` | In **one transaction**: lowers each product's `stock`, creates an `Order` with status `PLACED`, and creates one `OrderItem` per line with `unitPriceCents` = the product's current price. `totalCents` = sum of `quantity × unitPriceCents`. | `PlacedOrder`, with items in the same order as the input |
| `cancelOrder(db, orderId)` | In **one transaction**: sets status `CANCELLED`, sets `cancelledAt` to now, and adds each item's quantity back to stock | `PlacedOrder` |
| `getOrder(db, orderId)` | Reads one order | `PlacedOrder`, with items sorted by `productId` |

**Under load:**
- With 3 units in stock and 10 orders of 1 unit at the same time, exactly 3 succeed and 7 throw `InsufficientStockError`. Stock ends at 0, never below.
- If the same order is cancelled several times at the same time, exactly one call succeeds and the others throw `InvalidStateError`. Stock is restored only once.

## Examples

Starting data:

| Product id | priceCents | stock | active |
| ---------- | ---------- | ----- | ------ |
| 1          | 1200       | 5     | true   |
| 2          | 2500       | 1     | true   |
| 3          | 900        | 10    | false  |

**placeOrder**

```ts
await placeOrder(db, { customerId: 1, items: [{ productId: 1, quantity: 2 }, { productId: 2, quantity: 1 }] });
// → { id: 1, customerId: 1, status: "PLACED", totalCents: 4900, createdAt: Date, cancelledAt: null,
//     items: [ { productId: 1, quantity: 2, unitPriceCents: 1200 }, { productId: 2, quantity: 1, unitPriceCents: 2500 } ] }
// stock now: product 1 → 3, product 2 → 0

await placeOrder(db, { customerId: 1, items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }] });
// → throws InsufficientStockError (productId 2). Product 1 stock stays 3 and no order is created.

await placeOrder(db, { customerId: 1, items: [{ productId: 3, quantity: 1 }] });
// → throws NotFoundError (product 3 is not active)

await placeOrder(db, { customerId: 1, items: [{ productId: 1, quantity: 0 }] });
// → throws ValidationError
```

**getOrder**

```ts
await getOrder(db, 1);
// → { id: 1, customerId: 1, status: "PLACED", totalCents: 4900, createdAt: Date, cancelledAt: null,
//     items: [ { productId: 1, quantity: 2, unitPriceCents: 1200 }, { productId: 2, quantity: 1, unitPriceCents: 2500 } ] }

await getOrder(db, 999);
// → throws NotFoundError
```

**cancelOrder**

```ts
await cancelOrder(db, 1);
// → { id: 1, customerId: 1, status: "CANCELLED", totalCents: 4900, createdAt: Date, cancelledAt: Date, items: [...] }
// stock now: product 1 → 5, product 2 → 1

await cancelOrder(db, 1);
// → throws InvalidStateError

await cancelOrder(db, 999);
// → throws NotFoundError
```

## Rules

- Don't change `prisma/schema.prisma` or the exported types and signatures.
- Edit only `task2.ts`. Do not change the tests.
