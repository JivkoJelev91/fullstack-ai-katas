import { describe, expect, it } from "vitest";
import {
  buildTrainingExample,
  countLoraParameters,
  createLoraConfig,
  IGNORE_INDEX,
  packExamples,
  trainablePercentage,
  type ChatTokenizer,
  type ModelArchitecture,
  type TrainingExample,
} from "../../src/fine-tuning/task3/task3";
import { expectThrows } from "../support/expect-rejects";

// bos = 1, end = 2, header = [10, roleId], content = one id per word (101, 102, ... in order of first use).
function fakeTokenizer(): ChatTokenizer {
  const vocab = new Map<string, number>();
  const roleIds = { system: 13, user: 11, assistant: 12 } as const;
  return {
    bosId: 1,
    encodeMessage: (role, content) => ({
      header: [10, roleIds[role]],
      content: content.split(/\s+/).filter(Boolean).map((w) => vocab.get(w) ?? (vocab.set(w, 101 + vocab.size), vocab.get(w)!)),
      end: [2],
    }),
  };
}

const I = IGNORE_INDEX;

const llama: ModelArchitecture = {
  numLayers: 32,
  modules: {
    q_proj: { inFeatures: 4096, outFeatures: 4096 },
    k_proj: { inFeatures: 4096, outFeatures: 1024 },
    v_proj: { inFeatures: 4096, outFeatures: 1024 },
    o_proj: { inFeatures: 4096, outFeatures: 4096 },
  },
};

const ex = (len: number, start = 1): TrainingExample => ({
  inputIds: Array.from({ length: len }, (_, i) => start + i),
  labels: Array.from({ length: len }, (_, i) => (i === 0 ? I : start + i)),
  attentionMask: Array(len).fill(1),
});

describe("FT-003", () => {
  describe("buildTrainingExample", () => {
    it("masks everything except assistant content and end tokens", () => {
      expect(buildTrainingExample([{ role: "user", content: "hi there" }, { role: "assistant", content: "hello" }], fakeTokenizer(), { maxLength: 32 })).toEqual({
        inputIds: [1, 10, 11, 101, 102, 2, 10, 12, 103, 2],
        labels: [I, I, I, I, I, I, I, I, 103, 2],
        attentionMask: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      });
    });

    it("trains on every assistant turn by default and masks system messages", () => {
      const result = buildTrainingExample(
        [
          { role: "system", content: "be nice" },
          { role: "user", content: "q1" },
          { role: "assistant", content: "a1" },
          { role: "user", content: "q2" },
          { role: "assistant", content: "a2 done" },
        ],
        fakeTokenizer(),
        { maxLength: 64 },
      )!;
      expect(result.inputIds).toEqual([1, 10, 13, 101, 102, 2, 10, 11, 103, 2, 10, 12, 104, 2, 10, 11, 105, 2, 10, 12, 106, 107, 2]);
      expect(result.labels).toEqual([I, I, I, I, I, I, I, I, I, I, I, I, 104, 2, I, I, I, I, I, I, 106, 107, 2]);
    });

    it("trains only on the last assistant turn when requested", () => {
      const result = buildTrainingExample(
        [
          { role: "user", content: "q1" },
          { role: "assistant", content: "a1" },
          { role: "user", content: "q2" },
          { role: "assistant", content: "a2" },
        ],
        fakeTokenizer(),
        { maxLength: 64, trainOn: "last_assistant" },
      )!;
      expect(result.labels).toEqual([...Array(15).fill(I), 104, 2]);
    });

    it("returns null when the sequence is too long", () => {
      const messages = [{ role: "user" as const, content: "a b c" }, { role: "assistant" as const, content: "d" }];
      expect(buildTrainingExample(messages, fakeTokenizer(), { maxLength: 11 })).not.toBeNull();
      expect(buildTrainingExample(messages, fakeTokenizer(), { maxLength: 10 })).toBeNull();
    });

    it("returns null when nothing is trainable", () => {
      expect(buildTrainingExample([{ role: "user", content: "only a question" }], fakeTokenizer(), { maxLength: 64 })).toBeNull();
    });
  });

  describe("packExamples", () => {
    it("packs sequentially with padding, masks and restarting positions", () => {
      const packs = packExamples([ex(3, 1), ex(2, 50), ex(4, 70)], { maxLength: 6, padId: 0 });
      expect(packs).toEqual([
        {
          inputIds: [1, 2, 3, 50, 51, 0],
          labels: [I, 2, 3, I, 51, I],
          attentionMask: [1, 1, 1, 1, 1, 0],
          positionIds: [0, 1, 2, 0, 1, 0],
          sequenceLengths: [3, 2],
        },
        {
          inputIds: [70, 71, 72, 73, 0, 0],
          labels: [I, 71, 72, 73, I, I],
          attentionMask: [1, 1, 1, 1, 0, 0],
          positionIds: [0, 1, 2, 3, 0, 0],
          sequenceLengths: [4],
        },
      ]);
    });

    it("fills a pack exactly to maxLength and does not reorder examples", () => {
      const packs = packExamples([ex(4), ex(5), ex(2)], { maxLength: 6, padId: 9 });
      expect(packs.map((p) => p.sequenceLengths)).toEqual([[4], [5], [2]]);
      const exact = packExamples([ex(2), ex(4)], { maxLength: 6, padId: 9 });
      expect(exact).toHaveLength(1);
      expect(exact[0]!.attentionMask).toEqual([1, 1, 1, 1, 1, 1]);
    });

    it("returns no packs for no examples and rejects examples longer than maxLength", () => {
      expect(packExamples([], { maxLength: 8, padId: 0 })).toEqual([]);
      expectThrows(() => packExamples([ex(9)], { maxLength: 8, padId: 0 }), RangeError);
    });
  });

  describe("LoRA", () => {
    it("creates a PEFT-compatible config with defaults and sorted modules", () => {
      expect(createLoraConfig(llama, { r: 16, targetModules: ["v_proj", "q_proj"] })).toEqual({
        peft_type: "LORA",
        task_type: "CAUSAL_LM",
        r: 16,
        lora_alpha: 32,
        lora_dropout: 0.05,
        target_modules: ["q_proj", "v_proj"],
        bias: "none",
      });
      expect(createLoraConfig(llama, { r: 8, alpha: 8, dropout: 0, targetModules: ["o_proj"] })).toMatchObject({ lora_alpha: 8, lora_dropout: 0 });
    });

    it("counts LoRA parameters", () => {
      expect(countLoraParameters(llama, { r: 16, targetModules: ["q_proj", "v_proj"] })).toBe(32 * (16 * 8192 + 16 * 5120));
      expect(countLoraParameters(llama, { r: 8, targetModules: ["q_proj", "k_proj", "v_proj", "o_proj"] })).toBe(32 * 8 * (8192 + 5120 + 5120 + 8192));
    });

    it("computes the trainable percentage", () => {
      const lora = 32 * (16 * 8192 + 16 * 5120);
      expect(trainablePercentage(llama, { r: 16, targetModules: ["q_proj", "v_proj"] }, 7_000_000_000)).toBeCloseTo((lora / (7_000_000_000 + lora)) * 100, 12);
      expectThrows(() => trainablePercentage(llama, { r: 16, targetModules: ["q_proj"] }, 0), RangeError);
    });
  });
});
