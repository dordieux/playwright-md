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
    if (typeof pattern === "string") {
      this.definitions.push({
        template: normalizeTemplate(pattern),
        regexp: null,
        fixtures,
        fn,
      });
    } else {
      this.definitions.push({ template: null, regexp: pattern, fixtures, fn });
    }
  }

  /** Find the definition bound to a parsed spec step, or null. */
  find(step: Step): StepMatch | null {
    for (const definition of this.definitions) {
      if (definition.template !== null) {
        if (definition.template === step.template) {
          return { definition, args: step.args };
        }
        continue;
      }
      const match = definition.regexp!.exec(step.text);
      if (match) {
        return { definition, args: match.slice(1) };
      }
    }
    return null;
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
