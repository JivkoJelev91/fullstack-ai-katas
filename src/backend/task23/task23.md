# Docker Image

**Task ID:** BACKEND-023 · **Level:** 1 · **Files:** `src/backend/task23/Dockerfile`, `src/backend/task23/Dockerfile.dockerignore` · **Tests:** `npm run test:backend:23`

A Docker image packs the app with the exact Node version and dependencies it needs, so it runs the same on every server. Write a production `Dockerfile` for the small app in `server.ts` (a `/health` endpoint on port 3000).

The build runs from the **project root**: `docker build -f src/backend/task23/Dockerfile -t ai-backend .`

## 1. Dockerfile

**REQUIREMENT:** Use these instructions, in this order:

| # | Instruction | Why |
| --- | --- | --- |
| 1 | `FROM node:24-alpine` (any `node:<version>-alpine` with version 20 or newer) | A fixed Node version. Alpine images are small. Never use `latest`, which changes without warning. |
| 2 | `WORKDIR /app` | All following commands run in `/app`. |
| 3 | `COPY package.json package-lock.json ./` | Copy only the dependency list first... |
| 4 | `RUN npm ci --omit=dev --ignore-scripts` | ...and install. Docker caches each step, so dependencies are reinstalled only when these two files change, not on every code change. `--omit=dev` skips test tools. `--ignore-scripts` skips install scripts, which here need dev tools (Prisma). |
| 5 | `COPY src ./src` | Now copy the code. |
| 6 | `ENV NODE_ENV=production` | Libraries such as Express turn on production behavior. |
| 7 | `EXPOSE 3000` | Documents the port the app listens on. |
| 8 | `USER node` | Don't run as `root`: if the app is hacked, the attacker has fewer rights. The `node` user exists in the official image. |
| 9 | `CMD ["node", "src/backend/task23/server.ts"]` | Starts the app. Use the JSON array form, so Node receives stop signals (Ctrl+C, `docker stop`) directly. |

## 2. Dockerfile.dockerignore

**REQUIREMENT:** List what must never go into the image, one per line: `node_modules` (installed inside the image instead), `.env` and `.env.*` (secrets), `.git`.

Docker reads `<Dockerfile name>.dockerignore` next to the Dockerfile.

## How to check your work

Run `npm run test:backend:23`. The tests read both files and check each rule above.

If you have Docker installed, you can also build and run the image:

```bash
docker build -f src/backend/task23/Dockerfile -t ai-backend .
docker run -p 3000:3000 ai-backend
```

Then open `http://localhost:3000/health`.

## Rules

- Edit only `Dockerfile` and `Dockerfile.dockerignore`.
