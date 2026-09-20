import path from "node:path";
import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
  TestStep,
} from "@playwright/test/reporter";

// Minimal ANSI coloring, disabled when not a TTY or NO_COLOR is set.
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap =
  (code: string) =>
  (s: string): string =>
    color ? `\x1b[${code}m${s}\x1b[0m` : s;
const green = wrap("32");
const red = wrap("31");
const yellow = wrap("33");
const dim = wrap("2");
const bold = wrap("1");
const cyan = wrap("36");

interface Row {
  /** "file.md:line" for generated specs, or the source file for other tests. */
  location: string;
  /** Section header (spec title, or file when there is none). */
  group: string;
  /** File part of the location — the grouping key. */
  file: string;
  title: string;
  status: TestResult["status"];
  duration: number;
  failingStep?: { title: string; location?: string };
  error?: string;
}

/**
 * A reporter that renders playwright-md runs the way the specs read: grouped by
 * spec, one line per scenario, and — on failure — the exact Markdown step that
 * failed plus a link back to the `.md` file and line.
 *
 * Enable it in your Playwright config:
 *
 * ```ts
 * reporter: [["playwright-md/reporter"]],
 * ```
 */
export default class MarkdownReporter implements Reporter {
  private rows: Row[] = [];
  private startedAt = 0;
  private lastFile = "";

  onBegin(): void {
    this.startedAt = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const specAnnotation = test.annotations.find(
      (a) => a.type === "spec",
    )?.description;
    const location =
      specAnnotation ?? path.relative(process.cwd(), test.location.file);
    const file = fileOf(location);

    const row: Row = {
      location,
      group: test.parent?.title || file,
      file,
      title: test.title,
      status: result.status,
      duration: result.duration,
      failingStep: failingStep(result.steps),
      error: result.error?.message
        ? stripAnsi(result.error.message).split("\n").slice(0, 8).join("\n")
        : undefined,
    };
    this.rows.push(row);

    // Print as we go: a long suite should show progress, not sit silent until
    // the end. The spec header reprints whenever the spec changes.
    if (row.file !== this.lastFile) {
      process.stdout.write(`\n${bold(row.group)}  ${dim(row.file)}\n`);
      this.lastFile = row.file;
    }
    this.writeRow(row);
  }

  private writeRow(row: Row): void {
    const dur = dim(`(${row.duration}ms)`);
    if (row.status === "passed") {
      process.stdout.write(`  ${green("✓")} ${row.title} ${dur}\n`);
      return;
    }
    if (row.status === "skipped") {
      process.stdout.write(
        `  ${yellow("○")} ${dim(row.title)} ${dim("(skipped)")}\n`,
      );
      return;
    }
    process.stdout.write(`  ${red("✗")} ${row.title} ${dur}\n`);
    if (row.failingStep) {
      process.stdout.write(`      ${red("at step:")} ${row.failingStep.title}\n`);
    }
    // Prefer the failing step's own line over the scenario's.
    process.stdout.write(
      `      ${cyan(row.failingStep?.location ?? row.location)}\n`,
    );
    if (row.error) {
      for (const l of row.error.split("\n")) {
        process.stdout.write(`      ${dim(l)}\n`);
      }
    }
  }

  onEnd(result: FullResult): void {
    const failures = this.rows.filter(
      (r) => r.status === "failed" || r.status === "timedOut",
    );
    if (failures.length > 0) {
      process.stdout.write(`\n${bold("Failures")}\n`);
      for (const row of failures) {
        process.stdout.write(`  ${red("✗")} ${row.title}\n`);
        if (row.failingStep) {
          process.stdout.write(`      ${red("at step:")} ${row.failingStep.title}\n`);
        }
        process.stdout.write(
          `      ${cyan(row.failingStep?.location ?? row.location)}\n`,
        );
      }
    }

    const passed = this.rows.filter((r) => r.status === "passed").length;
    const skipped = this.rows.filter((r) => r.status === "skipped").length;
    const secs = ((Date.now() - this.startedAt) / 1000).toFixed(1);

    const parts = [green(`${passed} passed`)];
    if (failures.length) parts.push(red(`${failures.length} failed`));
    if (skipped) parts.push(yellow(`${skipped} skipped`));
    const verdict = result.status === "passed" ? green("✓") : red("✗");
    process.stdout.write(
      `\n${verdict} ${parts.join(dim(", "))}  ${dim(`(${secs}s)`)}\n`,
    );
  }
}

function fileOf(location: string): string {
  const idx = location.lastIndexOf(":");
  return idx > 1 ? location.slice(0, idx) : location;
}

/** The innermost failing Markdown step, with the `.md` location it carries. */
function failingStep(
  steps: readonly TestStep[],
): { title: string; location?: string } | undefined {
  for (const step of steps) {
    const deeper = failingStep(step.steps);
    if (deeper) return deeper;
    if (step.error && step.category === "test.step") {
      const loc = step.location
        ? `${path.relative(process.cwd(), step.location.file)}:${step.location.line}`
        : undefined;
      return { title: step.title, location: loc };
    }
  }
  return undefined;
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}
