import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test, expect } from "@playwright/test";
import { parseMarkdown } from "../src/parser.js";

test("steps after `___` are the spec's teardown", () => {
  const spec = parseMarkdown(`# Spec

## scenario

* do something

___

* clean up
* and again
`);

  expect(spec.scenarios[0].steps.map((s) => s.text)).toEqual(["do something"]);
  expect(spec.teardown.map((s) => s.text)).toEqual(["clean up", "and again"]);
});

test("a spec with no `___` has no teardown", () => {
  const spec = parseMarkdown(`# Spec

## scenario

* do something
`);
  expect(spec.teardown).toEqual([]);
});

test("a scenario after `___` is rejected", () => {
  expect(() =>
    parseMarkdown(
      `# Spec

## scenario

* do something

___

* clean up

## another scenario

* do something else
`,
      "spec.md",
    ),
  ).toThrow(/cannot follow the `___` teardown separator/);
});

/**
 * The runtime half: teardown has to run after a scenario that failed, without
 * replacing the reason it failed. Proving that needs a failing run, so it
 * happens in a child Playwright process against a fixture project.
 */
test("teardown runs after every scenario, failing ones included", async () => {
  test.slow();
  const dir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "fixtures",
    "teardown",
  );

  let stdout = "";
  try {
    const result = await promisify(execFile)(
      "npx",
      ["playwright", "test", "--config", path.join(dir, "playwright.config.ts")],
      { cwd: path.join(dir, "..", "..", ".."), maxBuffer: 10 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch (err) {
    // The fixture project is meant to have one failing scenario.
    stdout = (err as { stdout?: string }).stdout ?? "";
  }

  const report = JSON.parse(stdout) as {
    suites: unknown[];
  };
  const results = collect(report);

  expect(results.get("passes")).toBe("passed");
  expect(results.get("fails")).toBe("failed");

  // The scenario's own error survives, rather than being replaced by whatever
  // teardown did afterwards.
  expect(errorOf(report, "fails")).toContain("boom");

  // "never" is absent: the steps after the failing one are skipped. "teardown"
  // appears for both scenarios, the failing one included.
  const log = logFromLastStep(report);
  expect(log).toEqual(["pass", "teardown", "fail-body", "teardown"]);
});

interface SpecNode {
  title: string;
  tests: Array<{
    results: Array<{ status: string; errors: Array<{ message?: string }> }>;
  }>;
}

function specs(report: unknown): SpecNode[] {
  const out: SpecNode[] = [];
  const walk = (node: { specs?: SpecNode[]; suites?: unknown[] }): void => {
    for (const s of node.specs ?? []) out.push(s);
    for (const s of (node.suites ?? []) as Array<{ specs?: SpecNode[] }>) walk(s);
  };
  walk(report as { suites?: unknown[] });
  return out;
}

function collect(report: unknown): Map<string, string> {
  return new Map(
    specs(report).map((s) => [s.title, s.tests[0].results[0].status]),
  );
}

function errorOf(report: unknown, title: string): string {
  const spec = specs(report).find((s) => s.title === title);
  return spec?.tests[0].results[0].errors.map((e) => e.message ?? "").join("\n") ?? "";
}

/**
 * The fixture project's log lives in the child process, so it is reconstructed
 * from the order the child reported its steps in.
 */
function logFromLastStep(report: unknown): string[] {
  const noted: string[] = [];
  const walk = (steps: Array<{ title: string; steps?: unknown[] }>): void => {
    for (const step of steps) {
      const match = /^note "(.*)"$/.exec(step.title);
      if (match) noted.push(match[1]);
      walk((step.steps ?? []) as Array<{ title: string }>);
    }
  };
  for (const spec of specs(report)) {
    const result = spec.tests[0].results[0] as unknown as {
      steps?: Array<{ title: string }>;
    };
    walk(result.steps ?? []);
  }
  return noted;
}
