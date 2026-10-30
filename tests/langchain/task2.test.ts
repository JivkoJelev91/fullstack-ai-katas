import { Document } from "@langchain/core/documents";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { BaseRetriever } from "@langchain/core/retrievers";
import { Runnable } from "@langchain/core/runnables";
import { describe, expect, it, vi } from "vitest";
import { createConversationalRagChain, NO_ANSWER, TenantRetriever, type SearchHit } from "../../src/langchain/task2/task2";
import { ValidationError } from "../../src/shared/errors";
import { expectRejects } from "../support/expect-rejects";
import { RecordingChatModel } from "../support/fake-chat-model";

const HITS: SearchHit[] = [
  { id: "c2", text: "Refunds are processed within 5 business days.", score: 0.7, source: "refund-policy.md" },
  { id: "c1", text: "You can request a refund within 30 days.", score: 0.9, source: "refund-policy.md" },
  { id: "c9", text: "Lunch menu changes weekly.", score: 0.2, source: "cafeteria.md" },
  { id: "c1", text: "duplicate of c1", score: 0.85, source: "refund-policy.md" },
  { id: "c4", text: "Express shipping refunds take 10 days.", score: 0.6, source: "shipping.md" },
];

const searchFn = (hits: SearchHit[] = HITS) => vi.fn(async (_q: string, _o: { tenantId: string; k: number }) => hits);

class FixedRetriever extends BaseRetriever {
  override lc_namespace = ["tests", "fixed"];
  readonly queries: string[] = [];
  constructor(private readonly docs: Document[]) {
    super();
  }
  override async _getRelevantDocuments(query: string) {
    this.queries.push(query);
    return this.docs;
  }
}

const docs = [
  new Document({ pageContent: "Refunds are processed within 5 business days.", metadata: { id: "c2", source: "refund-policy.md", score: 0.7 } }),
  new Document({ pageContent: "Express shipping refunds take 10 days.", metadata: { id: "c4", source: "shipping.md", score: 0.6 } }),
  new Document({ pageContent: "You can request a refund within 30 days.", metadata: { id: "c1", source: "refund-policy.md", score: 0.9 } }),
];

