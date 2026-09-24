import type { TestType } from "@playwright/test";
import { ConceptRegistry } from "./concepts.js";
import { collectMarkdownFiles } from "./files.js";
import { createDefineSpecs, setStepReporter, type DefineOptions } from "./generate.js";
import { HookRegistry, type HookOptions } from "./hooks.js";
import { StepRegistry } from "./registry.js";
import type { StepData, Table } from "./types.js";

/**
 * Playwright's own fixture bag shape. It uses `any` for the values, so matching
 * it here is what lets an extended `test` be passed in without friction.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KeyValue = Record<string, any>;

/** What a step callback receives: the test's fixtures plus the step's own data. */
export type StepContext<F> = F & StepData;

/** What a step hook receives: the test's fixtures plus the step it wraps. */
export type HookContext<F> = F & {
  /** The step's sentence, as written. */
  text: string;
  /** The step's quoted arguments, in order. */
  args: string[];
  /** The step's data table, or null. */
  table: Table | null;
  /**
   * For an after-hook, what the step threw, or null when it passed. Always
   * null in a before-hook.
   */
  error: unknown;
};

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
   * Run something before every step.
   *
   * The callback destructures what it needs, like a step: fixtures by name,
   * plus `text`, `args` and `table` describing the step it wraps.
   *
   * ```ts
   * beforeStep(({ text }) => console.log(`> ${text}`));
   * ```
   *
   * Hooks wrap the steps that actually run — a concept's body, not the concept
   * sentence that led to it.
   *
   * **A hook's fixtures become the scenario's.** A hook that asks for `page`
   * would start a browser for every scenario, so restrict it with `tags`: it
   * then applies only to scenarios carrying all of them, and only those pull in
   * its fixtures.
   *
   * ```ts
   * afterStep(async ({ page, error }) => {
   *   if (error) await page.screenshot({ path: "fail.png" });
   * }, { tags: ["browser"] });
   * ```
   */
  beforeStep(
    fn: (ctx: HookContext<F>) => void | Promise<void>,
    opts?: HookOptions,
  ): void;

  /**
   * Run something after every step, including one that failed — which is when
   * a screenshot is worth most. `error` is what the step threw, or null.
   *
   * An after-hook's own failure is reported only when the step passed, so it
   * cannot replace the reason a step failed. See {@link Specs.beforeStep} for
   * how fixtures and `tags` interact.
   */
  afterStep(
    fn: (ctx: HookContext<F>) => void | Promise<void>,
    opts?: HookOptions,
  ): void;

  /**
   * Load concept files from somewhere other than the spec tree.
   *
   * Concepts are normally picked up on their own: `defineSpecs` loads every
   * `*.cpt.md` it finds, so adding one is a matter of dropping the file in.
   * Use this only for concepts kept outside that tree — a directory shared by
   * several suites, say — and call it before `defineSpecs`, since specs are
   * resolved as they are collected.
   *
   * Every `.md` file reached this way is read as a concept file, whatever it is
   * named. Loading the same file twice is a no-op.
   *
   * @param target A `.md` file, a directory (searched recursively), or a list of paths.
   */
  defineConcepts(target: string | string[]): void;

  /**
   * Discover Markdown specs and register them with Playwright as real tests.
   *
   * A `*.cpt.md` file in the tree is a concept file — a sequence of steps a
   * spec can call by name — and is loaded before the specs that call it. Every
   * other `.md` file is a spec.
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
  const concepts = new ConceptRegistry();
  const hooks = new HookRegistry();

  // Steps are reported through the same `test` the suite is generated from.
  setStepReporter((title, body, location) => test.step(title, body, { location }));

  return {
    step(pattern, fn) {
      registry.add(pattern, fn as (ctx: never) => unknown);
    },
    beforeStep(fn, opts) {
      hooks.add("before", fn as (ctx: never) => unknown, opts);
    },
    afterStep(fn, opts) {
      hooks.add("after", fn as (ctx: never) => unknown, opts);
    },
    defineConcepts(target) {
      for (const file of collectMarkdownFiles(target)) concepts.loadFile(file);
    },
    defineSpecs: createDefineSpecs(test, registry, concepts, hooks),
  };
}
