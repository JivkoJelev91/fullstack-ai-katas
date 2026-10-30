import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ApprovalError, createGuardedExecutor, type CallerContext, type ToolPolicy } from "../../src/agents/task2/task2";
import { expectThrows } from "../support/expect-rejects";

function setup(overrides: { policies?: ToolPolicy[]; ttl?: number } = {}) {
  let now = 1_000_000;
  let id = 0;
  const tools = {
    search_docs: vi.fn(async (args: Record<string, unknown>) => ({ hits: [`doc for ${args.q}`] })),
    send_email: vi.fn(async (args: Record<string, unknown>) => ({ sent: args.to })),
    delete_customer: vi.fn(async (args: Record<string, unknown>) => ({ deleted: args.id })),
    export_data: vi.fn(async () => Promise.reject(new Error("export service unavailable"))),
  };
  const policies: ToolPolicy[] = overrides.policies ?? [
    { tool: "search_docs", risk: "read", requiredScopes: ["docs:read"] },
    {
      tool: "send_email",
      risk: "write",
      requiredScopes: ["email:send"],
      guard: (args) => (typeof args.to === "string" && args.to.endsWith("@company.com") ? null : "external recipients are not allowed"),
    },
    { tool: "delete_customer", risk: "destructive", requiredScopes: ["customers:write", "customers:delete"] },
    { tool: "export_data", risk: "write", requiredScopes: [], requiresApproval: false },
  ];
  const executor = createGuardedExecutor({
    tools,
    policies,
    now: () => now,
    approvalTtlMs: overrides.ttl,
    generateId: () => `a-${++id}`,
  });
  return { executor, tools, advance: (ms: number) => (now += ms), now: () => now };
}

const ann: CallerContext = { userId: "u-ann", scopes: ["docs:read", "email:send", "customers:write", "customers:delete"] };
const lead = { approverId: "u-lead", approverScopes: ["approvals:grant"] };
const del = (extra: Record<string, unknown> = {}) => ({ callId: "c1", tool: "delete_customer", args: { id: "cus_9", reason: "GDPR request" }, ...extra });

