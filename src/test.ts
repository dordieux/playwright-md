import { test as base, expect } from "@playwright/test";
import type { World } from "./types.js";

/**
 * The Playwright `test` extended with a per-scenario `world` fixture.
 *
 * `world` is a fresh object for every scenario, created and torn down by
 * Playwright's fixture machinery. Steps read and write it instead of reaching
 * for module-level globals, so no hidden state leaks between scenarios.
 *
 * You rarely import this directly — {@link defineMarkdownSpecs} uses it to
 * generate tests — but it is exported for advanced setups (e.g. layering your
 * own fixtures on top).
 */
export const test = base.extend<{ world: World }>({
  world: async ({}, use) => {
    await use({});
  },
});

export { expect };
