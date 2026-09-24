import { test as base } from "@playwright/test";
import { createSpecs } from "../../../src/index.js";

/** Records what ran, so the spec can prove teardown happened. */
export const log: string[] = [];

export const test = base.extend<{ record: (what: string) => void }>({
  record: async ({}, use) => {
    await use((what) => log.push(what));
  },
});

export const { step, defineSpecs } = createSpecs(test);
