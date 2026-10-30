import path from "node:path";
import type { Reporter, TestCase, TestModule } from "vitest/node";

// Prints one line per test in the form:
//   PASS EXPRESS-001: Creates a task successfully
//   FAIL EXPRESS-001: Returns 404 when the task does not exist
// The task ID is taken from the outermost `describe` block of each test file.

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number, text: string) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = (t: string) => paint(32, t);
const red = (t: string) => paint(31, t);
const yellow = (t: string) => paint(33, t);
const dim = (t: string) => paint(2, t);
const bold = (t: string) => paint(1, t);

interface ErrorLike {
  message?: string;
  name?: string;
  expected?: string;
  actual?: string;
  stacks?: Array<{ file: string; line: number; column: number }>;
}

function describePath(testCase: TestCase): string[] {
  const names: string[] = [];
  let parent = testCase.parent;
  while (parent.type === "suite") {
    names.unshift(parent.name);
    parent = parent.parent;
  }
  return names;
}

function label(testCase: TestCase): { id: string; title: string } {
  const suites = describePath(testCase);
  const id = suites[0] ?? path.basename(testCase.module.moduleId);
  const title = [...suites.slice(1), testCase.name].join(" > ");
  return { id, title };
}

function indent(text: string, prefix = "      "): string {
  return text
    .split("\n")
    .map((line) => prefix + line)
    .join("\n");
}

function formatError(error: ErrorLike, root: string): string {
  const lines: string[] = [];
  const name = error.name && error.name !== "AssertionError" && error.name !== "Error" ? `${error.name}: ` : "";
  const message = (error.message ?? String(error)).replace(" // Object.is equality", "").trim();
  lines.push(`${name}${message}`);
  if (error.expected !== undefined && error.actual !== undefined && !message.includes("\n")) {
    lines.push(`${green("Expected:")} ${truncate(error.expected)}`);
    lines.push(`${red("Received:")} ${truncate(error.actual)}`);
  }
  const testFrame = error.stacks?.find((frame) => {
    const file = frame.file.replace(/\\/g, "/");
    return file.includes("/tests/") && !file.includes("/tests/support/");
  });
  if (testFrame) {
    lines.push(dim(`at ${path.relative(root, testFrame.file).replace(/\\/g, "/")}:${testFrame.line}`));
  }
  return lines.join("\n");
}

function truncate(text: string, max = 1500): string {
  return text.length > max ? `${text.slice(0, max)}\n... (truncated)` : text;
}

export default class TaskReporter implements Reporter {
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private root = process.cwd();

  onInit(vitest: { config: { root: string } }): void {
    this.root = vitest.config.root;
  }

  onTestCaseResult(testCase: TestCase): void {
    const { id, title } = label(testCase);
    const result = testCase.result();
    if (result.state === "passed") {
      this.passed++;
      console.log(`${green("PASS")} ${bold(id)}: ${title}`);
    } else if (result.state === "failed") {
      this.failed++;
      console.log(`${red("FAIL")} ${bold(id)}: ${title}`);
      for (const error of result.errors ?? []) {
        console.log(indent(formatError(error as ErrorLike, this.root)));
      }
    } else if (result.state === "skipped") {
      this.skipped++;
      console.log(`${yellow("SKIP")} ${bold(id)}: ${title}`);
    }
  }

  onTestRunEnd(testModules: ReadonlyArray<TestModule>, unhandledErrors: ReadonlyArray<ErrorLike>): void {
    let moduleErrors = 0;
    for (const testModule of testModules) {
      const errors = testModule.errors();
      if (errors.length === 0) continue;
      moduleErrors++;
      const file = path.relative(this.root, testModule.moduleId).replace(/\\/g, "/");
      console.log(`\n${red("ERROR")} Could not run ${file}`);
      for (const error of errors) console.log(indent(formatError(error as ErrorLike, this.root)));
    }
    for (const error of unhandledErrors) {
      console.log(`\n${red("ERROR")} Unhandled error during the test run`);
      console.log(indent(formatError(error, this.root)));
    }

    const parts = [`${this.passed} passed`, `${this.failed} failed`];
    if (this.skipped > 0) parts.push(`${this.skipped} skipped`);
    if (moduleErrors > 0) parts.push(`${moduleErrors} file(s) could not run`);
    const ok = this.failed === 0 && moduleErrors === 0 && unhandledErrors.length === 0 && this.passed > 0;
    console.log(`\n${bold("Final result:")} ${(ok ? green : red)(parts.join(", ") + ".")}`);
    this.passed = this.failed = this.skipped = 0;
  }
}
