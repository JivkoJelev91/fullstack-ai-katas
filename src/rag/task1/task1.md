# Structure-Aware Document Chunking

**Task ID:** RAG-001 · **Level:** 1 · **File:** `src/rag/task1/task1.ts` · **Tests:** `npm run test:rag:1`

Split a document into chunks for a RAG index. Split at Markdown headings first, then cut long sections at good boundaries (paragraph → line → sentence → word).

## What you export

```ts
export function chunkDocument(
  document: { id: string; text: string; format: "markdown" | "text"; metadata?: Record<string, string> },
  options: { maxChars: number; overlapChars: number },
): Chunk[];
```

## The Chunk object

| Field         | Value |
| ------------- | ----- |
| `id`          | `"<docId>#<index>"` |
| `docId`       | `document.id` |
| `index`       | 0, 1, 2, ... across the whole document |
| `text`        | `document.text.slice(start, end)` |
| `start`, `end`| Character offsets into `document.text` (`end` is exclusive) |
| `headingPath` | Headings above this chunk, e.g. `["Setup", "Linux"]` |
| `metadata`    | A **copy** of `document.metadata` (`{}` if missing) |

## Step 1: sections

- **`format: "text"`:** the whole document is one section with `headingPath: []`.
- **`format: "markdown"`:** a new section starts at each heading line, meaning a line that starts with 1–6 `#` followed by a space. Text before the first heading is its own section with `headingPath: []`.
- **`headingPath`:** the heading texts (trimmed, without `#`) from the top level down. A `##` under a `#` gives `[h1, h2]`, and a new `#` starts a new path.
- A chunk never crosses from one section into another.
- Empty or whitespace-only text → `[]`.

## Step 2: cut each section into chunks

Start at the first non-whitespace character of the section. For a chunk starting at `s`:

1. If the rest of the section fits (`sectionEnd - s <= maxChars`), the chunk ends at `sectionEnd`.
2. Otherwise, choose an end `b` inside the window `s + floor(maxChars / 2) <= b <= s + maxChars`. Try the boundary types in this order, and take the **largest** `b` of the first type that exists in the window:

| Priority | Boundary  | Condition at position `b` |
| -------- | --------- | ------------------------- |
| 1        | paragraph | `text[b] === "\n" && text[b + 1] === "\n"` |
| 2        | line      | `text[b] === "\n"` |
| 3        | sentence  | `text[b - 1]` is `.`, `!` or `?` and `text[b]` is whitespace |
| 4        | word      | `text[b]` is whitespace |
| 5        | hard cut  | `b = s + maxChars` |

3. Remove trailing whitespace from the chunk, which moves `end` left.

## Step 3: where the next chunk starts (overlap)

After a chunk `[s, e)`:
- If `overlapChars === 0`, start at the first non-whitespace character at or after `e`.
- Otherwise, start at the **first word start** `p` with `e - overlapChars <= p < e`. A word start means `text[p]` is not whitespace and `text[p - 1]` is whitespace. If there is none, use the `overlapChars === 0` rule.

## Examples

**Markdown sections**

```ts
chunkDocument(
  { id: "guide", format: "markdown", metadata: { source: "docs" },
    text: "# Setup\nInstall the CLI.\n\n## Linux\nRun the script.\n\n# Usage\nCall the API." },
  { maxChars: 200, overlapChars: 0 },
);
// → [
//   { id: "guide#0", docId: "guide", index: 0, text: "# Setup\nInstall the CLI.", start: 0,  end: 24, headingPath: ["Setup"],          metadata: { source: "docs" } },
//   { id: "guide#1", docId: "guide", index: 1, text: "## Linux\nRun the script.", start: 26, end: 50, headingPath: ["Setup", "Linux"], metadata: { source: "docs" } },
//   { id: "guide#2", docId: "guide", index: 2, text: "# Usage\nCall the API.",    start: 52, end: 73, headingPath: ["Usage"],          metadata: { source: "docs" } },
// ]
```

**Paragraph boundary** (`maxChars: 50`)

```ts
text: "Alpha beta gamma delta. Epsilon zeta.\n\nEta theta iota kappa lambda mu nu."
// → chunks at [0, 37] "Alpha beta gamma delta. Epsilon zeta."
//          and [39, 73] "Eta theta iota kappa lambda mu nu."
```

**Sentence boundary** (`maxChars: 50`)

```ts
text: "One two three four five six seven. Eight nine ten eleven twelve thirteen"
// → ["One two three four five six seven.", "Eight nine ten eleven twelve thirteen"]
```

**Hard cut** (`maxChars: 50`)

```ts
text: "x".repeat(120)
// → [0, 50], [50, 100], [100, 120]
```

**Overlap** (`maxChars: 50, overlapChars: 12`)

```ts
text: "aa bb cc dd ee ff gg hh ii jj kk ll mm nn oo pp qq rr ss ..."
// → chunk 0: "aa bb ... qq"   (words 0–16)
//   chunk 1: "nn oo pp qq rr ..." (starts at the first word inside the last 12 characters of chunk 0)
```

**Plain text**

```ts
chunkDocument({ id: "d", format: "text", text: "# Not a heading\nJust text." }, { maxChars: 200, overlapChars: 0 });
// → [ { id: "d#0", text: "# Not a heading\nJust text.", headingPath: [], start: 0, end: 26, ... } ]
```

## Rules

- No libraries needed, but you may use any npm package.
- Edit only `task1.ts`. Do not change the tests.
