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
  };
}
