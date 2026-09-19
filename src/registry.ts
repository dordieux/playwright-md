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

/**
 * Suggest the registered template closest to an unmatched step, for a helpful
 * "did you mean" hint. Compares against template steps (regex steps are skipped)
 * and returns null when nothing is close enough to be useful.
 */
export function suggestStep(template: string): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const entry of entries) {
    if (entry.kind !== "template") continue;
    const distance = levenshtein(template, entry.template);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = entry.template;
    }
  }
  if (best === null) return null;
  // Only suggest when the edit distance is a small fraction of the length, so we
  // don't propose an unrelated step.
  const threshold = Math.max(3, Math.floor(template.length * 0.4));
  return bestDistance <= threshold ? best : null;
}

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const curr = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;
  for (let i = 1; i < rows; i++) {
    curr[0] = i;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j < cols; j++) prev[j] = curr[j];
  }
  return prev[cols - 1];
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
