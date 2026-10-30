import pg from "pg";
import { loadTestDatabaseUrl } from "../tests/support/test-db-config";

// Verifies that DATABASE_URL_TEST is configured, safe, and reachable.
// Usage: npm run db:test:check
async function main(): Promise<void> {
  const url = loadTestDatabaseUrl();
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const { rows } = await client.query<{ db: string; version: string }>(
    "SELECT current_database() AS db, version() AS version",
  );
  await client.end();
  console.log(`OK: connected to test database "${rows[0]?.db}"`);
  console.log(rows[0]?.version);
}

main().catch((error: unknown) => {
  console.error(`FAILED: ${(error as Error).message}`);
  process.exit(1);
});
