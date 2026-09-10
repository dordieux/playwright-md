import fs from "node:fs";
import path from "node:path";
import { test } from "./test.js";
import { findStep } from "./registry.js";
import { parseMarkdown } from "./parser.js";
import { collectSpecFiles } from "./files.js";

/**
 * Discover Markdown specs and register them with Playwright as real tests.
 *
 * Call this from a `*.spec.ts` file that Playwright collects (after importing
 * your step definitions). Each `##` scenario becomes a `test()`; each step is
 * run inside a `test.step()` so it shows up individually in reports and traces:
 *
 * ```ts
 * import { defineMarkdownSpecs } from "markspec";
 * import "./steps/calculator.steps";
 *
 * defineMarkdownSpecs(new URL("./specs", import.meta.url).pathname);
 * ```
 *
 * @param target A `.md` file, a directory (searched recursively), or a list of paths.
 */
export function defineMarkdownSpecs(target: string | string[]): void {
  for (const file of collectSpecFiles(target)) {
    const spec = parseMarkdown(fs.readFileSync(file, "utf8"), file);
    const suite = spec.title || path.basename(file, ".md");

    test.describe(suite, () => {
      for (const scenario of spec.scenarios) {
        const options = scenario.tag ? { tag: `@${scenario.tag}` } : {};
        test(scenario.title, options, async ({ world }) => {
          for (const s of scenario.steps) {
            const match = findStep(s);
            if (!match) {
              throw new Error(
                `No step definition matches:\n  "${s.text}"\n  (${file})`,
              );
            }
            await test.step(s.text, async () => {
              await match.fn({
                world,
                args: match.args,
                table: s.table,
                text: s.text,
              });
            });
          }
        });
      }
    });
  }
}
