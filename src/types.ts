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
  /** 1-based line number of this step in the source file. */
  line: number;
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
  /** 1-based line number of the `##` heading in the source file. */
  line: number;
  title: string;
  /** Optional tag from the `## title -- tag` heading convention. */
  tag: string | null;
  steps: Step[];
  /**
   * A table written under the `##` heading before the scenario's first step.
   *
   * It drives the scenario only if one of its steps refers to a column with
   * `<column>`; otherwise it is documentation. See {@link Spec.dataTable}.
   */
  dataTable: Table | null;
}

/** A parsed spec file: one `# heading` plus its scenarios. */
export interface Spec {
  title: string;
  /**
   * Background steps: steps written after the `#` title but before the first
   * `##` scenario. They run before every scenario's own steps, so shared setup
   * (open the app, reset the API) lives in one place.
   */
  background: Step[];
  scenarios: Scenario[];
  /**
   * A table written before the first step and the first scenario.
   *
   * It makes the spec data-driven — every scenario runs once per row — but only
   * if some step refers to one of its columns with `<column>`. A table nothing
   * refers to is documentation, which is how a spec can carry an explanatory
   * table without silently multiplying its scenarios.
   */
  dataTable: Table | null;
  /** Absolute path of the source file, for error messages. */
  file: string;
}

/** The step's own data, supplied by playwright-md alongside the fixtures. */
export interface StepData {
  /** The step's quoted arguments (or regex capture groups), in order. */
  args: string[];
  /** The step's data table, or null. */
  table: Table | null;
  /** The raw step text, for diagnostics. */
  text: string;
}
