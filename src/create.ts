import type { TestType } from "@playwright/test";
import { createDefineSpecs, setStepReporter, type DefineOptions } from "./generate.js";
import { StepRegistry } from "./registry.js";
import type { StepData } from "./types.js";

/**
 * Playwright's own fixture bag shape. It uses `any` for the values, so matching
 * it here is what lets an extended `test` be passed in without friction.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KeyValue = Record<string, any>;

/** What a step callback receives: the test's fixtures plus the step's own data. */
export type StepContext<F> = F & StepData;

/** The suite API bound to one `test` instance. */
export interface Specs<F> {
  /**
   * Register a step definition.
   *
   * The callback destructures what it needs, exactly like a Playwright test —
   * fixtures by name, plus `args`, `table` and `text` for the step's own data:
   *
   * ```ts
   * step("the page shows {}", async ({ page, args }) => {
   *   await expect(page.getByRole("heading")).toHaveText(args[0]);
   * });
   * ```
   *
   * Only the fixtures a scenario's steps actually name are created, so a spec
   * whose steps never mention `page` never starts a browser.
   */
  step(
    pattern: string | RegExp,
    fn: (ctx: StepContext<F>) => void | Promise<void>,
  ): void;

  /**
   * Discover Markdown specs and register them with Playwright as real tests.
   *
   * @param target A `.md` file, a directory (searched recursively), or a list of paths.
   */
  defineSpecs(target: string | string[], opts?: DefineOptions): void;
}

/**
 * Bind playwright-md to your `test`.
 *
 * Extend Playwright's `test` with the resources your steps need — worker-scoped
 * ones give each worker its own, which is what makes a suite against a stateful
 * backend safe to run in parallel — then create the suite API from it:
 *
 * ```ts
 * export const test = base.extend<{}, { db: Database }>({
 *   db: [async ({}, use, workerInfo) => {
 *     const db = await connect(`app_w${workerInfo.parallelIndex}`);
 *     await use(db);
 *     await db.end();
 *   }, { scope: "worker" }],
 * });
 *
 * export const { step, defineSpecs } = createSpecs(test);
 * ```
 */
export function createSpecs<TestArgs extends KeyValue, WorkerArgs extends KeyValue>(
  test: TestType<TestArgs, WorkerArgs>,
): Specs<TestArgs & WorkerArgs> {
  const registry = new StepRegistry();

  // Steps are reported through the same `test` the suite is generated from.
  setStepReporter((title, body) => test.step(title, body));

  return {
    step(pattern, fn) {
      registry.add(pattern, fn as (ctx: never) => unknown);
    },
    defineSpecs: createDefineSpecs(test, registry),
  };
}
