import { describe, expect, it } from "vitest";
import { LLMProviderError, type CompletionRequest, type CompletionResponse, type LLMClient } from "../../src/ai/shared/llm";
import {
  AllRoutesFailedError,
  BudgetExceededError,
  createModelRouter,
  type BudgetStore,
  type ModelRoute,
} from "../../src/ai/task5/task5";
import { expectRejects } from "../support/expect-rejects";
import { reply, scriptedLLM } from "../support/mock-llm";

class MemoryBudget implements BudgetStore {
  readonly spent = new Map<string, number>();
  async getSpent(tenantId: string, day: string) {
    return this.spent.get(`${tenantId}|${day}`) ?? 0;
  }
  async addSpent(tenantId: string, day: string, usd: number) {
    const key = `${tenantId}|${day}`;
    this.spent.set(key, (this.spent.get(key) ?? 0) + usd);
  }
}

const T0 = Date.UTC(2026, 2, 10, 12, 0, 0);
const DAY = "2026-03-10";

// 400 characters → 100 estimated input tokens.
const request = (overrides: Partial<Omit<CompletionRequest, "model">> = {}): Omit<CompletionRequest, "model"> => ({
  messages: [{ role: "user", content: "x".repeat(400) }],
  maxTokens: 100,
  ...overrides,
});

const usage = (inputTokens: number, outputTokens: number) => ({ usage: { inputTokens, outputTokens } });

function route(id: string, client: LLMClient, overrides: Partial<ModelRoute> = {}): ModelRoute {
  const pricing = id === "primary" ? { inputPerMTok: 10, outputPerMTok: 30 } : { inputPerMTok: 0.5, outputPerMTok: 1.5 };
  return { id, model: `${id}-model`, client, pricing, limits: { requestsPerMinute: 100, tokensPerMinute: 1_000_000 }, ...overrides };
}

function setup(opts: { primary?: Parameters<typeof scriptedLLM>; backup?: Parameters<typeof scriptedLLM>; limit?: number; primaryLimits?: ModelRoute["limits"] } = {}) {
  let now = T0;
  const primary = scriptedLLM(...(opts.primary ?? [reply("from primary", usage(120, 50))]));
  const backup = scriptedLLM(...(opts.backup ?? [reply("from backup", usage(80, 40))]));
  const budget = new MemoryBudget();
  const router = createModelRouter({
    routes: [
      route("primary", primary.llm, opts.primaryLimits ? { limits: opts.primaryLimits } : {}),
      route("backup", backup.llm),
    ],
    budget: { store: budget, dailyLimitUsd: opts.limit ?? 1 },
    now: () => now,
  });
  return { router, primary, backup, budget, advance: (ms: number) => (now += ms), setNow: (t: number) => (now = t) };
}

