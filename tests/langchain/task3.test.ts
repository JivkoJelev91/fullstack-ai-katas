import { MemorySaver } from "@langchain/langgraph";
import { describe, expect, it, vi } from "vitest";
import { buildTicketWorkflow, type TicketDeps } from "../../src/langchain/task3/task3";

type Review = { approved: boolean; feedback: string };

function makeDeps(opts: { category?: string; confidence?: number; reviews?: Array<Review | Error> } = {}) {
  const reviews = opts.reviews ?? [{ approved: true, feedback: "" }];
  let draftNo = 0;
  let reviewNo = 0;
  const deps = {
    classify: vi.fn(async (_t: string) => ({ category: opts.category ?? "billing", confidence: opts.confidence ?? 0.92 })),
    draft: vi.fn(async (_i: { ticket: string; category: string; feedback: string[] }) => `draft ${++draftNo}`),
    review: vi.fn(async (_d: string) => {
      const r = reviews[Math.min(reviewNo++, reviews.length - 1)]!;
      if (r instanceof Error) throw r;
      return r;
    }),
  } satisfies TicketDeps;
  return deps;
}

const config = (id: string) => ({ configurable: { thread_id: id } });

describe("LC-003", () => {
  it("drafts, reviews and approves a ticket", async () => {
    const deps = makeDeps();
    const workflow = buildTicketWorkflow(deps, { checkpointer: new MemorySaver() });
    const final = await workflow.invoke({ ticket: "My invoice is wrong" }, config("t1"));
    expect(final).toMatchObject({
      ticket: "My invoice is wrong",
      category: "billing",
      confidence: 0.92,
      drafts: ["draft 1"],
      feedback: [],
      revisions: 0,
      status: "approved",
      finalReply: "draft 1",
      escalationReason: null,
    });
    expect(deps.classify).toHaveBeenCalledWith("My invoice is wrong");
    expect(deps.draft).toHaveBeenCalledWith({ ticket: "My invoice is wrong", category: "billing", feedback: [] });
    expect(deps.review).toHaveBeenCalledWith("draft 1");
  });

  it("revises with accumulated feedback until approved", async () => {
    const deps = makeDeps({
      reviews: [
        { approved: false, feedback: "mention the refund timeline" },
        { approved: true, feedback: "" },
      ],
    });
    const workflow = buildTicketWorkflow(deps, { checkpointer: new MemorySaver() });
    const final = await workflow.invoke({ ticket: "Refund?" }, config("t1"));
    expect(final).toMatchObject({
      drafts: ["draft 1", "draft 2"],
      feedback: ["mention the refund timeline"],
      revisions: 1,
      status: "approved",
      finalReply: "draft 2",
    });
    expect(deps.draft.mock.calls[1]![0].feedback).toEqual(["mention the refund timeline"]);
    expect(deps.review.mock.calls.map(([d]) => d)).toEqual(["draft 1", "draft 2"]);
  });

  it("escalates after maxRevisions rejected reviews", async () => {
    const deps = makeDeps({ reviews: [{ approved: false, feedback: "too vague" }, { approved: false, feedback: "still vague" }, { approved: false, feedback: "no" }] });
    const workflow = buildTicketWorkflow(deps, { checkpointer: new MemorySaver(), maxRevisions: 2 });
    const final = await workflow.invoke({ ticket: "Help" }, config("t1"));
    expect(final).toMatchObject({
      drafts: ["draft 1", "draft 2"],
      feedback: ["too vague", "still vague"],
      revisions: 2,
      status: "escalated",
      finalReply: null,
      escalationReason: "max_revisions",
    });
    expect(deps.review).toHaveBeenCalledTimes(2);
  });

  it("uses a default of two revisions", async () => {
    const deps = makeDeps({ reviews: [{ approved: false, feedback: "x" }] });
    const final = await buildTicketWorkflow(deps, { checkpointer: new MemorySaver() }).invoke({ ticket: "Help" }, config("t1"));
    expect(final.drafts).toHaveLength(2);
    expect(final.escalationReason).toBe("max_revisions");
  });

  it("escalates low-confidence classifications without drafting", async () => {
    const deps = makeDeps({ confidence: 0.4 });
    const final = await buildTicketWorkflow(deps, { checkpointer: new MemorySaver() }).invoke({ ticket: "???" }, config("t1"));
    expect(final).toMatchObject({ status: "escalated", escalationReason: "low_confidence", drafts: [], finalReply: null });
    expect(deps.draft).not.toHaveBeenCalled();
  });

  it("treats confidence equal to minConfidence as sufficient", async () => {
    const deps = makeDeps({ confidence: 0.75 });
    const final = await buildTicketWorkflow(deps, { checkpointer: new MemorySaver(), minConfidence: 0.75 }).invoke({ ticket: "x" }, config("t1"));
    expect(final.status).toBe("approved");
  });

  it("escalates sensitive categories even with high confidence", async () => {
    const legal = makeDeps({ category: "legal", confidence: 0.99 });
    expect(await buildTicketWorkflow(legal, { checkpointer: new MemorySaver() }).invoke({ ticket: "lawsuit" }, config("t1"))).toMatchObject({
      status: "escalated",
      escalationReason: "sensitive_category",
    });
    const custom = makeDeps({ category: "billing", confidence: 0.2 });
    const final = await buildTicketWorkflow(custom, { checkpointer: new MemorySaver(), escalationCategories: ["billing"] }).invoke({ ticket: "x" }, config("t1"));
    expect(final.escalationReason).toBe("sensitive_category");
    expect(legal.draft).not.toHaveBeenCalled();
  });

  it("persists state per thread in the checkpointer", async () => {
    const checkpointer = new MemorySaver();
    const workflow = buildTicketWorkflow(makeDeps(), { checkpointer });
    await workflow.invoke({ ticket: "First" }, config("a"));
    await workflow.invoke({ ticket: "Second" }, config("b"));
    const a = await workflow.getState(config("a"));
    expect(a.values).toMatchObject({ ticket: "First", status: "approved" });
    expect(a.next).toEqual([]);
    expect((await workflow.getState(config("b"))).values.ticket).toBe("Second");

    const reloaded = buildTicketWorkflow(makeDeps(), { checkpointer });
    expect((await reloaded.getState(config("a"))).values.finalReply).toBe("draft 1");

    let checkpoints = 0;
    for await (const _ of workflow.getStateHistory(config("a"))) checkpoints++;
    expect(checkpoints).toBeGreaterThanOrEqual(5);
  });

  it("resumes from the failed node without re-running completed nodes", async () => {
    const deps = makeDeps({ reviews: [new Error("provider down"), { approved: true, feedback: "" }] });
    const workflow = buildTicketWorkflow(deps, { checkpointer: new MemorySaver() });
    await expect(workflow.invoke({ ticket: "Crashy" }, config("t1"))).rejects.toThrow("provider down");

    const stuck = await workflow.getState(config("t1"));
    expect(stuck.next).toEqual(["review"]);
    expect(stuck.values).toMatchObject({ category: "billing", drafts: ["draft 1"] });

    const final = await workflow.invoke(null, config("t1"));
    expect(final).toMatchObject({ status: "approved", finalReply: "draft 1", drafts: ["draft 1"] });
    expect(deps.classify).toHaveBeenCalledTimes(1);
    expect(deps.draft).toHaveBeenCalledTimes(1);
    expect(deps.review).toHaveBeenCalledTimes(2);
  });
});
