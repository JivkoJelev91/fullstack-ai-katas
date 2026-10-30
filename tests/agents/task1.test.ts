import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AgentStepLimitError, defineTool, runAgent, type AgentTool } from "../../src/agents/task1/task1";
import { expectRejects } from "../support/expect-rejects";
import { assistant, call, scriptedToolModel } from "../support/mock-tool-model";

function weatherTool(impl?: (args: { city: string }) => Promise<unknown>) {
  const execute = vi.fn(impl ?? (async ({ city }: { city: string }) => ({ city, tempC: 21 })));
  const tool = defineTool({
    name: "get_weather",
    description: "Current weather for a city",
    schema: z.object({ city: z.string().min(1), unit: z.enum(["C", "F"]).optional() }),
    execute: (args) => execute(args),
  });
  return { tool, execute };
}

const base = { system: "You are helpful.", input: "Weather in Sofia?" };

describe("AGENT-001", () => {
  describe("defineTool", () => {

    it("advertises tools with a JSON Schema for their parameters", async () => {
      const { tool } = weatherTool();
      const { model, requests } = scriptedToolModel(assistant("done"));
      await runAgent({ model, tools: [tool], ...base });
      expect(requests[0]!.tools).toHaveLength(1);
      const spec = requests[0]!.tools[0]!;
      expect(spec.name).toBe("get_weather");
      expect(spec.description).toBe("Current weather for a city");
      expect(spec.parameters).toMatchObject({ type: "object", properties: { city: { type: "string" }, unit: { enum: ["C", "F"] } } });
      expect(spec.parameters.required).toEqual(["city"]);
    });
  });

  describe("runAgent", () => {
    it("runs tools and returns the final answer", async () => {
      const { tool, execute } = weatherTool();
      const { model, requests } = scriptedToolModel(
        assistant("", [call("call_1", "get_weather", { city: "Sofia" })]),
        assistant("It is 21°C in Sofia."),
      );
      const result = await runAgent({ model, tools: [tool], ...base });
      expect(result.output).toBe("It is 21°C in Sofia.");
      expect(result.steps).toBe(2);
      expect(result.toolCalls).toEqual([{ id: "call_1", name: "get_weather", ok: true }]);
      expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
      expect(execute).toHaveBeenCalledWith({ city: "Sofia" });

      expect(requests[0]!.messages).toEqual([
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Weather in Sofia?" },
      ]);
      expect(requests[1]!.messages.slice(2)).toEqual([
        { role: "assistant", content: "", toolCalls: [call("call_1", "get_weather", { city: "Sofia" })] },
        { role: "tool", toolCallId: "call_1", content: JSON.stringify({ city: "Sofia", tempC: 21 }) },
      ]);
      expect(result.messages).toHaveLength(5);
      expect(result.messages.at(-1)).toEqual({ role: "assistant", content: "It is 21°C in Sofia." });
    });

    it("finishes immediately when there are no tool calls, including an empty list", async () => {
      const { tool, execute } = weatherTool();
      const { model } = scriptedToolModel(assistant("Hello!", []));
      const result = await runAgent({ model, tools: [tool], ...base });
      expect(result).toMatchObject({ output: "Hello!", steps: 1, toolCalls: [] });
      expect(execute).not.toHaveBeenCalled();
    });

    it("passes string results through unchanged and gives tools a context", async () => {
      const contexts: unknown[] = [];
      const tool = defineTool({
        name: "echo",
        description: "Echo",
        schema: z.object({ text: z.string() }),
        execute: async ({ text }, ctx) => {
          contexts.push(ctx);
          return text.toUpperCase();
        },
      });
      const { model, requests } = scriptedToolModel(assistant("", [call("c1", "echo", { text: "hi" })]), assistant("done"));
      await runAgent({ model, tools: [tool], ...base });
      expect(requests[1]!.messages.at(-1)).toEqual({ role: "tool", toolCallId: "c1", content: "HI" });
      expect(contexts[0]).toMatchObject({ callId: "c1" });
      expect((contexts[0] as { signal: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
    });

    it("reports unknown tools to the model", async () => {
      const { tool } = weatherTool();
      const { model, requests } = scriptedToolModel(assistant("", [call("c1", "get_stock_price", { ticker: "X" })]), assistant("Sorry"));
      const result = await runAgent({ model, tools: [tool], ...base });
      expect(requests[1]!.messages.at(-1)).toEqual({ role: "tool", toolCallId: "c1", content: "Unknown tool: get_stock_price", isError: true });
      expect(result.toolCalls).toEqual([{ id: "c1", name: "get_stock_price", ok: false }]);
    });

    it.each([
      ["malformed JSON", '{"city": '],
      ["a schema violation", JSON.stringify({ city: "" })],
      ["a wrong type", JSON.stringify({ city: 42 })],
    ])("reports %s without executing the tool", async (_label, args) => {
      const { tool, execute } = weatherTool();
      const { model, requests } = scriptedToolModel(assistant("", [call("c1", "get_weather", args)]), assistant("ok"));
      await runAgent({ model, tools: [tool], ...base });
      const message = requests[1]!.messages.at(-1) as { content: string; isError?: boolean };
      expect(message.isError).toBe(true);
      expect(message.content.startsWith("Invalid arguments")).toBe(true);
      expect(execute).not.toHaveBeenCalled();
    });

    it("reports tool errors and keeps going", async () => {
      const { tool } = weatherTool(async () => Promise.reject(new Error("weather API 503")));
      const { model, requests } = scriptedToolModel(assistant("", [call("c1", "get_weather", { city: "Sofia" })]), assistant("The weather service is down."));
      const result = await runAgent({ model, tools: [tool], ...base });
      expect(requests[1]!.messages.at(-1)).toEqual({ role: "tool", toolCallId: "c1", content: "Tool error: weather API 503", isError: true });
      expect(result.output).toBe("The weather service is down.");
    });

    it("times out hung tools and aborts their signal", async () => {
      let seen: AbortSignal | undefined;
      const tool = defineTool({
        name: "slow",
        description: "Never finishes",
        schema: z.object({}),
        execute: (_a, ctx) => {
          seen = ctx.signal;
          return new Promise(() => {});
        },
      });
      const { model, requests } = scriptedToolModel(assistant("", [call("c1", "slow", {})]), assistant("gave up"));
      await runAgent({ model, tools: [tool], ...base, toolTimeoutMs: 30 });
      expect(requests[1]!.messages.at(-1)).toEqual({ role: "tool", toolCallId: "c1", content: "Tool timed out after 30 ms", isError: true });
      expect(seen?.aborted).toBe(true);
    });

    it("runs multiple tool calls concurrently and keeps call order", async () => {
      let inFlight = 0;
      let peak = 0;
      const tool = defineTool({
        name: "wait",
        description: "Waits",
        schema: z.object({ ms: z.number(), label: z.string() }),
        execute: async ({ ms, label }) => {
          inFlight++;
          peak = Math.max(peak, inFlight);
          await new Promise((r) => setTimeout(r, ms));
          inFlight--;
          return label;
        },
      });
      const { model, requests } = scriptedToolModel(
        assistant("", [call("a", "wait", { ms: 60, label: "first" }), call("b", "wait", { ms: 5, label: "second" }), call("c", "wait", { ms: 30, label: "third" })]),
        assistant("done"),
      );
      const started = Date.now();
      await runAgent({ model, tools: [tool], ...base });
      expect(peak).toBe(3);
      expect(Date.now() - started).toBeLessThan(150);
      expect(requests[1]!.messages.slice(-3).map((m) => (m as { toolCallId: string; content: string }).toolCallId + ":" + (m as { content: string }).content)).toEqual([
        "a:first",
        "b:second",
        "c:third",
      ]);
    });

    it("truncates long tool outputs", async () => {
      const tool = defineTool({ name: "big", description: "Big", schema: z.object({}), execute: async () => "x".repeat(50) });
      const { model, requests } = scriptedToolModel(assistant("", [call("c1", "big", {})]), assistant("done"));
      await runAgent({ model, tools: [tool], ...base, maxToolOutputChars: 10 });
      expect((requests[1]!.messages.at(-1) as { content: string }).content).toBe("x".repeat(10) + "\n[truncated]");
    });

    it("throws AgentStepLimitError after maxSteps model calls", async () => {
      const { tool } = weatherTool();
      const { model, chat } = scriptedToolModel(assistant("", [call("c", "get_weather", { city: "Sofia" })]));
      const error = await expectRejects(runAgent({ model, tools: [tool], ...base, maxSteps: 3 }), AgentStepLimitError);
      expect(error.steps).toBe(3);
      expect(chat).toHaveBeenCalledTimes(3);
      expect(error.messages.filter((m) => m.role === "tool")).toHaveLength(3);
    });

    it("uses a default of 8 steps", async () => {
      const { tool } = weatherTool();
      const { model, chat } = scriptedToolModel(assistant("", [call("c", "get_weather", { city: "Sofia" })]));
      await expectRejects(runAgent({ model, tools: [tool], ...base }), AgentStepLimitError);
      expect(chat).toHaveBeenCalledTimes(8);
    });

    it("propagates model errors", async () => {
      const error = new Error("model unavailable");
      const { model } = scriptedToolModel(error);
      await expect(runAgent({ model, tools: [], ...base })).rejects.toBe(error);
    });
  });
});
