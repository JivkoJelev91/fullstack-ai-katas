import path from "node:path";
import { config } from "dotenv";

/**
 * Reads DATABASE_URL_TEST from `.env.test` (or the environment) and refuses to
 * continue unless the URL points at a database whose name contains "test".
 */
export function loadTestDatabaseUrl(): string {
  config({ path: path.resolve(process.cwd(), ".env.test"), quiet: true });

  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error(
      "DATABASE_URL_TEST is not set. Copy .env.test.example to .env.test and point it at a dedicated test database.",
    );
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  } catch {
    throw new Error("DATABASE_URL_TEST is not a valid PostgreSQL connection URL.");
  }

  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to run destructive database tests against "${databaseName}". ` +
        'The test database name must contain "test".',
    );
  }

  return url;
}
