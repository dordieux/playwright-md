import { defineConfig } from "@playwright/test";

/**
 * markspec's own suite runs two things through the Playwright runner:
 *   - examples/  — Markdown specs turned into tests (the end-to-end proof)
 *   - tests/     — plain unit tests for the parser and registry
 *
 * None of these launch a browser, so no `projects` / browser download is
 * needed. Add browser projects when you write browser-driving steps.
 */
export default defineConfig({
  testDir: ".",
  testMatch: ["examples/**/*.spec.ts", "tests/**/*.spec.ts"],
  fullyParallel: true,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
});