describe("LC-002", () => {
  describe("TenantRetriever", () => {
    it("is a LangChain retriever with a namespace", () => {
      const retriever = new TenantRetriever({ search: searchFn(), tenantId: "acme" });
      expect(retriever).toBeInstanceOf(BaseRetriever);
      expect(retriever.lc_namespace.length).toBeGreaterThan(0);
    });

    it("returns filtered, sorted, de-duplicated documents", async () => {
      const search = searchFn();
      const retriever = new TenantRetriever({ search, tenantId: "acme", k: 3, minScore: 0.5 });
      const result = await retriever.invoke("  refund time  ");
      expect(search).toHaveBeenCalledTimes(1);
      expect(search).toHaveBeenCalledWith("refund time", { tenantId: "acme", k: 3 });
      expect(result.every((d) => d instanceof Document)).toBe(true);
      expect(result.map((d) => [d.pageContent, d.metadata])).toEqual([
        ["You can request a refund within 30 days.", { id: "c1", source: "refund-policy.md", score: 0.9 }],
        ["Refunds are processed within 5 business days.", { id: "c2", source: "refund-policy.md", score: 0.7 }],
        ["Express shipping refunds take 10 days.", { id: "c4", source: "shipping.md", score: 0.6 }],
      ]);
    });

    it("uses defaults of k = 4 and minScore = 0", async () => {
      const search = searchFn();
      const result = await new TenantRetriever({ search, tenantId: "acme" }).invoke("refund");
      expect(search).toHaveBeenCalledWith("refund", { tenantId: "acme", k: 4 });
      expect(result.map((d) => d.metadata.id)).toEqual(["c1", "c2", "c4", "c9"]);
    });

    it("keeps the first of equal scores in search order", async () => {
      const search = searchFn([
        { id: "b", text: "B", score: 0.5, source: "s" },
        { id: "a", text: "A", score: 0.5, source: "s" },
      ]);
      const result = await new TenantRetriever({ search, tenantId: "acme" }).invoke("x");
      expect(result.map((d) => d.metadata.id)).toEqual(["b", "a"]);
    });

    it("does not call search for a blank query", async () => {
      const search = searchFn();
      expect(await new TenantRetriever({ search, tenantId: "acme" }).invoke("   ")).toEqual([]);
      expect(search).not.toHaveBeenCalled();
    });
  });

  describe("createConversationalRagChain", () => {
    it("returns a Runnable", () => {
      expect(createConversationalRagChain({ model: new RecordingChatModel(["x"]), retriever: new FixedRetriever(docs) })).toBeInstanceOf(Runnable);
    });

    it("answers a first question without a rewrite call", async () => {
      const model = new RecordingChatModel(["  Refunds take 5 business days.  "]);
      const retriever = new FixedRetriever(docs);
      const result = await createConversationalRagChain({ model, retriever }).invoke({ question: "  How long do refunds take? ", history: [] });
      expect(result).toEqual({
        answer: "Refunds take 5 business days.",
        standaloneQuestion: "How long do refunds take?",
        sources: ["refund-policy.md", "shipping.md"],
      });
      expect(model.calls).toHaveLength(1);
      expect(retriever.queries).toEqual(["How long do refunds take?"]);
    });

    it("formats the context in the human message and keeps it out of the system message", async () => {
      const model = new RecordingChatModel(["ok"]);
      await createConversationalRagChain({ model, retriever: new FixedRetriever(docs) }).invoke({ question: "How long?", history: [] });
      const [system, human, ...rest] = model.transcript(0);
      expect(rest).toEqual([]);
      expect(system!.type).toBe("system");
      expect(system!.content).not.toContain("business days");
      expect(human!.type).toBe("human");
      expect(human!.content).toContain("How long?");
      for (const d of docs) expect(human!.content).toContain(`[${d.metadata.source}] ${d.pageContent}`);
    });

    it("rewrites a follow-up question using the full history before retrieval", async () => {
      const model = new RecordingChatModel(["  How long does a refund take?  ", "Refunds are processed within 5 business days."]);
      const retriever = new FixedRetriever(docs);
      const history = [new HumanMessage("Can I get a refund?"), new AIMessage("Yes, within 30 days of purchase.")];
      const result = await createConversationalRagChain({ model, retriever }).invoke({ question: "and how long does it take?", history });

      expect(model.calls).toHaveLength(2);
      const rewrite = model.transcript(0);
      expect(rewrite.map((m) => m.type)).toEqual(["system", "human", "ai", "human"]);
      expect(rewrite[1]!.content).toBe("Can I get a refund?");
      expect(rewrite[2]!.content).toBe("Yes, within 30 days of purchase.");
      expect(rewrite[3]!.content).toContain("and how long does it take?");
      expect(retriever.queries).toEqual(["How long does a refund take?"]);
      expect(result.standaloneQuestion).toBe("How long does a refund take?");

      const answer = model.transcript(1);
      expect(answer.map((m) => m.type)).toEqual(["system", "human"]);
      expect(answer[1]!.content).toContain("How long does a refund take?");
      expect(answer[1]!.content).not.toContain("Can I get a refund?");
    });

    it("falls back to the original question when the rewrite is empty", async () => {
      const model = new RecordingChatModel(["   ", "answer"]);
      const retriever = new FixedRetriever(docs);
      const result = await createConversationalRagChain({ model, retriever }).invoke({ question: "and then?", history: [new HumanMessage("hi")] });
      expect(retriever.queries).toEqual(["and then?"]);
      expect(result.standaloneQuestion).toBe("and then?");
    });

    it("returns NO_ANSWER without an answer call when nothing is retrieved", async () => {
      const model = new RecordingChatModel(["rewritten question"]);
      const result = await createConversationalRagChain({ model, retriever: new FixedRetriever([]) }).invoke({
        question: "parking?",
        history: [new HumanMessage("hello"), new AIMessage("hi")],
      });
      expect(result).toEqual({ answer: NO_ANSWER, standaloneQuestion: "rewritten question", sources: [] });
      expect(model.calls).toHaveLength(1);
    });

    it("works end-to-end with TenantRetriever", async () => {
      const search = searchFn();
      const model = new RecordingChatModel(["Within 30 days."]);
      const retriever = new TenantRetriever({ search, tenantId: "acme", k: 2, minScore: 0.5 });
      const result = await createConversationalRagChain({ model, retriever }).invoke({ question: "When can I ask for a refund?", history: [] });
      expect(result.sources).toEqual(["refund-policy.md"]);
      expect(search).toHaveBeenCalledWith("When can I ask for a refund?", { tenantId: "acme", k: 2 });
    });

    it.each(["", "   "])("rejects the blank question %j", async (question) => {
      const model = new RecordingChatModel(["x"]);
      const retriever = new FixedRetriever(docs);
      await expectRejects(createConversationalRagChain({ model, retriever }).invoke({ question, history: [] }), ValidationError);
      expect(model.calls).toHaveLength(0);
      expect(retriever.queries).toHaveLength(0);
    });
  });
});
