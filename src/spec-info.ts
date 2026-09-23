import path from "node:path";
import type { TestInfo } from "@playwright/test";

/** Where a running scenario came from. */
export interface SpecInfo {
  /** Absolute path of the `.md` file. */
  file: string;
  /** 1-based line of the scenario's `##` heading. */
  line: number;
  /** The `-- tag` suffix, or null when the scenario has none. */
  tag: string | null;
  /**
   * The data table row this run was generated from, or null when the scenario
   * is not data-driven. Columns from a spec table and a scenario table are
   * merged, the scenario's winning a name clash.
   */
  row: Record<string, string> | null;
}

/**
 * The spec a scenario was generated from.
 *
 * Suites that keep per-scenario resources next to their specs — fixture files
 * under a directory named after the spec and tag — need to know which scenario
 * is running. That is recorded as an annotation, and this reads it back rather
 * than making every suite parse the annotation itself:
 *
 * ```ts
 * scenario: async ({}, use, testInfo) => {
 *   const info = specInfo(testInfo);
 *   await use(resolveResources(info!.file, info!.tag));
 * },
 * ```
 *
 * Returns null for a test playwright-md did not generate.
 */
export function specInfo(testInfo: TestInfo): SpecInfo | null {
  const description = testInfo.annotations.find(
    (a) => a.type === "spec",
  )?.description;
  if (!description) return null;

  const sep = description.lastIndexOf(":");
  if (sep <= 0) return null;
  const line = Number(description.slice(sep + 1));
  if (!Number.isInteger(line)) return null;

  return {
    file: path.resolve(process.cwd(), description.slice(0, sep)),
    line,
    // Playwright tags carry a leading "@"; the spec dialect does not.
    tag: testInfo.tags[0]?.replace(/^@/, "") ?? null,
    row: readRow(testInfo),
  };
}

function readRow(testInfo: TestInfo): Record<string, string> | null {
  const raw = testInfo.annotations.find(
    (a) => a.type === "spec-row",
  )?.description;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}
