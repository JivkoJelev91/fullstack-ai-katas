# Task Index

Levels: **1** = focused fundamentals · **2** = realistic multi-concept feature · **3** = architecture, reliability, security or performance.

Workflow for every task: read the spec → open the starter file → implement → run the test command → read the PASS/FAIL output.

## Express / Node.js

| Task ID | Title | Difficulty | Technologies | Prerequisites | Spec | Starter file (edit this) | Test command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EXPRESS-001 | Create a Task | Level 1 | TypeScript, Express 5 | — | [task1.md](src/express/task1/task1.md) | [src/express/task1/task1.ts](src/express/task1/task1.ts) | `npm run test:express:1` |
| EXPRESS-002 | Read Tasks | Level 1 | TypeScript, Express 5 | EXPRESS-001 | [task2.md](src/express/task2/task2.md) | [src/express/task2/task2.ts](src/express/task2/task2.ts) | `npm run test:express:2` |
| EXPRESS-003 | Update a Task | Level 1 | TypeScript, Express 5 | EXPRESS-002 | [task3.md](src/express/task3/task3.md) | [src/express/task3/task3.ts](src/express/task3/task3.ts) | `npm run test:express:3` |
| EXPRESS-004 | Delete a Task | Level 1 | TypeScript, Express 5 | EXPRESS-003 | [task4.md](src/express/task4/task4.md) | [src/express/task4/task4.ts](src/express/task4/task4.ts) | `npm run test:express:4` |
| EXPRESS-005 | Product Catalog Search API | Level 2 | TypeScript, Express 5 | EXPRESS-004 | [task5.md](src/express/task5/task5.md) | [src/express/task5/task5.ts](src/express/task5/task5.ts) | `npm run test:express:5` |
| EXPRESS-006 | Team Notes API with Authentication | Level 2 | TypeScript, Express 5 | EXPRESS-004 | [task6.md](src/express/task6/task6.md) | [src/express/task6/task6.ts](src/express/task6/task6.ts) | `npm run test:express:6` |

## Backend for AI Applications

Small steps that build one complete AI assistant backend: API, database, security, AI, RAG, jobs, production. The learning order is in [LEARNING-PATH.md](LEARNING-PATH.md).

