import { requestedFixtures } from "./fixtures.js";
import type { Step } from "./types.js";

/** A registered step definition, with the fixtures its callback asks for. */
export interface StepDefinition {
  /** Normalized template (`{}` at each argument slot), for template steps. */
  template: string | null;
  /** Pattern for RegExp steps. */
  regexp: RegExp | null;
  /** Playwright fixture names the callback destructures. */
  fixtures: string[];
  fn: (ctx: never) => unknown;
}

/** The resolved binding of a spec step to its definition. */
export interface StepMatch {
  definition: StepDefinition;
  args: string[];
}

/**
 * A step registry. Each `createSpecs()` owns one, so suites can coexist in a
 * process without sharing module-level state.
 */
export class StepRegistry {
  private readonly definitions: StepDefinition[] = [];

  /**
   * Register a step definition.
   *
   * - **Template string** — the sentence with `{}` at each argument position
   *   (`"the value is {}"`), bound to spec steps whose quoted arguments sit in
   *   the same places (`the value is "2"`).
   * - **RegExp** — matched against the raw step text; capture groups become
   *   `ctx.args`.
   */
  add(pattern: string | RegExp, fn: (ctx: never) => unknown): void {
    const fixtures = requestedFixtures(fn);
    const definition: StepDefinition =
      typeof pattern === "string"
        ? { template: normalizeTemplate(pattern), regexp: null, fixtures, fn }
        : { template: null, regexp: pattern, fixtures, fn };

    // Registering the same pattern twice is always a mistake: one of the two
    // would silently never run.
    const duplicate = this.definitions.find((d) =>
      definition.template !== null
        ? d.template === definition.template
        : d.regexp?.source === definition.regexp!.source &&
          d.regexp?.flags === definition.regexp!.flags,
    );
    if (duplicate) {
      throw new Error(
        `a step is already defined for ${describe(definition)}. ` +
          "Two definitions for the same step would leave one of them dead; " +
          "remove or rename one.",
      );
    }

    this.definitions.push(definition);
  }

  /**
   * Find the definition bound to a parsed spec step.
   *
   * Returns null when nothing matches. Throws when more than one definition
   * matches: which one would run is then an accident of registration order, so
   * it is reported rather than silently resolved.
   */
  find(step: Step): StepMatch | null {
    const matches: StepMatch[] = [];
    for (const definition of this.definitions) {
      if (definition.template !== null) {
        if (definition.template === step.template) {
          matches.push({ definition, args: step.args });
        }
        continue;
      }
      const match = definition.regexp!.exec(step.text);
      if (match) {
        matches.push({ definition, args: match.slice(1) });
      }
    }

    if (matches.length > 1) {
      throw new Error(
        `"${step.text}" matches ${matches.length} step definitions:\n` +
          matches.map((m) => `  - ${describe(m.definition)}`).join("\n") +
          "\nWhich one runs would depend on registration order; make the patterns distinct.",
      );
    }
    return matches[0] ?? null;
  }

  /**
   * The registered template closest to an unmatched step, for a "did you mean"
   * hint. RegExp steps are skipped, and nothing is suggested when the closest
   * template is not actually close.
   */
  suggest(template: string): string | null {
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const definition of this.definitions) {
      if (definition.template === null) continue;
      const distance = levenshtein(template, definition.template);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = definition.template;
      }
    }
    if (best === null) return null;
    const threshold = Math.max(3, Math.floor(template.length * 0.4));
    return bestDistance <= threshold ? best : null;
  }

  /** The number of registered definitions (for diagnostics and tests). */
  get size(): number {
    return this.definitions.length;
  }
}

/** A definition's pattern, for diagnostics. */
function describe(definition: StepDefinition): string {
  return definition.template !== null
    ? `the template "${definition.template}"`
    : `the pattern ${String(definition.regexp)}`;
}

/**
 * Normalize an author's template to the shape the parser produces: the sentence
 * with `{}` at each argument slot. Slots may optionally be written `"{}"`.
 */
function normalizeTemplate(pattern: string): string {
  return pattern.replace(/"\{\}"/g, "{}").replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const curr = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j < cols; j++) prev[j] = curr[j];
  }
  return prev[cols - 1];
}
