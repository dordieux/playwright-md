import fs from "node:fs";
import path from "node:path";
import type { TestType } from "@playwright/test";
import { ConceptRegistry, resolveBodyStep } from "./concepts.js";
import { partitionMarkdownFiles } from "./files.js";
import { referencedParams, substituteStep } from "./params.js";
import { parseMarkdown } from "./parser.js";
import type { StepRegistry } from "./registry.js";
import { resolveSpecialParams } from "./special-params.js";
import type { Scenario, Spec, Step, Table } from "./types.js";

/** Options for `defineSpecs`. */
export interface DefineOptions {
  /**
   * Whether the scenarios in these specs may run in parallel with each other.
   *
   * Scenarios are normally isolated by worker-scoped fixtures — each worker
   * gets its own database, its own mock — in which case nothing here is needed.
   * Set `false` only when the scenarios genuinely share one stateful backend
   * that each of them resets on entry. Omit to inherit the project's setting.
   */
  parallel?: boolean;
}

/** What a generated scenario needs in order to run. */
interface PreparedScenario {
  scenario: Scenario;
  /** Union of the fixtures requested by this scenario's steps. */
  fixtures: string[];
  /** Steps paired with their resolved definition, or the failure to report. */
  plan: PreparedStep[];
  /** The spec's teardown steps, run after the plan whatever it did. */
  teardown: PreparedStep[];
}

/**
 * A resolved step. A concept holds its expanded body, so the plan is a tree:
 * concepts nest, and so do the `test.step`s they produce.
 */
export type PreparedStep =
  | { kind: "step"; step: Step; file: string; run: (ctx: never) => unknown; args: string[] }
  | { kind: "concept"; step: Step; file: string; children: PreparedStep[] }
  | { kind: "error"; step: Step; file: string; message: string };

/**
 * Build `defineSpecs` for a registry and a Playwright `test`.
 *
 * Exported for `createSpecs`; consumers get the bound function rather than
 * this factory.
 */
export function createDefineSpecs(
  // Matches Playwright's own KeyValue, whose values are `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  test: TestType<Record<string, any>, Record<string, any>>,
  registry: StepRegistry,
  concepts: ConceptRegistry,
): (target: string | string[], opts?: DefineOptions) => void {
  return function defineSpecs(target, opts = {}) {
    const files = partitionMarkdownFiles(target);

    // Concepts first: a spec is resolved as it is collected, so a `.cpt.md`
    // alongside the specs has to be registered before any of them are read.
    for (const file of files.concepts) concepts.loadFile(file);

    for (const file of files.specs) {
      const spec = parseMarkdown(fs.readFileSync(file, "utf8"), file);
      const suite = spec.title || path.basename(file, ".md");
      const relFile = path.relative(process.cwd(), file);

      test.describe(suite, () => {
        if (opts.parallel === false) {
          test.describe.configure({ mode: "default" });
        } else if (opts.parallel === true) {
          test.describe.configure({ mode: "parallel" });
        }

        for (const scenario of spec.scenarios) {
          for (const row of dataRows(spec, scenario)) {
            const substitute = (step: Step): Step =>
              row ? substituteStep(step, row) : step;
            const prepared = prepare(
              scenario,
              [...spec.background, ...scenario.steps].map(substitute),
              spec.teardown.map(substitute),
              registry,
              concepts,
              file,
            );

            const details: {
              tag?: string[];
              annotation: Array<{ type: string; description: string }>;
            } = {
              annotation: [
                { type: "spec", description: `${relFile}:${scenario.line}` },
              ],
            };

            // Spec tags are inherited by every scenario, as in Gauge; the
            // `-- tag` heading suffix is a tag too, and is recorded separately
            // so `specInfo().tag` keeps meaning that one thing.
            const tags = [
              ...spec.tags,
              ...scenario.tags,
              ...(scenario.tag ? [scenario.tag] : []),
            ];
            if (tags.length > 0) {
              details.tag = [...new Set(tags)].map((t) => `@${t}`);
            }
            if (scenario.tag) {
              details.annotation.push({
                type: "spec-tag",
                description: scenario.tag,
              });
            }
            if (row) {
              details.annotation.push({
                type: "spec-row",
                description: JSON.stringify(Object.fromEntries(row)),
              });
            }

            // The body is generated with a per-scenario destructuring pattern,
            // so its shape is not statically known to TypeScript.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            test(titleFor(scenario.title, row), details, buildTestBody(prepared) as any);
          }
        }
      });
    }
  };
}

/**
 * The rows a scenario runs for: one `null` when it is not data-driven, and
 * otherwise one entry per combination of the spec's and the scenario's tables.
 *
 * A table drives execution only when a step actually refers to one of its
 * columns. A table nothing refers to is documentation — which is what lets a
 * spec carry an explanatory table without silently multiplying its scenarios.
 */