| Task ID | Title | Difficulty | Technologies | Prerequisites | Spec | Starter file (edit this) | Test command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BACKEND-001 | Validation Middleware | Level 1 | Express middleware, Zod | EXPRESS-001 | [task1.md](src/backend/task1/task1.md) | [src/backend/task1/task1.ts](src/backend/task1/task1.ts) | `npm run test:backend:1` |
| BACKEND-002 | Centralized Error Handling | Level 1 | Error classes, error middleware | BACKEND-001 | [task2.md](src/backend/task2/task2.md) | [src/backend/task2/task2.ts](src/backend/task2/task2.ts) | `npm run test:backend:2` |
| BACKEND-003 | Database Migrations | Level 1–2 | PostgreSQL (PGlite), migrations, constraints | BACKEND-002 | [task3.md](src/backend/task3/task3.md) | [src/backend/task3/task3.ts](src/backend/task3/task3.ts) | `npm run test:backend:3` |
| BACKEND-004 | Conversation Repository | Level 1–2 | SQL, JOIN, GROUP BY, row mapping | BACKEND-003 | [task4.md](src/backend/task4/task4.md) | [src/backend/task4/task4.ts](src/backend/task4/task4.ts) | `npm run test:backend:4` |
| BACKEND-005 | Cursor Pagination | Level 2 | Keyset pagination, SQL | BACKEND-004 | [task5.md](src/backend/task5/task5.md) | [src/backend/task5/task5.ts](src/backend/task5/task5.ts) | `npm run test:backend:5` |
| BACKEND-006 | Transactions | Level 2 | Transactions, rollback | BACKEND-004 | [task6.md](src/backend/task6/task6.md) | [src/backend/task6/task6.ts](src/backend/task6/task6.ts) | `npm run test:backend:6` |
| BACKEND-007 | Authentication Middleware | Level 1 | Bearer tokens, res.locals | BACKEND-002 | [task7.md](src/backend/task7/task7.md) | [src/backend/task7/task7.ts](src/backend/task7/task7.ts) | `npm run test:backend:7` |
| BACKEND-008 | JSON Web Tokens (HS256) | Level 2 | JWT, HMAC, node:crypto | BACKEND-007 | [task8.md](src/backend/task8/task8.md) | [src/backend/task8/task8.ts](src/backend/task8/task8.ts) | `npm run test:backend:8` |
| BACKEND-009 | User Isolation | Level 1 | Authorization, object-level access | BACKEND-007 | [task9.md](src/backend/task9/task9.md) | [src/backend/task9/task9.ts](src/backend/task9/task9.ts) | `npm run test:backend:9` |
| BACKEND-010 | API Keys | Level 2 | Hashed secrets, SHA-256 | BACKEND-007 | [task10.md](src/backend/task10/task10.md) | [src/backend/task10/task10.ts](src/backend/task10/task10.ts) | `npm run test:backend:10` |
| BACKEND-011 | Rate Limiting | Level 1–2 | Fixed window, 429, Retry-After | BACKEND-007 | [task11.md](src/backend/task11/task11.md) | [src/backend/task11/task11.ts](src/backend/task11/task11.ts) | `npm run test:backend:11` |
| BACKEND-012 | Chat Endpoint | Level 2 | LLM API, conversation history | BACKEND-009, AI-001 | [task12.md](src/backend/task12/task12.md) | [src/backend/task12/task12.ts](src/backend/task12/task12.ts) | `npm run test:backend:12` |
| BACKEND-013 | Streaming Replies over SSE | Level 2 | Server-Sent Events, async iterables | BACKEND-012 | [task13.md](src/backend/task13/task13.md) | [src/backend/task13/task13.ts](src/backend/task13/task13.ts) | `npm run test:backend:13` |
| BACKEND-014 | Usage and Budget Tracking | Level 2 | Token costs, budgets, 402 | BACKEND-012 | [task14.md](src/backend/task14/task14.md) | [src/backend/task14/task14.ts](src/backend/task14/task14.ts) | `npm run test:backend:14` |
| BACKEND-015 | Document Upload | Level 1 | Upload validation, 202/413/415 | BACKEND-009 | [task15.md](src/backend/task15/task15.md) | [src/backend/task15/task15.ts](src/backend/task15/task15.ts) | `npm run test:backend:15` |
| BACKEND-016 | Ingestion Pipeline | Level 2 | Chunking, embeddings, idempotency | BACKEND-015 | [task16.md](src/backend/task16/task16.md) | [src/backend/task16/task16.ts](src/backend/task16/task16.ts) | `npm run test:backend:16` |
| BACKEND-017 | Semantic Search | Level 2 | Cosine similarity, vector search | BACKEND-016 | [task17.md](src/backend/task17/task17.md) | [src/backend/task17/task17.ts](src/backend/task17/task17.ts) | `npm run test:backend:17` |
| BACKEND-018 | Answers with Citations | Level 2 | RAG prompt, citations | BACKEND-017 | [task18.md](src/backend/task18/task18.md) | [src/backend/task18/task18.ts](src/backend/task18/task18.ts) | `npm run test:backend:18` |
| BACKEND-019 | Background Job Queue | Level 2 | Queues, retries, FIFO | BACKEND-016 | [task19.md](src/backend/task19/task19.md) | [src/backend/task19/task19.ts](src/backend/task19/task19.ts) | `npm run test:backend:19` |
| BACKEND-020 | Agent Runs with Human Approval | Level 2 | State persistence, approval, recovery | BACKEND-019 | [task20.md](src/backend/task20/task20.md) | [src/backend/task20/task20.ts](src/backend/task20/task20.ts) | `npm run test:backend:20` |
| BACKEND-021 | Request IDs and Structured Logging | Level 1 | Observability, middleware | BACKEND-002 | [task21.md](src/backend/task21/task21.md) | [src/backend/task21/task21.ts](src/backend/task21/task21.ts) | `npm run test:backend:21` |
| BACKEND-022 | Health Checks and Configuration | Level 1 | Env config, liveness/readiness | BACKEND-021 | [task22.md](src/backend/task22/task22.md) | [src/backend/task22/task22.ts](src/backend/task22/task22.ts) | `npm run test:backend:22` |
| BACKEND-023 | Docker Image | Level 1 | Dockerfile, .dockerignore | BACKEND-022 | [task23.md](src/backend/task23/task23.md) | [src/backend/task23/Dockerfile](src/backend/task23/Dockerfile) | `npm run test:backend:23` |
| BACKEND-024 | Capstone 1: Chat API | Level 2 | Everything from parts 1–4 | BACKEND-002, -007, -009, -012 | [task24.md](src/backend/task24/task24.md) | [src/backend/task24/task24.ts](src/backend/task24/task24.ts) | `npm run test:backend:24` |
| BACKEND-025 | Capstone 2: Documents and Q&A | Level 2 | Everything from part 5 | BACKEND-015 to -018, BACKEND-024 | [task25.md](src/backend/task25/task25.md) | [src/backend/task25/task25.ts](src/backend/task25/task25.ts) | `npm run test:backend:25` |

