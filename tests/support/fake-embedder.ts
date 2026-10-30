import { vi } from "vitest";

/**
 * Deterministic embedder for tests. Dimension `i` counts how many words of the text
 * belong to topic `i`; a small constant keeps every vector non-zero.
 * Texts listed in `fixed` get exactly the given vector.
 */
export function keywordEmbedder(topics: string[][], fixed: Record<string, number[]> = {}) {
  const dimensions = topics.length;
  const vectorFor = (text: string) => {
    if (fixed[text]) return [...fixed[text]!];
    const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    return topics.map((topic, i) => words.filter((w) => topic.some((t) => w.startsWith(t))).length + (i === dimensions - 1 ? 0.01 : 0));
  };
  const embed = vi.fn(async (texts: string[]) => texts.map(vectorFor));
  return { dimensions, embed, vectorFor };
}

export function cosine(a: number[], b: number[]): number {
  const dot = a.reduce((s, x, i) => s + x * b[i]!, 0);
  const norm = (v: number[]) => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return dot / (norm(a) * norm(b));
}
