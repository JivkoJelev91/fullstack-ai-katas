import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatResult } from "@langchain/core/outputs";

type Step = string | Error;

/**
 * A deterministic LangChain chat model for tests.
 * Plays back `steps` in order (the last step repeats) and records the messages of every call.
 */
export class RecordingChatModel extends BaseChatModel {
  readonly calls: BaseMessage[][] = [];
  private index = 0;

  constructor(private readonly steps: Step[]) {
    super({});
  }

  _llmType(): string {
    return "recording-fake";
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    this.calls.push([...messages]);
    const step = this.steps[Math.min(this.index++, this.steps.length - 1)];
    if (step === undefined) throw new Error("RecordingChatModel: no steps configured");
    if (step instanceof Error) throw step;
    return { generations: [{ text: step, message: new AIMessage(step) }] };
  }

  /** Text content of the messages of call `n`, with their types. */
  transcript(n: number): Array<{ type: string; content: string }> {
    return (this.calls[n] ?? []).map((m) => ({
      type: m.getType(),
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));
  }
}