## PostgreSQL / Prisma

| Task ID | Title | Difficulty | Technologies | Prerequisites | Spec | Starter file (edit this) | Test command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PRISMA-001 | Library Catalog Data Access Layer | Level 1 | TypeScript, PostgreSQL, Prisma 7 | — | [task1.md](src/postgresql-prisma/task1/task1.md) | [src/postgresql-prisma/task1/task1.ts](src/postgresql-prisma/task1/task1.ts) | `npm run test:prisma:1` |
| PRISMA-002 | Order Placement with Inventory | Level 2–3 | TypeScript, PostgreSQL, Prisma 7 | PRISMA-001 | [task2.md](src/postgresql-prisma/task2/task2.md) | [src/postgresql-prisma/task2/task2.ts](src/postgresql-prisma/task2/task2.ts) | `npm run test:prisma:2` |

## AI — LLM API Integration

| Task ID | Title | Difficulty | Technologies | Prerequisites | Spec | Starter file (edit this) | Test command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AI-001 | Support Ticket Triage with an LLM | Level 1–2 | TypeScript, LLM API, schema validation | — | [task1.md](src/ai/task1/task1.md) | [src/ai/task1/task1.ts](src/ai/task1/task1.ts) | `npm run test:ai:1` |
| AI-002 | Resilient LLM Client: Timeouts, Retries, Cancellation | Level 2–3 | TypeScript, async control flow, AbortController | AI-001 | [task2.md](src/ai/task2/task2.md) | [src/ai/task2/task2.ts](src/ai/task2/task2.ts) | `npm run test:ai:2` |
| AI-003 | Multi-Provider Adapters with Images | Level 2 | TypeScript, Anthropic & OpenAI HTTP APIs, images | AI-001 | [task3.md](src/ai/task3/task3.md) | [src/ai/task3/task3.ts](src/ai/task3/task3.ts) | `npm run test:ai:3` |
| AI-004 | Streaming LLM Responses: SSE Parsing and Relay | Level 2 | TypeScript, Server-Sent Events, Express 5 | AI-003, EXPRESS-004 | [task4.md](src/ai/task4/task4.md) | [src/ai/task4/task4.ts](src/ai/task4/task4.ts) | `npm run test:ai:4` |
| AI-005 | Model Router with Fallbacks, Rate Limits and Budgets | Level 3 | TypeScript, rate limiting, cost accounting | AI-002, AI-003 | [task5.md](src/ai/task5/task5.md) | [src/ai/task5/task5.ts](src/ai/task5/task5.ts) | `npm run test:ai:5` |

## RAG & Vector Databases