export function dataRows(spec: Spec, scenario: Scenario): Array<Map<string, string> | null> {
  const steps = [...spec.background, ...scenario.steps];
  const referenced = new Set<string>();
  for (const step of steps) {
    for (const name of referencedParams(step)) referenced.add(name);
  }

  const driving = (table: Table | null): Array<Record<string, string>> | null =>
    table && table.headers.some((h) => referenced.has(h)) ? table.rows : null;

  const specRows = driving(spec.dataTable);
  const scenarioRows = driving(scenario.dataTable);
  if (!specRows && !scenarioRows) return [null];

  // Both tables present is a nested loop: every spec row against every
  // scenario row. The scenario's columns win a name clash, being the nearer.
  const out: Array<Map<string, string>> = [];
  for (const outer of specRows ?? [{}]) {
    for (const inner of scenarioRows ?? [{}]) {
      out.push(new Map(Object.entries({ ...outer, ...inner })));
    }
  }
  return out;
}

/** A scenario's title for one row, kept distinct so reports stay readable. */
export function titleFor(title: string, row: Map<string, string> | null): string {
  if (!row || row.size === 0) return title;
  const values = [...row].map(([k, v]) => `${k}: ${v}`).join(", ");
  return `${title} [${values}]`;
}

/** Resolve a scenario's steps and collect the fixtures they ask for. */
function prepare(
  scenario: Scenario,
  steps: Step[],
  teardownSteps: Step[],
  registry: StepRegistry,
  concepts: ConceptRegistry,
  file: string,
): PreparedScenario {
  // One set across both: teardown runs in the same test, so its fixtures are
  // part of what this scenario needs.
  const fixtures = new Set<string>();
  const plan = resolveSteps(steps, file, registry, concepts, fixtures, []);
  const teardown = resolveSteps(
    teardownSteps,
    file,
    registry,
    concepts,
    fixtures,
    [],
  );
  return { scenario, fixtures: [...fixtures].sort(), plan, teardown };
}

/**
 * Resolve a list of steps against the concepts and the step definitions,
 * expanding concepts recursively.
 *
 * Concepts win over step definitions when both could match, and a step matched
 * by both is reported rather than silently resolved — the same rule the step
 * registry applies within itself. `stack` carries the concept templates
 * currently being expanded, so a cycle is caught instead of recursing forever.
 */
export function resolveSteps(
  steps: Step[],
  file: string,
  registry: StepRegistry,
  concepts: ConceptRegistry,
  fixtures: Set<string>,
  stack: string[],
): PreparedStep[] {
  const relFile = path.relative(process.cwd(), file);
  const plan: PreparedStep[] = [];

  const fail = (step: Step, message: string): void => {
    // Reported as a failing scenario rather than by crashing collection, so the
    // rest of the suite still runs.
    plan.push({ kind: "error", step, file, message });
  };

  for (const raw of steps) {
    // `<file:…>` and `<table:…>` are read from disk first: the file's contents
    // become an argument, so the step binds as if it had been written out.
    let step: Step;
    try {
      step = resolveSpecialParams(raw, file);
    } catch (err) {
      fail(raw, (err as Error).message);
      continue;
    }

    // Anything still written `<name>` after substitution refers to a column no
    // table provides. Gauge rejects this, and so do we: it is a typo far more
    // often than it is literal text.
    const unresolved = [...referencedParams(step)];
    if (unresolved.length > 0) {
      fail(
        step,
        `${unresolved.map((n) => `<${n}>`).join(", ")} in:\n  "${step.text}"\n` +
          `  (${relFile}:${step.line})\n` +
          "  refers to a data table column that is not defined. Add it to the " +
          "spec's or the scenario's table, or remove the angle brackets.",
      );
      continue;
    }

    const concept = concepts.find(step);

    let match;
    try {
      match = registry.find(step);
    } catch (err) {
      fail(step, `${(err as Error).message}\n  (${relFile}:${step.line})`);
      continue;
    }

    if (concept && match) {
      fail(
        step,
        `"${step.text}" matches both a concept (${concept.concept.file}:${concept.concept.line}) ` +
          `and a step definition.\n  (${relFile}:${step.line})\n` +
          "  Which one runs would be arbitrary; make them distinct.",
      );
      continue;
    }

    if (concept) {
      if (stack.includes(concept.concept.template)) {
        fail(
          step,
          `the concept "${concept.concept.text}" is recursive:\n  ` +
            [...stack, concept.concept.template].join("\n  → ") +
            `\n  (${concept.concept.file}:${concept.concept.line})`,
        );
        continue;
      }
      const body = concept.concept.steps.map((s) =>
        resolveBodyStep(s, concept.concept.params, concept.args),
      );
      plan.push({
        kind: "concept",
        step,
        file,
        children: resolveSteps(
          body,
          concept.concept.file,
          registry,
          concepts,
          fixtures,
          [...stack, concept.concept.template],
        ),
      });
      continue;
    }

    if (!match) {
      const hint = registry.suggest(step.template);
      fail(
        step,
        `No step definition matches:\n  "${step.text}"\n  (${relFile}:${step.line})` +
          (hint ? `\n  Did you mean: "${hint}"?` : ""),
      );
      continue;
    }

    for (const name of match.definition.fixtures) fixtures.add(name);
    plan.push({
      kind: "step",
      step,
      file,
      run: match.definition.fn,
      args: match.args,
    });
  }

  return plan;
}