describe("AGENT-002", () => {

  describe("Checks", () => {
    it("executes an allowed read tool", async () => {
      const { executor, tools } = setup();
      expect(await executor.execute({ callId: "c1", tool: "search_docs", args: { q: "vpn" } }, ann)).toEqual({ status: "executed", result: { hits: ["doc for vpn"] } });
      expect(tools.search_docs).toHaveBeenCalledWith({ q: "vpn" }, ann);
    });

    it("denies tools without a policy, even if they are implemented", async () => {
      const executor = createGuardedExecutor({ tools: { hidden: async () => "secret" }, policies: [] });
      expect(await executor.execute({ callId: "c1", tool: "hidden", args: {} }, ann)).toEqual({ status: "denied", reason: "no_policy" });
      expect(await executor.execute({ callId: "c2", tool: "nonexistent", args: {} }, ann)).toEqual({ status: "denied", reason: "no_policy" });
    });

    it("blocks non-read tools in read-only sessions before checking scopes", async () => {
      const { executor, tools } = setup();
      const readOnly = { userId: "u-x", scopes: [], sessionMode: "read_only" as const };
      expect(await executor.execute({ callId: "c1", tool: "send_email", args: { to: "a@company.com" } }, readOnly)).toEqual({ status: "denied", reason: "read_only_session" });
      expect(await executor.execute({ callId: "c2", tool: "search_docs", args: { q: "x" } }, { ...readOnly, scopes: ["docs:read"] })).toMatchObject({ status: "executed" });
      expect(tools.send_email).not.toHaveBeenCalled();
    });

    it("lists missing scopes sorted", async () => {
      const { executor } = setup();
      expect(await executor.execute(del(), { userId: "u-bob", scopes: ["docs:read"] })).toEqual({ status: "denied", reason: "missing_scope", detail: "customers:delete,customers:write" });
    });

    it("applies argument guards after scope checks", async () => {
      const { executor, tools } = setup();
      expect(await executor.execute({ callId: "c1", tool: "send_email", args: { to: "attacker@evil.example" } }, ann)).toEqual({
        status: "denied",
        reason: "guard_rejected",
        detail: "external recipients are not allowed",
      });
      expect(await executor.execute({ callId: "c2", tool: "send_email", args: { to: "attacker@evil.example" } }, { userId: "u-x", scopes: [] })).toMatchObject({ reason: "missing_scope" });
      expect(await executor.execute({ callId: "c3", tool: "send_email", args: { to: "team@company.com" } }, ann)).toEqual({ status: "executed", result: { sent: "team@company.com" } });
      expect(tools.send_email).toHaveBeenCalledTimes(1);
    });

    it("reports tool failures without throwing", async () => {
      const { executor } = setup();
      expect(await executor.execute({ callId: "c1", tool: "export_data", args: {} }, ann)).toEqual({ status: "failed", error: "export service unavailable" });
    });
  });

  describe("Approvals", () => {
    it("requires approval for destructive tools and executes once approved", async () => {
      const { executor, tools, now } = setup();
      const pending = await executor.execute(del(), ann);
      expect(pending).toEqual({ status: "pending_approval", approvalId: "a-1", expiresAt: now() + 900_000 });
      expect(tools.delete_customer).not.toHaveBeenCalled();

      const record = executor.decide("a-1", { ...lead, approve: true });
      expect(record).toMatchObject({ id: "a-1", tool: "delete_customer", requesterId: "u-ann", status: "approved", approverId: "u-lead", createdAt: now(), expiresAt: now() + 900_000 });
      expect(record.argsHash).toMatch(/^[0-9a-f]{64}$/);

      expect(await executor.execute(del({ callId: "c2", approvalId: "a-1" }), ann)).toEqual({ status: "executed", result: { deleted: "cus_9" } });
      expect(tools.delete_customer).toHaveBeenCalledTimes(1);
    });

    it("hashes arguments as JSON with recursively sorted keys", async () => {
      const { executor } = setup();
      await executor.execute({ callId: "c1", tool: "delete_customer", args: { id: "cus_9", meta: { b: 2, a: [1, { y: 1, x: 2 }] } } }, ann);
      const record = executor.decide("a-1", { ...lead, approve: true });
      const canonical = JSON.stringify({ id: "cus_9", meta: { a: [1, { x: 2, y: 1 }], b: 2 } });
      expect(record.argsHash).toBe(createHash("sha256").update(canonical).digest("hex"));
      const reordered = await executor.execute({ callId: "c2", tool: "delete_customer", args: { meta: { a: [1, { x: 2, y: 1 }], b: 2 }, id: "cus_9" }, approvalId: "a-1" }, ann);
      expect(reordered.status).toBe("executed");
    });

    it("requires approval when requiresApproval is true for non-destructive tools", async () => {
      const { executor, tools } = setup({ policies: [{ tool: "send_email", risk: "write", requiredScopes: [], requiresApproval: true }] });
      expect((await executor.execute({ callId: "c1", tool: "send_email", args: { to: "x@company.com" } }, ann)).status).toBe("pending_approval");
      expect(tools.send_email).not.toHaveBeenCalled();
    });

    it("allows a single use only, even concurrently", async () => {
      const { executor, tools } = setup();
      await executor.execute(del(), ann);
      executor.decide("a-1", { ...lead, approve: true });
      const results = await Promise.all([1, 2, 3].map((n) => executor.execute(del({ callId: `c${n}`, approvalId: "a-1" }), ann)));
      expect(results.filter((r) => r.status === "executed")).toHaveLength(1);
      expect(results.filter((r) => r.status === "denied")).toEqual([
        { status: "denied", reason: "approval_invalid", detail: "already_used" },
        { status: "denied", reason: "approval_invalid", detail: "already_used" },
      ]);
      expect(tools.delete_customer).toHaveBeenCalledTimes(1);
    });

    it.each<[string, (ctx: ReturnType<typeof setup>) => Promise<unknown>, string]>([
      ["an unknown approval id", (c) => c.executor.execute(del({ approvalId: "nope" }), ann), "not_found"],
      ["a pending approval", async (c) => { await c.executor.execute(del(), ann); return c.executor.execute(del({ approvalId: "a-1" }), ann); }, "not_approved"],
      ["a rejected approval", async (c) => { await c.executor.execute(del(), ann); c.executor.decide("a-1", { ...lead, approve: false }); return c.executor.execute(del({ approvalId: "a-1" }), ann); }, "not_approved"],
      ["different arguments", async (c) => { await c.executor.execute(del(), ann); c.executor.decide("a-1", { ...lead, approve: true }); return c.executor.execute({ ...del({ approvalId: "a-1" }), args: { id: "cus_ALL", reason: "GDPR request" } }, ann); }, "args_mismatch"],
      ["another requester", async (c) => { await c.executor.execute(del(), ann); c.executor.decide("a-1", { ...lead, approve: true }); return c.executor.execute(del({ approvalId: "a-1" }), { ...ann, userId: "u-mallory" }); }, "requester_mismatch"],
      ["an expired approval", async (c) => { await c.executor.execute(del(), ann); c.executor.decide("a-1", { ...lead, approve: true }); c.advance(900_000); return c.executor.execute(del({ approvalId: "a-1" }), ann); }, "expired"],
    ])("denies execution with %s", async (_label, act, detail) => {
      const ctx = setup();
      expect(await act(ctx)).toEqual({ status: "denied", reason: "approval_invalid", detail });
      expect(ctx.tools.delete_customer).not.toHaveBeenCalled();
    });

    it("rejects an approval used for another tool", async () => {
      const { executor, tools } = setup({
        policies: [
          { tool: "delete_customer", risk: "destructive", requiredScopes: [] },
          { tool: "send_email", risk: "write", requiredScopes: [], requiresApproval: true },
        ],
      });
      await executor.execute({ callId: "c1", tool: "send_email", args: { id: "cus_9", reason: "GDPR request" } }, ann);
      executor.decide("a-1", { ...lead, approve: true });
      expect(await executor.execute(del({ approvalId: "a-1" }), ann)).toEqual({ status: "denied", reason: "approval_invalid", detail: "tool_mismatch" });
      expect(tools.delete_customer).not.toHaveBeenCalled();
    });

    it("uses a custom approval TTL", async () => {
      const { executor, now } = setup({ ttl: 60_000 });
      expect(await executor.execute(del(), ann)).toMatchObject({ expiresAt: now() + 60_000 });
    });
  });

  describe("decide", () => {
    it.each<[string, (ctx: ReturnType<typeof setup>) => void, string]>([
      ["an unknown approval", (c) => c.executor.decide("nope", { ...lead, approve: true }), "not_found"],
      ["a decided approval", (c) => { c.executor.decide("a-1", { ...lead, approve: true }); c.executor.decide("a-1", { ...lead, approve: false }); }, "not_pending"],
      ["an expired approval", (c) => { c.advance(900_000); c.executor.decide("a-1", { ...lead, approve: true }); }, "expired"],
      ["self-approval", (c) => c.executor.decide("a-1", { approverId: "u-ann", approverScopes: ["approvals:grant"], approve: true }), "self_approval"],
      ["an approver without the grant scope", (c) => c.executor.decide("a-1", { approverId: "u-peer", approverScopes: ["docs:read"], approve: true }), "not_authorized"],
    ])("throws ApprovalError for %s", async (_label, act, code) => {
      const ctx = setup();
      await ctx.executor.execute(del(), ann);
      expect(expectThrows(() => act(ctx), ApprovalError).code).toBe(code);
    });

    it("cannot decide an approval that was already used", async () => {
      const { executor } = setup();
      await executor.execute(del(), ann);
      executor.decide("a-1", { ...lead, approve: true });
      await executor.execute(del({ approvalId: "a-1" }), ann);
      expect(expectThrows(() => executor.decide("a-1", { ...lead, approve: true }), ApprovalError).code).toBe("not_pending");
    });
  });

  describe("Audit", () => {
    it("records one entry per decision without argument values", async () => {
      const { executor, now } = setup();
      await executor.execute({ callId: "c0", tool: "search_docs", args: { q: "salary of ceo" } }, ann);
      await executor.execute({ callId: "c1", tool: "unknown", args: {} }, ann);
      await executor.execute(del(), ann);
      executor.decide("a-1", { ...lead, approve: true });
      await executor.execute(del({ callId: "c2", approvalId: "a-1" }), ann);
      await executor.execute({ callId: "c3", tool: "export_data", args: {} }, ann);

      const audit = executor.getAudit();
      expect(audit.map((e) => [e.userId, e.tool, e.callId, e.decision, e.reason])).toEqual([
        ["u-ann", "search_docs", "c0", "executed", undefined],
        ["u-ann", "unknown", "c1", "denied", "no_policy"],
        ["u-ann", "delete_customer", "c1", "pending_approval", undefined],
        ["u-lead", "delete_customer", "a-1", "approved", undefined],
        ["u-ann", "delete_customer", "c2", "executed", undefined],
        ["u-ann", "export_data", "c3", "failed", undefined],
      ]);
      expect(audit.every((e) => e.at === now())).toBe(true);
      const serialized = JSON.stringify(audit);
      expect(serialized).not.toContain("salary of ceo");
      expect(serialized).not.toContain("cus_9");
      expect(serialized).not.toContain("GDPR");
    });

    it("returns a copy of the audit log", async () => {
      const { executor } = setup();
      await executor.execute({ callId: "c0", tool: "search_docs", args: { q: "x" } }, ann);
      executor.getAudit().pop();
      expect(executor.getAudit()).toHaveLength(1);
    });
  });
});
