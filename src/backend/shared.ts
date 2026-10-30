/**
 * Shared contracts for the backend tasks.
 */
export type { SqlDatabase, SqlExecutor, Embedder } from "../rag/shared";
export type { ChatMessage, CompletionRequest, CompletionResponse, LLMClient } from "../ai/shared/llm";

/**
 * Database schema used by BACKEND-004, -005 and -006 (the tests create it for you).
 * BACKEND-003 asks you to build the first version of it yourself with migrations.
 */
export const CHAT_SCHEMA = `
CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  seq             BIGSERIAL NOT NULL UNIQUE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
