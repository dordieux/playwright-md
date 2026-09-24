import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test as base } from "@playwright/test";
import { createSpecs } from "../../../src/index.js";

/** Records what ran, so the parent process can assert on the order. */
export const log: string[] = [];

export const LOG_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "log.json",
);

// Playwright runs the suite in a worker process, so the log is handed back
// through a file rather than returned. The runner process loads this module
// too, to collect the tests, and would otherwise overwrite the worker's log
// with an empty one on its way out.
process.on("exit", () => {
  if (log.length > 0) fs.writeFileSync(LOG_FILE, JSON.stringify(log));
});

export const test = base.extend<{ record: (what: string) => void }>({
  record: async ({}, use) => {
    await use((what) => log.push(what));
  },
});

export const { step, beforeStep, afterStep, defineSpecs } = createSpecs(test);
