/**
 * FT-003: Supervised Fine-Tuning Data: Label Masking, Packing, LoRA Config
 * Specification: ./task3.md (in this folder)
 * Run the tests: npm run test:ft:3
 *
 * Keep the exported types, constant and signatures unchanged; the tests depend on them.
 */

// ---------------------------------------------------------------------------
// Contract (from the specification)
// ---------------------------------------------------------------------------

export const IGNORE_INDEX = -100;

export type Role = "system" | "user" | "assistant";

export interface ChatTokenizer {
  bosId: number;
  encodeMessage(role: Role, content: string): { header: number[]; content: number[]; end: number[] };
}

export interface TrainingExample {
  inputIds: number[];
  labels: number[];
  attentionMask: number[];
}

export interface PackedSequence extends TrainingExample {
  positionIds: number[];
  sequenceLengths: number[];
}

export interface ModelArchitecture {
  numLayers: number;
  /** Linear layers present in every transformer layer. */
  modules: Record<string, { inFeatures: number; outFeatures: number }>;
}

export interface LoraOptions {
  r: number;
  alpha?: number;
  dropout?: number;
  targetModules: string[];
}

export interface PeftLoraConfig {
  peft_type: "LORA";
  task_type: "CAUSAL_LM";
  r: number;
  lora_alpha: number;
  lora_dropout: number;
  target_modules: string[];
  bias: "none";
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function buildTrainingExample(
  messages: Array<{ role: Role; content: string }>,
  tokenizer: ChatTokenizer,
  options: { maxLength: number; trainOn?: "all_assistant" | "last_assistant" },
): TrainingExample | null {
  // TODO: see the specification
  throw new Error("FT-003 buildTrainingExample is not implemented yet");
}

export function packExamples(examples: TrainingExample[], options: { maxLength: number; padId: number }): PackedSequence[] {
  // TODO: see the specification
  throw new Error("FT-003 packExamples is not implemented yet");
}

export function createLoraConfig(architecture: ModelArchitecture, options: LoraOptions): PeftLoraConfig {
  // TODO: see the specification
  throw new Error("FT-003 createLoraConfig is not implemented yet");
}

export function countLoraParameters(architecture: ModelArchitecture, options: LoraOptions): number {
  // TODO: see the specification
  throw new Error("FT-003 countLoraParameters is not implemented yet");
}

export function trainablePercentage(architecture: ModelArchitecture, options: LoraOptions, baseParameters: number): number {
  // TODO: see the specification
  throw new Error("FT-003 trainablePercentage is not implemented yet");
}
