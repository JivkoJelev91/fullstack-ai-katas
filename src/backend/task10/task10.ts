/**
 * BACKEND-010: API Keys
 * Specification: ./task10.md (in this folder)
 * Run the tests: npm run test:backend:10
 *
 * Keep the exported names and signatures unchanged; the tests depend on them.
 */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import express, { type Express, type RequestHandler } from "express";

export interface ApiKeyRecord {
  id: string;
  userId: string;
  /** SHA-256 of the full key, as hex. The key itself is never stored. */
  keyHash: string;
  revoked: boolean;
}

// Helpers you can use:
//   randomBytes(24).toString("hex")                     48 random hex characters
//   createHash("sha256").update(text).digest("hex")     SHA-256 as hex
//   randomUUID()                                        a new id
void createHash;
void randomBytes;
void randomUUID;

export function createApiKeyStore() {
  // Storage: key = record id, value = the record.
  const records = new Map<string, ApiKeyRecord>();

  return {
    /** Returns the new key. This is the only time the full key is visible. */
    create(_userId: string): { id: string; key: string } {
      throw new Error("Not implemented: create");
    },

    /** Returns the owner's user id for a valid, not revoked key, otherwise null. */
    verify(_key: string): string | null {
      throw new Error("Not implemented: verify");
    },

    /** Returns true if a record with that id existed. */
    revoke(_id: string): boolean {
      throw new Error("Not implemented: revoke");
    },

    /** What is stored (used by the tests). */
    records: (): ApiKeyRecord[] => [...records.values()],
  };
}

export type ApiKeyStore = ReturnType<typeof createApiKeyStore>;

export function requireApiKey(_store: ApiKeyStore): RequestHandler {
  return (_req, _res, _next) => {
    throw new Error("Not implemented: requireApiKey");
  };
}

export function createApp(store: ApiKeyStore): Express {
  const app = express();
  app.get("/whoami", requireApiKey(store), (_req, res) => {
    res.json({ userId: res.locals.userId });
  });
  return app;
}
