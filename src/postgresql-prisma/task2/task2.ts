/**
 * PRISMA-002: Order Placement with Inventory
 * Specification: ./task2.md (in this folder)
 * Run the tests: npm run test:prisma:2   (requires the test database, see README.md)
 *
 * Keep the exported types and signatures unchanged; the tests depend on them.
 */
import type { PrismaClient } from "../../generated/prisma/client";
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from "../../shared/errors";

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export class InsufficientStockError extends ConflictError {
  constructor(readonly productId: number) {
    super(`Insufficient stock for product ${productId}`);
  }
}

export interface OrderLineInput {
  productId: number;
  quantity: number;
}

export interface PlaceOrderInput {
  customerId: number;
  items: OrderLineInput[];
}

export interface PlacedOrder {
  id: number;
  customerId: number;
  status: "PLACED" | "CANCELLED";
  totalCents: number;
  createdAt: Date;
  cancelledAt: Date | null;
  items: Array<{ productId: number; quantity: number; unitPriceCents: number }>;
}

// ---------------------------------------------------------------------------
// Data access functions
// ---------------------------------------------------------------------------

export async function placeOrder(db: PrismaClient, input: PlaceOrderInput): Promise<PlacedOrder> {
  // TODO: "Validation" and "Functions" sections
  throw new Error("PRISMA-002 placeOrder is not implemented yet");
}

export async function cancelOrder(db: PrismaClient, orderId: number): Promise<PlacedOrder> {
  // TODO: "Functions" section
  throw new Error("PRISMA-002 cancelOrder is not implemented yet");
}

export async function getOrder(db: PrismaClient, orderId: number): Promise<PlacedOrder> {
  // TODO: "Functions" section
  throw new Error("PRISMA-002 getOrder is not implemented yet");
}
