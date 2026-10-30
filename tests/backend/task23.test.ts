import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(new URL(`../../src/backend/task23/${name}`, import.meta.url), "utf8");

/** The Dockerfile's instructions, without comments and blank lines. */
const instructions = () =>
  read("Dockerfile")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));

const indexOf = (lines: string[], pattern: RegExp) => lines.findIndex((line) => pattern.test(line));

describe("BACKEND-023", () => {
  describe("Dockerfile", () => {
    it("starts from a pinned node alpine image, version 20 or newer", () => {
      const from = instructions()[0] ?? "";
      const match = /^FROM\s+node:(\d+)(?:[.\d]*)-alpine\b/i.exec(from);
      expect(match, `The first instruction must be like "FROM node:24-alpine", got "${from}"`).not.toBeNull();
      expect(Number(match?.[1]), "The Node version must be 20 or newer").toBeGreaterThanOrEqual(20);
    });

    it("works in /app", () => {
      expect(indexOf(instructions(), /^WORKDIR\s+\/app\/?$/i), 'There must be "WORKDIR /app"').toBeGreaterThan(-1);
    });

    it("installs dependencies before copying the source (layer caching)", () => {
      const lines = instructions();
      const copyPackages = indexOf(lines, /^COPY\s+.*package(\*|\.json).*\s+\.\/?$/i);
      const install = indexOf(lines, /^RUN\s+npm\s+ci\b/i);
      const copySource = indexOf(lines, /^COPY\s+(src|\.)\s/i);
      expect(copyPackages, "There must be a COPY of package.json and package-lock.json").toBeGreaterThan(-1);
      expect(install, 'There must be "RUN npm ci ..."').toBeGreaterThan(-1);
      expect(copySource, 'There must be a COPY of the source, e.g. "COPY src ./src"').toBeGreaterThan(-1);
      expect(copyPackages < install && install < copySource, "Order: COPY package files, then RUN npm ci, then COPY the source").toBe(true);
    });

    it("installs only production dependencies without install scripts", () => {
      const install = instructions().find((line) => /^RUN\s+npm\s+ci\b/i.test(line)) ?? "";
      expect(install, "npm ci needs --omit=dev").toContain("--omit=dev");
      expect(install, "npm ci needs --ignore-scripts").toContain("--ignore-scripts");
    });

    it("sets NODE_ENV=production and exposes port 3000", () => {
      const lines = instructions();
      expect(indexOf(lines, /^ENV\s+NODE_ENV[=\s]+"?production"?$/i), 'There must be "ENV NODE_ENV=production"').toBeGreaterThan(-1);
      expect(indexOf(lines, /^EXPOSE\s+3000$/i), 'There must be "EXPOSE 3000"').toBeGreaterThan(-1);
    });

    it("runs as the node user with an exec-form CMD", () => {
      const lines = instructions();
      const user = indexOf(lines, /^USER\s+node$/i);
      const cmd = lines.findIndex((line) => /^CMD\s/i.test(line));
      expect(user, 'There must be "USER node"').toBeGreaterThan(-1);
      expect(cmd, "There must be a CMD").toBeGreaterThan(-1);
      expect(user < cmd, "USER node must come before CMD").toBe(true);
      const args = (() => {
        try {
          return JSON.parse(lines[cmd]!.replace(/^CMD\s+/i, ""));
        } catch {
          return null;
        }
      })();
      expect(args, 'CMD must use the JSON array form: CMD ["node", "src/backend/task23/server.ts"]').toEqual([
        "node",
        "src/backend/task23/server.ts",
      ]);
    });
  });

  describe("Dockerfile.dockerignore", () => {
    it("keeps node_modules, env files and .git out of the image", () => {
      const patterns = read("Dockerfile.dockerignore")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line !== "" && !line.startsWith("#"));
      for (const required of ["node_modules", ".env", ".env.*", ".git"]) {
        expect(patterns, `"${required}" must be listed`).toContain(required);
      }
    });
  });
});
