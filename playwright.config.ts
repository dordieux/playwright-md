import { defineConfig } from "@playwright/test";

/**
 * playwright-md's own suite runs two things through the Playwright runner:
 *   - examples/  — Markdown specs turned into tests (the end-to-end proof)
 *   - tests/     — plain unit tests for the parser and registry
 *
 * None of these launch a browser, so no `projects` / browser download is
 * needed. Add browser projects when you write browser-driving steps.
 */
const MOCK_API_PORT = 3210;

export default defineConfig({
  testDir: ".",
  testMatch: ["examples/**/*.spec.ts", "tests/**/*.spec.ts"],
  fullyParallel: true,
  reporter: process.env.CI
    ? [["./src/reporter.ts"], ["html", { open: "never" }]]
    : [["./src/reporter.ts"]],
  use: {
    // API example steps call relative paths (e.g. request.post("/todos")).
    baseURL: `http://localhost:${MOCK_API_PORT}`,
  },
  // Boot the dependency-free mock Todo API for the API example specs.
  webServer: {
    command: "node examples/mock-server/server.mjs",
    url: `http://localhost:${MOCK_API_PORT}/todos`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(MOCK_API_PORT) },
  },
});
