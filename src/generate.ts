import fs from "node:fs";
import path from "node:path";
import type { APIRequestContext, Page } from "@playwright/test";
import { test } from "./test.js";
import { findStep } from "./registry.js";
import { parseMarkdown } from "./parser.js";
import { collectSpecFiles } from "./files.js";
import type { Step } from "./types.js";

/** Options for {@link defineMarkdownSpecs}. */
export interface DefineOptions {
  /**
   * Provide the Playwright `page` to steps (as `ctx.page`) and launch a browser
   * for each scenario. Leave false (the default) for pure-logic specs so they
   * never need a browser. Group browser specs in their own directory.
   */
  browser?: boolean;
}

/**
 * Discover Markdown specs and register them with Playwright as real tests.
 *
 * Call this from a `*.spec.ts` file that Playwright collects (after importing
 * your step definitions). Each `##` scenario becomes a `test()`; each step is
 * run inside a `test.step()` so it shows up individually in reports and traces:
 *
 * ```ts
 * import { defineMarkdownSpecs } from "playwright-md";
 * import "./steps/calculator.steps";
 *
 * defineMarkdownSpecs(new URL("./specs", import.meta.url).pathname);
 * ```
 *
 * @param target A `.md` file, a directory (searched recursively), or a list of paths.
 * @param opts   See {@link DefineOptions} (e.g. `{ browser: true }`).
 */
export function defineMarkdownSpecs(
  target: string | string[],
  opts: DefineOptions = {},
): void {
  for (const file of collectSpecFiles(target)) {
    const spec = parseMarkdown(fs.readFileSync(file, "utf8"), file);
    const suite = spec.title || path.basename(file, ".md");

    const relFile = path.relative(process.cwd(), file);

    test.describe(suite, () => {
      for (const scenario of spec.scenarios) {
        // Record where this scenario lives in the Markdown, so reports and
        // traces can point back at the .md instead of the generator.
        const details: {
          tag?: string;
          annotation: { type: string; description: string };
        } = {
          annotation: { type: "spec", description: `${relFile}:${scenario.line}` },
        };
        if (scenario.tag) details.tag = `@${scenario.tag}`;

        // Background steps run before each scenario's own steps.
        const steps = [...spec.background, ...scenario.steps];
        if (opts.browser) {
          test(scenario.title, details, async ({ world, request, page }) => {
            await runSteps(steps, relFile, world, request, page);
          });
        } else {
          test(scenario.title, details, async ({ world, request }) => {
            await runSteps(steps, relFile, world, request, undefined);
          });
        }
      }
    });
  }
}

async function runSteps(
  steps: Step[],
  relFile: string,
  world: Record<string, unknown>,
  request: APIRequestContext,
  page: Page | undefined,
): Promise<void> {
  for (const s of steps) {
    const match = findStep(s);
    if (!match) {
      throw new Error(
        `No step definition matches:\n  "${s.text}"\n  (${relFile}:${s.line})`,
      );
    }
    await test.step(s.text, async () => {
      await match.fn({
        world,
        args: match.args,
        table: s.table,
        text: s.text,
        request,
        page,
      });
    });
  }
}
