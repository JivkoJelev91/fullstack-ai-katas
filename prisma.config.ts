import "dotenv/config";
import { defineConfig } from "prisma/config";

// `prisma generate` does not need a database connection, so a placeholder is used
// when DATABASE_URL is not set. Commands that connect (db push, migrate) need a real URL.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
