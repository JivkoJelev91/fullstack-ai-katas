# Learning Path

## Препоръчителна последователност

| # | Категория | Какво учиш |
| --- | --- | --- |
| 1 | **express** — Backend основи *(започни тук)* | Научи routing, middleware, validation, error handling, async операции, REST API и тестове. Целта е да можеш самостоятелно да изграждаш надеждни API endpoints. |
| 2 | **postgresql-prisma** — Данни и persistence | Научи relations, joins, migrations, transactions, индекси, pagination и моделиране на данни. Особено важни са транзакциите и връзките между потребители, разговори и съобщения. |
| 3 | **ai** — Директна интеграция с модели | Научи API calls към LLM, structured outputs, prompt design, streaming, tool calling, retries, timeouts и обработка на грешки. Започни с mock provider тестове, после използвай реален модел в малки лични експерименти. |
| 4 | **rag** — Retrieval-Augmented Generation | След като можеш да извикаш модел, научи document ingestion, chunking, embeddings, vector search, retrieval, citations и evaluation. Започни с малък RAG pipeline, преди да го свържеш с целия backend. |
| 5 | **langchain** — Оркестрация и интеграции | Учи го след като разбираш основните операции без framework: chains, retrievers, LCEL, integrations и stateful workflows. Така ще знаеш какво прави библиотеката вместо да я използваш като черна кутия. |
| 6 | **agents** — Интелигентни workflow-и | Tool calling, multi-step reasoning workflows, state, memory, permissions, human approval и recovery при грешки. LangGraph и агентните концепции ще са много по-разбираеми, след като вече познаваш LLM и retrieval. |
| 7 | **ai-production** — Production readiness | Evaluation, tracing, observability, caching, rate limiting, cost tracking, security, prompt injection защита, deployment и monitoring. Върни се към тези таскове и приложи наученото към вече изградените AI функции. |
| 8 | **fine-tuning** — Fine-tuning | Остави го за накрая. Учи dataset preparation, supervised fine-tuning, evaluation, LoRA/PEFT и deployment. Важно е първо да знаеш кога обикновен prompt или RAG са достатъчни и кога наистина ти трябва fine-tuning. |

## Backend за AI приложения (паралелна писта)

Категорията **backend** (BACKEND-001 до 025) изгражда стъпка по стъпка един цял backend за AI асистент. Задачите са малки и всяка учи едно нещо. Прави ги заедно с горните категории:

| След категория | Backend задачи | Тема |
| --- | --- | --- |
| 1. express | BACKEND-001, 002 | Validation middleware, централизирано error handling |
| 2. postgresql-prisma | BACKEND-003 – 006 | Migrations, repository, cursor pagination, transactions |
| 1–2 | BACKEND-007 – 011 | Authentication, JWT, user isolation, API keys, rate limiting |
| 3. ai | BACKEND-012 – 014 | Chat endpoint, SSE streaming, usage и budget tracking |
| 4. rag | BACKEND-015 – 018 | Upload, ingestion, semantic search, отговори с citations |
| 6. agents | BACKEND-019, 020 | Background jobs с retries, agent runs с human approval |
| 7. ai-production | BACKEND-021 – 023 | Request IDs и logging, health checks и config, Docker |
| накрая | BACKEND-024, 025 | Capstone: всичко заедно в един backend |

Теми, които вече имат отделни задачи и затова не се повтарят в backend:

| Тема | Задача |
| --- | --- |
| Structured outputs | AI-001 |
| Retries, timeouts, cancellation | AI-002 |
| Fallbacks между модели | AI-005 |
| Tool calling loop | AGENT-001 |
| Tool permissions и audit | AGENT-002 |
| Reranking | RAG-003 |
| Prompt injection защита | AIOPS-001 |
| Tracing (OpenTelemetry) | AIOPS-002 |
| Caching на LLM отговори | AIOPS-003 |
| Prisma с истински PostgreSQL | PRISMA-001, 002 |

Всички задачи и командите им са в [INDEX.md](INDEX.md), а напредъкът ти е в [PROGRESS.md](PROGRESS.md).
