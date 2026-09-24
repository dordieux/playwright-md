import { defineConfig } from "@playwright/test";

// Run by tests/teardown.spec.ts in a child process, so its deliberate failure
// does not fail the real suite.
export default defineConfig({
  testDir: ".",
  testMatch: ["*.spec.ts"],
  workers: 1,
  reporter: [["json"]],
});
