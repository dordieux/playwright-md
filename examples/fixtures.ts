import { test as base } from "@playwright/test";
import { createSpecs } from "playwright-md";

/**
 * The suite's own `test`, extended with whatever the steps need.
 *
 * `total` is test-scoped: each scenario gets a fresh one, which is where
 * per-scenario scratch state lives now that there is no implicit `world`.
 */
export const test = base.extend<{ total: { value: number }; lastStatus: { code: number } }>({
  total: async ({}, use) => {
    await use({ value: 0 });
  },
  lastStatus: async ({}, use) => {
    await use({ code: 0 });
  },
});

export const { step, defineSpecs } = createSpecs(test);