describe("AI-005", () => {
  describe("Routing", () => {
    it("uses the first route, sets its model and reports the cost", async () => {
      const { router, primary, backup, budget } = setup();
      const res = await router.complete("acme", request({ temperature: 0 }));
      expect(res).toMatchObject({ text: "from primary", routeId: "primary", model: "primary-model", attempts: [{ routeId: "primary", outcome: "success" }] });
      expect(res.costUsd).toBeCloseTo(120 * 10e-6 + 50 * 30e-6, 10);
      expect(primary.calls[0]).toMatchObject({ model: "primary-model", maxTokens: 100, temperature: 0 });
      expect(backup.complete).not.toHaveBeenCalled();
      expect(await budget.getSpent("acme", DAY)).toBeCloseTo(0.0027, 10);
    });

    it.each([408, 500, 502, 503, 504, 529])("falls back after a %i error", async (status) => {
      const { router, budget } = setup({ primary: [new LLMProviderError("fail", status)] });
      const res = await router.complete("acme", request());
      expect(res.routeId).toBe("backup");
      expect(res.attempts).toEqual([
        { routeId: "primary", outcome: "error" },
        { routeId: "backup", outcome: "success" },
      ]);
      expect(await budget.getSpent("acme", DAY)).toBeCloseTo(80 * 0.5e-6 + 40 * 1.5e-6, 12);
    });

    it("falls back after a timeout error", async () => {
      const timeout = Object.assign(new Error("timed out"), { name: "LLMTimeoutError" });
      const { router } = setup({ primary: [timeout] });
      expect((await router.complete("acme", request())).routeId).toBe("backup");
    });

    it.each([400, 401, 403, 422])("rethrows a %i error without trying other routes", async (status) => {
      const error = new LLMProviderError("bad request", status);
      const { router, backup } = setup({ primary: [error] });
      let caught: unknown;
      try {
        await router.complete("acme", request());
      } catch (e) {
        caught = e;
      }
      expect(caught).toBe(error);
      expect(backup.complete).not.toHaveBeenCalled();
    });

    it("rethrows programming errors unchanged", async () => {
      const bug = new TypeError("undefined is not a function");
      const { router } = setup({ primary: [bug] });
      await expect(router.complete("acme", request())).rejects.toBe(bug);
    });

    it("throws AllRoutesFailedError with attempts and the last error", async () => {
      const last = new LLMProviderError("down", 503);
      const { router, budget } = setup({ primary: [new LLMProviderError("down", 500)], backup: [last] });
      const error = await expectRejects(router.complete("acme", request()), AllRoutesFailedError);
      expect(error.attempts).toEqual([
        { routeId: "primary", outcome: "error" },
        { routeId: "backup", outcome: "error" },
      ]);
      expect(error.lastError).toBe(last);
      expect(await budget.getSpent("acme", DAY)).toBe(0);
    });
  });

  describe("Rate limits", () => {
    it("skips a route that reached its requests per minute and recovers after the window", async () => {
      const { router, primary, advance } = setup({ primaryLimits: { requestsPerMinute: 2, tokensPerMinute: 1_000_000 } });
      await router.complete("acme", request());
      advance(10_000);
      await router.complete("acme", request());
      advance(10_000);
      const third = await router.complete("acme", request());
      expect(third.attempts).toEqual([
        { routeId: "primary", outcome: "rate_limited" },
        { routeId: "backup", outcome: "success" },
      ]);
      expect(primary.complete).toHaveBeenCalledTimes(2);

      advance(40_000); // first request is now exactly 60 s old
      expect((await router.complete("acme", request())).routeId).toBe("primary");
    });

    it("puts a route into cooldown after a 429 using retryAfterMs", async () => {
      const { router, primary, advance } = setup({
        primary: [new LLMProviderError("slow down", 429, 30_000), reply("primary again", usage(1, 1))],
      });
      const first = await router.complete("acme", request());
      expect(first.attempts).toEqual([
        { routeId: "primary", outcome: "rate_limited" },
        { routeId: "backup", outcome: "success" },
      ]);
      advance(29_999);
      expect((await router.complete("acme", request())).attempts[0]).toEqual({ routeId: "primary", outcome: "rate_limited" });
      expect(primary.complete).toHaveBeenCalledTimes(1);
      advance(1);
      expect((await router.complete("acme", request())).text).toBe("primary again");
    });

    it("uses a 60 second cooldown when the 429 has no retryAfterMs", async () => {
      const { router, advance } = setup({ primary: [new LLMProviderError("slow down", 429), reply("back", usage(1, 1))] });
      await router.complete("acme", request());
      advance(59_999);
      expect((await router.complete("acme", request())).routeId).toBe("backup");
      advance(1);
      expect((await router.complete("acme", request())).routeId).toBe("primary");
    });

    it("throws AllRoutesFailedError when every route is rate limited", async () => {
      const { router } = setup({ primary: [new LLMProviderError("slow", 429)], backup: [new LLMProviderError("slow", 429)] });
      const error = await expectRejects(router.complete("acme", request()), AllRoutesFailedError);
      expect(error.attempts.map((a) => a.outcome)).toEqual(["rate_limited", "rate_limited"]);
    });
  });

  describe("Budgets", () => {
    it("skips a route whose estimate does not fit and uses a cheaper one", async () => {
      // Primary estimate: 100 × 10e-6 + 100 × 30e-6 = 0.004; backup estimate: 0.0002.
      const { router, budget, primary } = setup({ limit: 0.01 });
      await budget.addSpent("acme", DAY, 0.0075);
      const res = await router.complete("acme", request());
      expect(res.attempts).toEqual([
        { routeId: "primary", outcome: "skipped_budget" },
        { routeId: "backup", outcome: "success" },
      ]);
      expect(primary.complete).not.toHaveBeenCalled();
    });

    it("throws BudgetExceededError when no route fits the budget", async () => {
      const { router, budget, backup } = setup({ limit: 1 });
      await budget.addSpent("acme", DAY, 1);
      const error = await expectRejects(router.complete("acme", request()), BudgetExceededError);
      expect(error.tenantId).toBe("acme");
      expect(backup.complete).not.toHaveBeenCalled();
    });

    it("allows a request whose estimate exactly reaches the limit", async () => {
      const { router, budget } = setup({ limit: 0.01 });
      await budget.addSpent("acme", DAY, 0.006);
      expect((await router.complete("acme", request())).routeId).toBe("primary");
    });

    it("tracks budgets per tenant and per UTC day", async () => {
      const { router, budget, setNow } = setup({ limit: 0.01 });
      await budget.addSpent("acme", DAY, 0.01);
      expect((await router.complete("globex", request())).routeId).toBe("primary");
      await expectRejects(router.complete("acme", request()), BudgetExceededError);
      setNow(Date.UTC(2026, 2, 11, 0, 0, 0));
      expect((await router.complete("acme", request())).routeId).toBe("primary");
      expect(await budget.getSpent("acme", "2026-03-11")).toBeGreaterThan(0);
    });

    it("uses a custom input token estimator", async () => {
      const budget = new MemoryBudget();
      const p = scriptedLLM(reply("p", usage(1, 1)));
      const router = createModelRouter({
        routes: [route("primary", p.llm)],
        budget: { store: budget, dailyLimitUsd: 0.0035 },
        now: () => T0,
        estimateInputTokens: () => 10_000, // estimate: 0.1 + 0.003 → over budget
      });
      await expectRejects(router.complete("acme", request()), BudgetExceededError);
    });
  });
});
