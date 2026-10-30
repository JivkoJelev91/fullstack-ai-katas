import { OutputParserException } from "@langchain/core/output_parsers";
import { Runnable } from "@langchain/core/runnables";
import { describe, expect, it } from "vitest";
import { createReleaseNotesChain, type ReleaseNotesInput } from "../../src/langchain/task1/task1";
import { ValidationError } from "../../src/shared/errors";
import { expectRejects } from "../support/expect-rejects";
import { RecordingChatModel } from "../support/fake-chat-model";

const good = { headline: "  Dark mode is here ", highlights: [" Dark mode", "iOS login fix "], breakingChanges: [], tone: "happy" };
const json = (v: unknown) => JSON.stringify(v);
const input: ReleaseNotesInput = { audience: "customers", commits: ["feat: dark mode", " fix: login crash on iOS "] };
const expected = { headline: "Dark mode is here", highlights: ["Dark mode", "iOS login fix"], breakingChanges: [] };

describe("LC-001", () => {
  it("returns a LangChain Runnable", () => {
    expect(createReleaseNotesChain({ model: new RecordingChatModel([json(good)]) })).toBeInstanceOf(Runnable);
  });

  it("produces validated, trimmed release notes without extra fields", async () => {
    const model = new RecordingChatModel([json(good)]);
    expect(await createReleaseNotesChain({ model }).invoke(input)).toEqual(expected);
    expect(model.calls).toHaveLength(1);
  });

  it("sends a system message with the audience and a human message with the commits", async () => {
    const model = new RecordingChatModel([json(good)]);
    await createReleaseNotesChain({ model }).invoke(input);
    const [system, human, ...rest] = model.transcript(0);
    expect(rest).toEqual([]);
    expect(system!.type).toBe("system");
    expect(system!.content).toContain("customers");
    expect(system!.content).not.toContain("dark mode");
    expect(human!.type).toBe("human");
    expect(human!.content).toContain("- feat: dark mode\n- fix: login crash on iOS");
  });

  it("mentions the developer audience when requested", async () => {
    const model = new RecordingChatModel([json(good)]);
    await createReleaseNotesChain({ model }).invoke({ ...input, audience: "developers" });
    expect(model.transcript(0)[0]!.content).toContain("developers");
  });

  it("accepts fenced JSON and non-empty breaking changes", async () => {
    const model = new RecordingChatModel(["```json\n" + json({ ...good, breakingChanges: [" Removed v1 API "] }) + "\n```"]);
    expect((await createReleaseNotesChain({ model }).invoke(input)).breakingChanges).toEqual(["Removed v1 API"]);
  });

  it("supports batch", async () => {
    const model = new RecordingChatModel([json({ ...good, headline: "First" }), json({ ...good, headline: "Second" })]);
    const chain = createReleaseNotesChain({ model });
    const results = await chain.batch([input, { ...input, audience: "developers" }], { maxConcurrency: 1 });
    expect(results.map((r) => r.headline)).toEqual(["First", "Second"]);
  });

  it.each<[string, unknown]>([
    ["no commits", { audience: "customers", commits: [] }],
    ["51 commits", { audience: "customers", commits: Array.from({ length: 51 }, (_, i) => `c${i}`) }],
    ["a blank commit", { audience: "customers", commits: ["ok", "   "] }],
    ["a 201-character commit", { audience: "customers", commits: ["x".repeat(201)] }],
    ["an unknown audience", { audience: "investors", commits: ["feat: x"] }],
  ])("rejects %s without calling the model", async (_label, bad) => {
    const model = new RecordingChatModel([json(good)]);
    const fallbackModel = new RecordingChatModel([json(good)]);
    await expectRejects(createReleaseNotesChain({ model, fallbackModel }).invoke(bad as ReleaseNotesInput), ValidationError);
    expect(model.calls).toHaveLength(0);
    expect(fallbackModel.calls).toHaveLength(0);
  });

  it.each<[string, unknown]>([
    ["prose", "Here are your notes!"],
    ["an empty headline", json({ ...good, headline: "  " })],
    ["a long headline", json({ ...good, headline: "h".repeat(121) })],
    ["no highlights", json({ ...good, highlights: [] })],
    ["six highlights", json({ ...good, highlights: ["a", "b", "c", "d", "e", "f"] })],
    ["a blank highlight", json({ ...good, highlights: ["ok", " "] })],
    ["missing breakingChanges", json({ headline: "x", highlights: ["y"] })],
  ])("raises OutputParserException after two attempts with %s", async (_label, bad) => {
    const model = new RecordingChatModel([bad as string]);
    await expectRejects(createReleaseNotesChain({ model }).invoke(input), OutputParserException);
    expect(model.calls).toHaveLength(2);
  }, 15_000);

  it("retries once and succeeds when the second output is valid", async () => {
    const model = new RecordingChatModel(["not json", json(good)]);
    expect(await createReleaseNotesChain({ model }).invoke(input)).toEqual(expected);
    expect(model.calls).toHaveLength(2);
  }, 15_000);

  it("falls back to the second model after the primary fails twice", async () => {
    const model = new RecordingChatModel([new Error("primary overloaded")]);
    const fallbackModel = new RecordingChatModel([json({ ...good, headline: "From fallback" })]);
    const result = await createReleaseNotesChain({ model, fallbackModel }).invoke(input);
    expect(result.headline).toBe("From fallback");
    expect(model.calls).toHaveLength(2);
    expect(fallbackModel.calls).toHaveLength(1);
    expect(fallbackModel.transcript(0)).toEqual(model.transcript(0));
  }, 15_000);

  it("uses the fallback after invalid primary output and gives up after the fallback's two attempts", async () => {
    const model = new RecordingChatModel(["garbage"]);
    const fallbackModel = new RecordingChatModel(["still garbage"]);
    await expect(createReleaseNotesChain({ model, fallbackModel }).invoke(input)).rejects.toBeInstanceOf(Error);
    expect(model.calls).toHaveLength(2);
    expect(fallbackModel.calls).toHaveLength(2);
  }, 20_000);

  it("does not call the fallback when the primary succeeds", async () => {
    const model = new RecordingChatModel([json(good)]);
    const fallbackModel = new RecordingChatModel([json(good)]);
    await createReleaseNotesChain({ model, fallbackModel }).invoke(input);
    expect(fallbackModel.calls).toHaveLength(0);
  });
});
