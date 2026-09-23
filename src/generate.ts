import fs from "node:fs";
import path from "node:path";
import type { TestType } from "@playwright/test";
import { ConceptRegistry, resolveBodyStep } from "./concepts.js";
import { partitionMarkdownFiles } from "./files.js";
import { parseMarkdown } from "./parser.js";
import type { StepRegistry } from "./registry.js";
import type { Scenario, Step } from "./types.js";

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
          const prepared = prepare(
            scenario,
            spec.background,
            registry,
            concepts,
            file,
          );
          const details: {
            tag?: string;
            annotation: { type: string; description: string };
          } = {
            annotation: {
              type: "spec",
              description: `${relFile}:${scenario.line}`,
            },
          };
          if (scenario.tag) details.tag = `@${scenario.tag}`;

          // The body is generated with a per-scenario destructuring pattern, so
          // its shape is not statically known to TypeScript.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          test(scenario.title, details, buildTestBody(prepared) as any);
        }
      });
    }
  };
}

/** Resolve a scenario's steps and collect the fixtures they ask for. */
function prepare(
  scenario: Scenario,
  background: Step[],
  registry: StepRegistry,
  concepts: ConceptRegistry,
  file: string,
): PreparedScenario {
  const fixtures = new Set<string>();
  const plan = resolveSteps(
    [...background, ...scenario.steps],
    file,
    registry,
    concepts,
    fixtures,
    [],
  );
  return { scenario, fixtures: [...fixtures].sort(), plan };
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

  for (const step of steps) {
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
  const runner = async (fixtures: Record<string, unknown>): Promise<void> => {
    await runPlan(prepared.plan, fixtures);
  };
  return wrapperFor(prepared.fixtures)(runner) as (
    ...args: never[]
  ) => Promise<void>;
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
