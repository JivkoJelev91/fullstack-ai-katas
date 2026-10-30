import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { loadTestDatabaseUrl } from "./test-db-config";

export function createTestPrisma(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: loadTestDatabaseUrl() });
  return new PrismaClient({ adapter });
}

/** Removes all rows from the given tables and resets their id sequences. */
export async function truncate(db: PrismaClient, tables: string[]): Promise<void> {
  const list = tables.map((table) => `"${table}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
