import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import pg from "pg";
import { loadTestDatabaseUrl } from "./test-db-config";

// Runs once before the database test files: verifies the test database is
// reachable and syncs its tables with prisma/schema.prisma (non-destructively).
// Each test file empties the tables it uses before every test.
export default async function setup(): Promise<void> {
  try {
    await prepare();
  } catch (error) {
    // Vitest cannot source-map errors thrown from global setup, so the stack is replaced
    // with a plain message to keep the output readable.
    const message = `Database test setup failed: ${(error as Error).message}`;
    const clean = new Error(message);
    clean.stack = message;
    throw clean;
  }
}

async function prepare(): Promise<void> {
  const url = loadTestDatabaseUrl();

  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Cannot connect to the test database in DATABASE_URL_TEST: ${(error as Error).message}. ` +
        "Make sure PostgreSQL is running and the database exists.",
    );
  } finally {
    await client.end().catch(() => {});
  }

  const prismaCli = createRequire(import.meta.url).resolve("prisma/build/index.js");
  try {
    execFileSync(process.execPath, [prismaCli, "db", "push"], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      "Failed to sync the test database schema with `prisma db push`.\n" +
        `${stdout?.toString() ?? ""}${stderr?.toString() ?? ""}\n` +
        "If the schema change requires dropping data, recreate the test database (drop and create it again) and re-run the tests.",
    );
  }
}