| Task ID | Title | Difficulty | Technologies | Prerequisites | Spec | Starter file (edit this) | Test command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RAG-001 | Structure-Aware Document Chunking | Level 1 | TypeScript, text processing | — | [task1.md](src/rag/task1/task1.md) | [src/rag/task1/task1.ts](src/rag/task1/task1.ts) | `npm run test:rag:1` |
| RAG-002 | Incremental Ingestion and Semantic Search with pgvector | Level 2 | PostgreSQL, pgvector, SQL, embeddings | RAG-001, PRISMA-001 | [task2.md](src/rag/task2/task2.md) | [src/rag/task2/task2.ts](src/rag/task2/task2.ts) | `npm run test:rag:2` |
| RAG-003 | Hybrid Search with Reciprocal Rank Fusion and Reranking | Level 2–3 | PostgreSQL full-text search, pgvector, RRF | RAG-002 | [task3.md](src/rag/task3/task3.md) | [src/rag/task3/task3.ts](src/rag/task3/task3.ts) | `npm run test:rag:3` |
| RAG-004 | Qdrant Vector Store Adapter with Hybrid Queries | Level 2 | Qdrant, dense + sparse vectors, multi-tenancy | RAG-002, RAG-003 | [task4.md](src/rag/task4/task4.md) | [src/rag/task4/task4.ts](src/rag/task4/task4.ts) | `npm run test:rag:4` |
| RAG-005 | Grounded Answers with Verified Citations | Level 2–3 | RAG, structured output, citation validation | AI-001, RAG-002 | [task5.md](src/rag/task5/task5.md) | [src/rag/task5/task5.ts](src/rag/task5/task5.ts) | `npm run test:rag:5` |
| RAG-006 | RAG Evaluation: Retrieval Metrics, Faithfulness and Regression Gates | Level 3 | IR metrics, LLM-as-judge, CI gates | RAG-003, RAG-005 | [task6.md](src/rag/task6/task6.md) | [src/rag/task6/task6.ts](src/rag/task6/task6.ts) | `npm run test:rag:6` |

## LangChain & LangGraph

| Task ID | Title | Difficulty | Technologies | Prerequisites | Spec | Starter file (edit this) | Test command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LC-001 | Release Notes Chain with LCEL, Retries and Fallback | Level 1–2 | LangChain.js, LCEL, output parsers | AI-001 | [task1.md](src/langchain/task1/task1.md) | [src/langchain/task1/task1.ts](src/langchain/task1/task1.ts) | `npm run test:langchain:1` |
| LC-002 | Tenant Retriever and Conversational RAG Chain | Level 2 | LangChain.js retrievers, chat history | LC-001, RAG-002 | [task2.md](src/langchain/task2/task2.md) | [src/langchain/task2/task2.ts](src/langchain/task2/task2.ts) | `npm run test:langchain:2` |
| LC-003 | Ticket Workflow with LangGraph and Checkpointing | Level 2 | LangGraph.js, reducers, conditional edges, checkpointers | LC-001 | [task3.md](src/langchain/task3/task3.md) | [src/langchain/task3/task3.ts](src/langchain/task3/task3.ts) | `npm run test:langchain:3` |
| LC-004 | Refund Approval with Human-in-the-Loop (LangGraph) | Level 3 | LangGraph.js interrupt/Command, idempotency | LC-003 | [task4.md](src/langchain/task4/task4.md) | [src/langchain/task4/task4.ts](src/langchain/task4/task4.ts) | `npm run test:langchain:4` |

## Agentic AI Workflows

| Task ID | Title | Difficulty | Technologies | Prerequisites | Spec | Starter file (edit this) | Test command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AGENT-001 | Tool-Calling Agent Loop | Level 2 | Tool calling, Zod, JSON Schema, concurrency | AI-001, AI-002 | [task1.md](src/agents/task1/task1.md) | [src/agents/task1/task1.ts](src/agents/task1/task1.ts) | `npm run test:agents:1` |
| AGENT-002 | Guarded Tool Execution: Permissions, Approvals, Audit | Level 2–3 | Authorization, approval workflows, audit logs | AGENT-001, EXPRESS-006 | [task2.md](src/agents/task2/task2.md) | [src/agents/task2/task2.ts](src/agents/task2/task2.ts) | `npm run test:agents:2` |
| AGENT-003 | Plan-and-Execute Agent with Replanning and Memory | Level 3 | LangGraph.js orchestration, planning, memory | AGENT-001, LC-003 | [task3.md](src/agents/task3/task3.md) | [src/agents/task3/task3.ts](src/agents/task3/task3.ts) | `npm run test:agents:3` |