/**
 * Build the test body with a destructuring pattern naming exactly the fixtures
 * this scenario needs.
 *
 * Playwright decides which fixtures to create by reading that pattern, so the
 * signature has to be generated rather than fixed — which is also what keeps a
 * spec whose steps never mention `page` from starting a browser. Bodies are
 * cached per fixture set, so the generated wrapper is built once per shape.
 */
function buildTestBody(
  prepared: PreparedScenario,
): (...args: never[]) => Promise<void> {
  // Everything a plan can report -- an unmatched step, an unresolved column, a
  // recursive concept -- is known before the run starts, so it is raised before
  // the first step instead of after the ones ahead of it have had their effect.
  const failure = firstError(prepared.plan) ?? firstError(prepared.teardown);

  const runner = async (fixtures: Record<string, unknown>): Promise<void> => {
    if (failure) throw new Error(failure);
    if (prepared.teardown.length === 0) {
      await runPlan(prepared.plan, fixtures);
      return;
    }
    // Teardown runs whatever the scenario did, but must not hide why the
    // scenario failed: its own failure is only raised when there is nothing to
    // hide.
    let scenarioError: unknown;
    try {
      await runPlan(prepared.plan, fixtures);
    } catch (err) {
      scenarioError = err;
    }
    try {
      await runPlan(prepared.teardown, fixtures);
    } catch (err) {
      if (scenarioError === undefined) throw err;
    }
    if (scenarioError !== undefined) throw scenarioError;
  };
  return wrapperFor(prepared.fixtures)(runner) as (
    ...args: never[]
  ) => Promise<void>;
}

/** The first thing wrong with a plan, looking inside concepts too. */
function firstError(plan: PreparedStep[]): string | null {
  for (const entry of plan) {
    if (entry.kind === "error") return entry.message;
    if (entry.kind === "concept") {
      const deeper = firstError(entry.children);
      if (deeper) return deeper;
    }
  }
  return null;
}

/** Where a Markdown step lives, for `test.step`'s `location`. */
export interface StepLocation {
  file: string;
  line: number;
  column: number;
}

/** `test.step` wrapper so each Markdown step shows up in reports and traces. */
let reportStep: (
  title: string,
  body: () => Promise<void>,
  location: StepLocation,
) => Promise<void> = async (_title, body) => body();

/** Injected by `createSpecs` so this module does not import a `test` itself. */
export function setStepReporter(
  fn: (
    title: string,
    body: () => Promise<void>,
    location: StepLocation,
  ) => Promise<void>,
): void {
  reportStep = fn;
}

async function runPlan(
  plan: PreparedStep[],
  fixtures: Record<string, unknown>,
): Promise<void> {
  for (const entry of plan) {
    if (entry.kind === "error") throw new Error(entry.message);

    // Point each step at its own line in the Markdown, so reports and the trace
    // viewer link to the step rather than to this generator. For a concept, the
    // outer step is the call site and its children are in the concept file.
    const location = { file: entry.file, line: entry.step.line, column: 1 };

    if (entry.kind === "concept") {
      await reportStep(
        entry.step.text,
        () => runPlan(entry.children, fixtures),
        location,
      );
      continue;
    }

    await reportStep(
      entry.step.text,
      async () => {
        await (entry.run as (ctx: unknown) => unknown)({
          ...fixtures,
          args: entry.args,
          table: entry.step.table,
          text: entry.step.text,
        });
      },
      location,
    );
  }
}

type Wrapper = (
  run: (fixtures: Record<string, unknown>) => Promise<void>,
) => unknown;

const wrapperCache = new Map<string, Wrapper>();

function wrapperFor(names: string[]): Wrapper {
  const key = names.join(",");
  const cached = wrapperCache.get(key);
  if (cached) return cached;

  // An empty pattern is still a pattern: Playwright requires one.
  const pattern = names.length > 0 ? `{ ${names.join(", ")} }` : "{}";
  const body =
    `return async function (${pattern}) {\n` +
    `  return run({ ${names.join(", ")} });\n` +
    `};`;
  const wrapper = new Function("run", body) as Wrapper;
  wrapperCache.set(key, wrapper);
  return wrapper;
}
