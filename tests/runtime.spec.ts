import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test, expect } from "@playwright/test";

/**
 * Teardown steps and step hooks only show their real behaviour around a step
 * that fails, so they are exercised by running a small fixture project in a
 * child Playwright process — one of whose scenarios is meant to fail.
 */
const DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "runtime",
);

interface SpecNode {
  title: string;
  tests: Array<{
    results: Array<{ status: string; errors: Array<{ message?: string }> }>;
  }>;
}

let report: { suites: unknown[] };
let log: string[];

test.beforeAll(async () => {
  test.setTimeout(120_000);
  fs.rmSync(path.join(DIR, "log.json"), { force: true });

  let stdout = "";
  try {
    const result = await promisify(execFile)(
      "npx",
      ["playwright", "test", "--config", path.join(DIR, "playwright.config.ts")],
      { cwd: path.join(DIR, "..", "..", ".."), maxBuffer: 10 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch (err) {
    stdout = (err as { stdout?: string }).stdout ?? "";
  }
  report = JSON.parse(stdout) as { suites: unknown[] };
  log = JSON.parse(fs.readFileSync(path.join(DIR, "log.json"), "utf8")) as string[];
});

test("the failing scenario fails, with its own error", () => {
  const byTitle = new Map(
    specs(report).map((s) => [s.title, s.tests[0].results[0]]),
  );
  expect(byTitle.get("passes")?.status).toBe("passed");
  expect(byTitle.get("fails")?.status).toBe("failed");

  // Neither teardown nor an after-hook replaces the reason it failed.
  expect(
    byTitle.get("fails")?.errors.map((e) => e.message ?? "").join("\n"),
  ).toContain("boom");
});

test("teardown runs after every scenario, the failing one included", () => {
  const noted = log.filter((l) => !l.includes(":"));
  expect(noted).toEqual(["pass", "teardown", "fail-body", "teardown"]);
});

test("the steps after a failing one are skipped", () => {
  expect(log).not.toContain("never");
});

test("hooks wrap every step that runs, teardown steps included", () => {
  expect(log.slice(0, 6)).toEqual([
    'before:note "pass"',
    "pass",
    'after:note "pass"',
    'before:note "teardown"',
    "teardown",
    'after:note "teardown"',
  ]);
});

test("an after-hook runs on a failing step and is given the error", () => {
  // "!" is the fixture project's marker for a non-null `error`.
  expect(log).toContain("before:fail");
  expect(log).toContain("after:fail!");
  // A passing step's after-hook sees no error.
  expect(log).toContain('after:note "pass"');
});

test("a tag-restricted hook does not run for scenarios without the tag", () => {
  expect(log).not.toContain("never-tagged");
});

function specs(node: unknown): SpecNode[] {
  const out: SpecNode[] = [];
  const walk = (n: { specs?: SpecNode[]; suites?: unknown[] }): void => {
    for (const s of n.specs ?? []) out.push(s);
    for (const s of (n.suites ?? []) as Array<{ specs?: SpecNode[] }>) walk(s);
  };
  walk(node as { suites?: unknown[] });
  return out;
}
