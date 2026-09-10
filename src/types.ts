import type { APIRequestContext, Page } from "@playwright/test";

/**
 * A parsed data table attached to a step, e.g.
 *
 *     * add each row
 *         | n |
 *         | 4 |
 *         | 6 |
 *
 * `headers` is `["n"]`, `rows` is `[{ n: "4" }, { n: "6" }]`.
 */
export interface Table {
  headers: string[];
  rows: Array<Record<string, string>>;
}

/** A single step line within a scenario. */
export interface Step {
  /** The raw step text as written, e.g. `the value is "2"`. */
  text: string;
  /**
   * The text with every double-quoted argument replaced by `{}`, e.g.
   * `the value is {}`. This is the key used to bind a step to its definition.
   */
  template: string;
  /** The double-quoted argument values, in order, e.g. `["2"]`. */
  args: string[];
  /** A data table indented under the step, or null. */
  table: Table | null;
}

/** A scenario: one runnable test, made of an ordered list of steps. */
export interface Scenario {
  title: string;
  /** Optional tag from the `## title -- tag` heading convention. */
  tag: string | null;
  steps: Step[];
}

/** A parsed spec file: one `# heading` plus its scenarios. */
export interface Spec {
  title: string;
  scenarios: Scenario[];
  /** Absolute path of the source file, for error messages. */
  file: string;
}

/**
 * Per-scenario scratch state handed to every step in that scenario. A fresh
 * object is created per scenario (via a Playwright fixture), so steps never
 * share hidden global state across scenarios.
 */
export type World = Record<string, unknown>;

/** The single argument object passed to a step definition. */
export interface StepContext {
  /** Per-scenario scratch state, shared across the steps of one scenario. */
  world: World;
  /** The step's quoted arguments (or regex capture groups), in order. */
  args: string[];
  /** The step's data table, or null. */
  table: Table | null;
  /** The raw step text, for diagnostics. */
  text: string;
  /**
   * Playwright's HTTP client, for API steps. Always available (it launches no
   * browser). Use `use.baseURL` in the Playwright config to call relative paths.
   */
  request: APIRequestContext;
  /**
   * The Playwright page, present only for specs defined with `{ browser: true }`.
   * Browser-driving steps use it; pure-logic specs leave it undefined so they
   * never launch (or need) a browser.
   */
  page?: Page;
}

/** A step definition body. */
export type StepFn = (ctx: StepContext) => void | Promise<void>;