## AI Production Engineering

| Task ID | Title | Difficulty | Technologies | Prerequisites | Spec | Starter file (edit this) | Test command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AIOPS-001 | LLM Security: PII Redaction and Prompt-Injection Defense | Level 2 | LLM security, regex, checksums | AI-001, RAG-005 | [task1.md](src/ai-production/task1/task1.md) | [src/ai-production/task1/task1.ts](src/ai-production/task1/task1.ts) | `npm run test:aiops:1` |
| AIOPS-002 | LLM Observability: OpenTelemetry Spans and Metrics | Level 2 | OpenTelemetry, GenAI conventions, percentiles | AI-002 | [task2.md](src/ai-production/task2/task2.md) | [src/ai-production/task2/task2.ts](src/ai-production/task2/task2.ts) | `npm run test:aiops:2` |
| AIOPS-003 | LLM Response Cache: Exact, Single-Flight and Semantic | Level 2–3 | Caching, hashing, embeddings, request coalescing | AI-002, RAG-002 | [task3.md](src/ai-production/task3/task3.md) | [src/ai-production/task3/task3.ts](src/ai-production/task3/task3.ts) | `npm run test:aiops:3` |
| AIOPS-004 | LLM Evaluation Suite with a CI Regression Gate | Level 3 | LLM evaluation, LLM-as-judge, concurrency | AI-001, RAG-006 | [task4.md](src/ai-production/task4/task4.md) | [src/ai-production/task4/task4.ts](src/ai-production/task4/task4.ts) | `npm run test:aiops:4` |
| AIOPS-005 | Canary and Shadow Rollout for a New Model | Level 3 | Progressive delivery, monitoring, shadow traffic | AIOPS-002, AIOPS-004 | [task5.md](src/ai-production/task5/task5.md) | [src/ai-production/task5/task5.ts](src/ai-production/task5/task5.ts) | `npm run test:aiops:5` |

## Model Fine-Tuning (TypeScript)

| Task ID | Title | Difficulty | Technologies | Prerequisites | Spec | Starter file (edit this) | Test command |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FT-001 | Prompting vs RAG vs Fine-Tuning: Decision and Cost Model | Level 1 | Solution architecture, cost modelling | — | [task1.md](src/fine-tuning/task1/task1.md) | [src/fine-tuning/task1/task1.ts](src/fine-tuning/task1/task1.ts) | `npm run test:ft:1` |
| FT-002 | Fine-Tuning Dataset Preparation (JSONL) | Level 2 | JSONL, validation, de-duplication, privacy | FT-001 | [task2.md](src/fine-tuning/task2/task2.md) | [src/fine-tuning/task2/task2.ts](src/fine-tuning/task2/task2.ts) | `npm run test:ft:2` |
| FT-003 | Supervised Fine-Tuning Data: Label Masking, Packing, LoRA Config | Level 2–3 | SFT, tokenization, LoRA / PEFT | FT-002 | [task3.md](src/fine-tuning/task3/task3.md) | [src/fine-tuning/task3/task3.ts](src/fine-tuning/task3/task3.ts) | `npm run test:ft:3` |
| FT-004 | Fine-Tuning Job Orchestration and Promotion Gate | Level 3 | Provider fine-tuning APIs, idempotency, release gates | FT-002, AIOPS-004 | [task4.md](src/fine-tuning/task4/task4.md) | [src/fine-tuning/task4/task4.ts](src/fine-tuning/task4/task4.ts) | `npm run test:ft:4` |

Category-wide commands: `npm run test:express`, `npm run test:backend`, `npm run test:prisma`, `npm run test:ai`, `npm run test:rag`, `npm run test:langchain`, `npm run test:agents`, `npm run test:aiops`, `npm run test:ft`. Everything: `npm test` (needs the test database) or `npm run test:unit` (everything that does not need a database).

Further categories (TypeScript, Next.js, Testing, Full-Stack) are added in subsequent batches.
