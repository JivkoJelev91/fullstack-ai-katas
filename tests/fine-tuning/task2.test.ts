import { describe, expect, it } from "vitest";
import { prepareDataset, toJsonl, type ChatRecord } from "../../src/fine-tuning/task2/task2";

// One token per whitespace-separated word.
const tokenizer = { countTokens: (t: string) => t.split(/\s+/).filter(Boolean).length };
const opts = { tokenizer, maxTokens: 100, validationFraction: 0 };

const rec = (...pairs: Array<[string, string]>) => JSON.stringify({ messages: pairs.map(([role, content]) => ({ role, content })) });

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const conv = (r: ChatRecord) => r.messages.map((m) => `${m.role}:${norm(m.content)}`).join("\n");
function fnv1a32(text: string) {
  let h = 2166136261;
  for (const byte of new TextEncoder().encode(text)) h = Math.imul(h ^ byte, 16777619) >>> 0;
  return h >>> 0;
}

describe("FT-002", () => {
  it("validates, de-duplicates and scrubs the example from the specification", () => {
    const jsonl = [
      rec(["user", "Reset my password"], ["assistant", "Go to Settings."]),
      "{not json",
      rec(["assistant", "Hi"]),
      rec(["user", "reset   my PASSWORD"], ["assistant", "go to settings."]),
      rec(["user", "Email me at ann@example.com"], ["assistant", "Done."]),
    ].join("\n");
    const result = prepareDataset(jsonl, opts);
    expect(result.rejected).toEqual([
      { line: 2, reason: "invalid_json" },
      { line: 3, reason: "invalid_schema" },
      { line: 4, reason: "duplicate" },
    ]);
    expect(result.train).toEqual([
      { messages: [{ role: "user", content: "Reset my password" }, { role: "assistant", content: "Go to Settings." }] },
      { messages: [{ role: "user", content: "Email me at [EMAIL]" }, { role: "assistant", content: "Done." }] },
    ]);
    expect(result.validation).toEqual([]);
  });

  it.each([
    ["a JSON array", "[1,2]"],
    ["a JSON string", '"text"'],
    ["truncated JSON", '{"messages": ['],
  ])("rejects %s as invalid_json", (_label, line) => {
    expect(prepareDataset(line, opts).rejected).toEqual([{ line: 1, reason: "invalid_json" }]);
  });

  it.each([
    ["missing messages", JSON.stringify({ text: "hi" })],
    ["an unknown role", rec(["user", "q"], ["bot", "a"])],
    ["empty content", rec(["user", "  "], ["assistant", "a"])],
    ["non-string content", JSON.stringify({ messages: [{ role: "user", content: 1 }, { role: "assistant", content: "a" }] })],
    ["a late system message", rec(["user", "q"], ["system", "s"], ["assistant", "a"])],
    ["no user message", rec(["system", "s"], ["assistant", "a"])],
    ["ending with a user message", rec(["user", "q"], ["assistant", "a"], ["user", "q2"])],
  ])("rejects %s as invalid_schema", (_label, line) => {
    expect(prepareDataset(line, opts).rejected).toEqual([{ line: 1, reason: "invalid_schema" }]);
  });

  it("accepts a leading system message and multi-turn conversations", () => {
    const line = rec(["system", "Be brief."], ["user", "q1"], ["assistant", "a1"], ["user", "q2"], ["assistant", "a2"]);
    expect(prepareDataset(line, opts).train).toHaveLength(1);
  });

  it("ignores blank lines, strips CR and keeps original line numbers", () => {
    const jsonl = "\r\n" + rec(["user", "q"], ["assistant", "a"]) + "\r\n\n   \n{bad\r\n";
    const result = prepareDataset(jsonl, opts);
    expect(result.train).toHaveLength(1);
    expect(result.rejected).toEqual([{ line: 5, reason: "invalid_json" }]);
    expect(result.stats.totalLines).toBe(2);
  });

  it("drops extra properties from records and messages", () => {
    const line = JSON.stringify({ id: 7, messages: [{ role: "user", content: "q", name: "x" }, { role: "assistant", content: "a", weight: 0 }] });
    expect(prepareDataset(line, opts).train).toEqual([{ messages: [{ role: "user", content: "q" }, { role: "assistant", content: "a" }] }]);
  });

  it("scrubs emails and phone numbers in all messages, and can be disabled", () => {
    const line = rec(["user", "Call +359 88 123 4567 or mail a.b@corp.io"], ["assistant", "I will email support@acme.com and +4915112345678."]);
    expect(prepareDataset(line, opts).train[0]!.messages.map((m) => m.content)).toEqual(["Call [PHONE] or mail [EMAIL]", "I will email [EMAIL] and [PHONE]."]);
    expect(prepareDataset(line, { ...opts, scrubPII: false }).train[0]!.messages[0]!.content).toContain("+359 88 123 4567");
  });

  it("detects duplicates after scrubbing", () => {
    const jsonl = [rec(["user", "mail a@x.io"], ["assistant", "ok"]), rec(["user", "mail b@y.io"], ["assistant", "ok"])].join("\n");
    expect(prepareDataset(jsonl, opts).rejected).toEqual([{ line: 2, reason: "duplicate" }]);
    expect(prepareDataset(jsonl, { ...opts, scrubPII: false }).rejected).toEqual([]);
  });

  it("only treats records as duplicates of accepted records", () => {
    const long = rec(["user", "word ".repeat(200)], ["assistant", "a"]);
    expect(prepareDataset([long, long].join("\n"), opts).rejected).toEqual([
      { line: 1, reason: "too_long" },
      { line: 2, reason: "too_long" },
    ]);
  });

  it("rejects user messages that match evaluation prompts after normalization", () => {
    const jsonl = [
      rec(["user", "What is the  REFUND window?"], ["assistant", "30 days"]),
      rec(["system", "What is the refund window?"], ["user", "hello"], ["assistant", "hi"]),
      rec(["user", "What is the refund window for EU?"], ["assistant", "14 days"]),
    ].join("\n");
    const result = prepareDataset(jsonl, { ...opts, evalPrompts: ["what is the refund window?"] });
    expect(result.rejected).toEqual([{ line: 1, reason: "contaminated" }]);
    expect(result.train).toHaveLength(2);
  });

  it("checks contamination before duplicates and duplicates before length", () => {
    const a = rec(["user", "Eval question"], ["assistant", "x"]);
    const b = rec(["user", "q"], ["assistant", "a"]);
    const result = prepareDataset([a, b, b].join("\n"), { ...opts, maxTokens: 10, evalPrompts: ["eval question"] });
    expect(result.rejected).toEqual([
      { line: 1, reason: "contaminated" },
      { line: 3, reason: "duplicate" },
    ]);
  });

  it("rejects records over the token limit counting 4 tokens of overhead per message", () => {
    const exact = rec(["user", "one two three"], ["assistant", "four five"]); // (3 + 4) + (2 + 4) = 13
    expect(prepareDataset(exact, { ...opts, maxTokens: 13 }).train).toHaveLength(1);
    expect(prepareDataset(exact, { ...opts, maxTokens: 12 }).rejected).toEqual([{ line: 1, reason: "too_long" }]);
  });

  it("splits deterministically by FNV-1a hash of the normalized conversation", () => {
    const lines = Array.from({ length: 200 }, (_, i) => rec(["user", `Question number ${i} ✓`], ["assistant", `Answer ${i}`]));
    const result = prepareDataset(lines.join("\n"), { ...opts, validationFraction: 0.2 });
    const all = lines.map((l) => JSON.parse(l) as ChatRecord);
    const expectedValidation = all.filter((r) => fnv1a32(conv(r)) % 10000 < 2000);
    expect(result.validation).toEqual(expectedValidation);
    expect(result.train).toEqual(all.filter((r) => !expectedValidation.includes(r)));
    expect(result.validation.length).toBeGreaterThan(20);
    expect(result.validation.length).toBeLessThan(60);

    const grown = prepareDataset([...lines, rec(["user", "brand new"], ["assistant", "x"])].join("\n"), { ...opts, validationFraction: 0.2 });
    expect(grown.validation.slice(0, result.validation.length)).toEqual(result.validation);
  });

  it("reports statistics", () => {
    const jsonl = [rec(["user", "a b c"], ["assistant", "d"]), "oops", rec(["user", "e"], ["assistant", "f g h i j"])].join("\n");
    expect(prepareDataset(jsonl, opts).stats).toEqual({
      totalLines: 3,
      accepted: 2,
      rejectedByReason: { invalid_json: 1, invalid_schema: 0, contaminated: 0, duplicate: 0, too_long: 0 },
      totalTokens: 12 + 14,
      maxRecordTokens: 14,
    });
    expect(prepareDataset("", opts).stats).toEqual({
      totalLines: 0,
      accepted: 0,
      rejectedByReason: { invalid_json: 0, invalid_schema: 0, contaminated: 0, duplicate: 0, too_long: 0 },
      totalTokens: 0,
      maxRecordTokens: 0,
    });
  });

  it("serializes records as JSONL", () => {
    const records: ChatRecord[] = [{ messages: [{ role: "user", content: 'say "hi"\n' }, { role: "assistant", content: "hi" }] }];
    expect(toJsonl(records)).toBe(JSON.stringify(records[0]) + "\n");
    expect(toJsonl([])).toBe("");
    const roundTrip = prepareDataset(toJsonl(records), opts);
    expect(roundTrip.train).toEqual(records);
  });
});
