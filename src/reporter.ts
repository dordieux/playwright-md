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
  failingStep?: string;
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

    this.rows.push({
      location,
      group: test.parent?.title || file,
      file,
      title: test.title,
      status: result.status,
      duration: result.duration,
      failingStep: failingStep(result.steps),
      error: result.error?.message
        ? stripAnsi(result.error.message).split("\n").slice(0, 4).join("\n")
        : undefined,
    });
  }

  onEnd(result: FullResult): void {
    const groups = new Map<string, Row[]>();
    for (const row of this.rows) {
      const list = groups.get(row.file);
      if (list) {
        list.push(row);
      } else {
        groups.set(row.file, [row]);
      }
    }

    process.stdout.write("\n");
    for (const [file, rows] of groups) {
      process.stdout.write(`${bold(rows[0].group)}  ${dim(file)}\n`);
      for (const row of rows) {
        const dur = dim(`(${row.duration}ms)`);
        if (row.status === "passed") {
          process.stdout.write(`  ${green("✓")} ${row.title} ${dur}\n`);
        } else if (row.status === "skipped") {
          process.stdout.write(
            `  ${yellow("○")} ${dim(row.title)} ${dim("(skipped)")}\n`,
          );
        } else {
          process.stdout.write(`  ${red("✗")} ${row.title} ${dur}\n`);
          if (row.failingStep) {
            process.stdout.write(
              `      ${red("at step:")} ${row.failingStep}\n`,
            );
          }
          process.stdout.write(`      ${cyan(row.location)}\n`);
          if (row.error) {
            for (const l of row.error.split("\n")) {
              process.stdout.write(`      ${dim(l)}\n`);
            }
          }
        }
      }
      process.stdout.write("\n");
    }

    const passed = this.rows.filter((r) => r.status === "passed").length;
    const failed = this.rows.filter(
      (r) => r.status === "failed" || r.status === "timedOut",
    ).length;
    const skipped = this.rows.filter((r) => r.status === "skipped").length;
    const secs = ((Date.now() - this.startedAt) / 1000).toFixed(1);

    const parts = [green(`${passed} passed`)];
    if (failed) parts.push(red(`${failed} failed`));
    if (skipped) parts.push(yellow(`${skipped} skipped`));
    const verdict = result.status === "passed" ? green("✓") : red("✗");
    process.stdout.write(
      `${verdict} ${parts.join(dim(", "))}  ${dim(`(${secs}s)`)}\n`,
    );
  }
}

function fileOf(location: string): string {
  const idx = location.lastIndexOf(":");
  return idx > 1 ? location.slice(0, idx) : location;
}

function failingStep(steps: readonly TestStep[]): string | undefined {
  for (const step of steps) {
    const deeper = failingStep(step.steps);
    if (deeper) return deeper;
    if (step.error && step.category === "test.step") return step.title;
  }
  return undefined;
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}
