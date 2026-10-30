import { MemorySaver } from "@langchain/langgraph";
import { describe, expect, it, vi } from "vitest";
import {
  buildRefundWorkflow,
  NoPendingApprovalError,
  resumeRefund,
  startRefund,
  ThreadInUseError,
  type ApprovalDecision,
  type RefundDeps,
} from "../../src/langchain/task4/task4";
import { ValidationError } from "../../src/shared/errors";
import { expectRejects } from "../support/expect-rejects";

function setup(assessment: { eligible: boolean; amount: number } = { eligible: true, amount: 120 }, autoApproveLimit = 50) {
  let n = 0;
  const deps = {
    assess: vi.fn(async (_i: { orderId: string; reason: string }) => assessment),
    payments: { refund: vi.fn(async (_o: string, _a: number, _k: string) => ({ refundId: `r-${++n}` })) },
  } satisfies RefundDeps;
  const checkpointer = new MemorySaver();
  const workflow = buildRefundWorkflow(deps, { checkpointer, autoApproveLimit });
  return { deps, workflow, checkpointer };
}

const input = { orderId: "o-9", reason: "Damaged" };
const request = { type: "refund_approval", orderId: "o-9", amount: 120, reason: "Damaged" };

describe("LC-004", () => {
  describe("Automatic paths", () => {
    it("ends ineligible requests without payment", async () => {
      const { deps, workflow } = setup({ eligible: false, amount: 0 });
      expect(await startRefund(workflow, "t-1", input)).toEqual({ status: "not_eligible", audit: ["assessed", "not_eligible"] });
      expect(deps.assess).toHaveBeenCalledWith(input);
      expect(deps.payments.refund).not.toHaveBeenCalled();
    });

    it("pays small refunds automatically with an idempotency key", async () => {
      const { deps, workflow } = setup({ eligible: true, amount: 50 });
      expect(await startRefund(workflow, "t-1", input)).toEqual({
        status: "refunded",
        refundId: "r-1",
        amount: 50,
        audit: ["assessed", "auto_approved", "refunded:r-1"],
      });
      expect(deps.payments.refund).toHaveBeenCalledTimes(1);
      expect(deps.payments.refund).toHaveBeenCalledWith("o-9", 50, "refund:t-1:o-9");
    });
  });

  describe("Approval", () => {
    it("pauses large refunds and returns the approval request", async () => {
      const { deps, workflow } = setup();
      expect(await startRefund(workflow, "t-1", input)).toEqual({ status: "awaiting_approval", request, audit: ["assessed", "approval_requested"] });
      expect(deps.payments.refund).not.toHaveBeenCalled();
    });

    it("pays the assessed amount after approval", async () => {
      const { deps, workflow } = setup();
      await startRefund(workflow, "t-1", input);
      expect(await resumeRefund(workflow, "t-1", { decision: "approve", reviewer: "alice" })).toEqual({
        status: "refunded",
        refundId: "r-1",
        amount: 120,
        audit: ["assessed", "approval_requested", "approved:alice", "refunded:r-1"],
      });
      expect(deps.assess).toHaveBeenCalledTimes(1);
      expect(deps.payments.refund).toHaveBeenCalledTimes(1);
      expect(deps.payments.refund).toHaveBeenCalledWith("o-9", 120, "refund:t-1:o-9");
    });

    it("ends without payment when rejected", async () => {
      const { deps, workflow } = setup();
      await startRefund(workflow, "t-1", input);
      expect(await resumeRefund(workflow, "t-1", { decision: "reject", reviewer: "bob", note: "Item was used" })).toEqual({
        status: "rejected",
        reviewer: "bob",
        note: "Item was used",
        audit: ["assessed", "approval_requested", "rejected:bob"],
      });
      expect(deps.payments.refund).not.toHaveBeenCalled();

      const other = setup();
      await startRefund(other.workflow, "t-2", input);
      expect(await resumeRefund(other.workflow, "t-2", { decision: "reject", reviewer: "bob" })).toMatchObject({ note: null });
    });

    it("pays an edited amount within the assessed amount", async () => {
      const { deps, workflow } = setup();
      await startRefund(workflow, "t-1", input);
      expect(await resumeRefund(workflow, "t-1", { decision: "edit", reviewer: "carol", amount: 120 })).toMatchObject({ status: "refunded", amount: 120 });
      expect(deps.payments.refund).toHaveBeenCalledWith("o-9", 120, "refund:t-1:o-9");
    });

    it("asks again after an invalid edit and only pays once", async () => {
      const { deps, workflow } = setup();
      await startRefund(workflow, "t-1", input);
      const again = await resumeRefund(workflow, "t-1", { decision: "edit", reviewer: "carol", amount: 500 });
      expect(again).toEqual({
        status: "awaiting_approval",
        request: { ...request, message: "Edited amount must be greater than 0 and at most 120." },
        audit: ["assessed", "approval_requested", "invalid_edit:carol", "approval_requested"],
      });
      expect(await resumeRefund(workflow, "t-1", { decision: "edit", reviewer: "carol", amount: 0 })).toMatchObject({ status: "awaiting_approval" });

      const done = await resumeRefund(workflow, "t-1", { decision: "edit", reviewer: "carol", amount: 80 });
      expect(done).toEqual({
        status: "refunded",
        refundId: "r-1",
        amount: 80,
        audit: ["assessed", "approval_requested", "invalid_edit:carol", "approval_requested", "invalid_edit:carol", "approval_requested", "edited:carol:80", "refunded:r-1"],
      });
      expect(deps.assess).toHaveBeenCalledTimes(1);
      expect(deps.payments.refund).toHaveBeenCalledTimes(1);
      expect(deps.payments.refund).toHaveBeenCalledWith("o-9", 80, "refund:t-1:o-9");
    });

    it("resumes on a new workflow instance that shares the checkpointer", async () => {
      const { deps, workflow, checkpointer } = setup();
      await startRefund(workflow, "t-1", input);
      const restarted = buildRefundWorkflow(deps, { checkpointer, autoApproveLimit: 50 });
      expect(await resumeRefund(restarted, "t-1", { decision: "approve", reviewer: "alice" })).toMatchObject({ status: "refunded", amount: 120 });
      expect(deps.assess).toHaveBeenCalledTimes(1);
    });

    it("keeps threads independent", async () => {
      const { deps, workflow } = setup();
      await startRefund(workflow, "t-1", input);
      await startRefund(workflow, "t-2", { orderId: "o-10", reason: "Late" });
      await resumeRefund(workflow, "t-2", { decision: "approve", reviewer: "alice" });
      expect(deps.payments.refund).toHaveBeenCalledWith("o-10", 120, "refund:t-2:o-10");
      expect(await resumeRefund(workflow, "t-1", { decision: "reject", reviewer: "bob" })).toMatchObject({ status: "rejected" });
      expect(deps.payments.refund).toHaveBeenCalledTimes(1);
    });
  });

  describe("Errors", () => {
    it("throws NoPendingApprovalError for unknown, finished and auto-approved threads", async () => {
      const { workflow } = setup();
      await expectRejects(resumeRefund(workflow, "missing", { decision: "approve", reviewer: "alice" }), NoPendingApprovalError);

      await startRefund(workflow, "t-1", input);
      await resumeRefund(workflow, "t-1", { decision: "approve", reviewer: "alice" });
      const error = await expectRejects(resumeRefund(workflow, "t-1", { decision: "approve", reviewer: "dave" }), NoPendingApprovalError);
      expect(error.threadId).toBe("t-1");

      const auto = setup({ eligible: true, amount: 10 });
      await startRefund(auto.workflow, "t-3", input);
      await expectRejects(resumeRefund(auto.workflow, "t-3", { decision: "approve", reviewer: "alice" }), NoPendingApprovalError);
      expect(auto.deps.payments.refund).toHaveBeenCalledTimes(1);
    });

    it.each<[string, unknown]>([
      ["an empty reviewer", { decision: "approve", reviewer: "" }],
      ["an unknown decision", { decision: "maybe", reviewer: "alice" }],
      ["an edit without amount", { decision: "edit", reviewer: "alice" }],
    ])("rejects %s without resuming", async (_label, decision) => {
      const { deps, workflow } = setup();
      await startRefund(workflow, "t-1", input);
      await expectRejects(resumeRefund(workflow, "t-1", decision as ApprovalDecision), ValidationError);
      expect(deps.payments.refund).not.toHaveBeenCalled();
      expect(await resumeRefund(workflow, "t-1", { decision: "approve", reviewer: "alice" })).toMatchObject({ status: "refunded" });
    });

    it("refuses to start a thread twice", async () => {
      const { deps, workflow } = setup();
      await startRefund(workflow, "t-1", input);
      await expectRejects(startRefund(workflow, "t-1", input), ThreadInUseError);
      expect(deps.assess).toHaveBeenCalledTimes(1);
    });
  });
});
