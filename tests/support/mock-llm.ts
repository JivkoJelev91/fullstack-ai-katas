import { vi } from "vitest";
import type { CompletionRequest, CompletionResponse, LLMClient } from "../../src/ai/shared/llm";

export function reply(text: string, overrides: Partial<CompletionResponse> = {}): CompletionResponse {
  return { text, usage: { inputTokens: 100, outputTokens: 20 }, stopReason: "end", ...overrides };
}

type Step = CompletionResponse | Error | ((request: CompletionRequest) => Promise<CompletionResponse>);

/**
 * A fake LLM that plays back the given steps in order, one per call.
 * `calls` holds a snapshot of every request as it was at call time.
 */
export function scriptedLLM(...steps: Step[]) {
  const calls: CompletionRequest[] = [];
  const signals: Array<AbortSignal | undefined> = [];
  let index = 0;

  const complete = vi.fn(async (request: CompletionRequest): Promise<CompletionResponse> => {
    calls.push({ ...request, messages: request.messages.map((m) => ({ ...m })) });
    signals.push(request.signal);
    const step = steps[Math.min(index++, steps.length - 1)];
    if (step === undefined) throw new Error("scriptedLLM: no steps configured");
    if (step instanceof Error) throw step;
    if (typeof step === "function") return step(request);
    return structuredClone(step);
  });

  const llm: LLMClient = { complete };
  return { llm, complete, calls, signals };
}

/** A step that never settles unless the request's signal is aborted. */
export function hangUntilAborted(onAbort?: () => void) {
  return (request: CompletionRequest) =>
    new Promise<CompletionResponse>((_resolve, reject) => {
      request.signal?.addEventListener("abort", () => {
        onAbort?.();
        reject(new DOMException("The operation was aborted", "AbortError"));
      });
    });
}
