import type { Step, StepFn } from "./types.js";

interface TemplateEntry {
  kind: "template";
  template: string;
  fn: StepFn;
}
interface RegexEntry {
  kind: "regex";
  re: RegExp;
  fn: StepFn;
}
type Entry = TemplateEntry | RegexEntry;

const entries: Entry[] = [];

/** The resolved binding of a spec step to its definition. */
export interface StepMatch {
  fn: StepFn;
  args: string[];
}

/**
 * Register a step definition.
 *
 * Two forms are supported:
 *
 * - **Template string** — write the step sentence with `{}` at each argument
 *   position, e.g. `step("the value is {}", ...)`. It binds to spec steps whose
 *   quoted arguments occupy the same positions (`the value is "2"`). The `{}`
 *   arguments arrive as `ctx.args`.
 * - **RegExp** — matched against the raw step text; capture groups become
 *   `ctx.args`.
 */
export function step(pattern: string | RegExp, fn: StepFn): void {
  if (typeof pattern === "string") {
    entries.push({ kind: "template", template: normalizeTemplate(pattern), fn });
  } else {
    entries.push({ kind: "regex", re: pattern, fn });
  }
}

/** Find the definition bound to a parsed spec step, or null. */
export function findStep(s: Step): StepMatch | null {
  for (const entry of entries) {
    if (entry.kind === "template") {
      if (entry.template === s.template) {
        return { fn: entry.fn, args: s.args };
      }
    } else {
      const m = entry.re.exec(s.text);
      if (m) {
        return { fn: entry.fn, args: m.slice(1) };
      }
    }
  }
  return null;
}

/** The number of registered step definitions (for diagnostics/tests). */
export function stepCount(): number {
  return entries.length;
}

/** Clear the registry. Intended for unit tests. */
export function resetSteps(): void {
  entries.length = 0;
}

/**
 * Normalize an author's template to the same shape the parser produces: a
 * sentence with `{}` at each argument slot. Authors may optionally wrap slots
 * in quotes (`"{}"`); both spellings collapse to `{}`.
 */
function normalizeTemplate(pattern: string): string {
  return pattern.replace(/"\{\}"/g, "{}").replace(/\s+/g, " ").trim();
}
