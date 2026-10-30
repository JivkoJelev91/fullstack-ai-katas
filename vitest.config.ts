import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: ["./tests/support/reporter.ts"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/postgresql-prisma/**"],
          testTimeout: 10_000,
        },
      },
      {
        extends: true,
        test: {
          name: "database",
          environment: "node",
          include: ["tests/postgresql-prisma/**/*.test.ts"],
          globalSetup: ["./tests/support/db-global-setup.ts"],
          // Database test files share one test database, so they run one at a time.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
