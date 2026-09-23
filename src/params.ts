import { parseStepLine } from "./parser.js";
import type { Step, Table } from "./types.js";

/**
 * A dynamic parameter reference, e.g. `<name>`.
 *
 * Both features that substitute into a step use this shape: a concept's
 * parameters, and a data table's columns.
 */
export const PARAM = /<([A-Za-z0-9_-]+)>/g;

/** Every `<name>` a step refers to, in its text and in its data table. */
export function referencedParams(step: Step): Set<string> {
  const names = new Set<string>();
  for (const m of step.text.matchAll(PARAM)) names.add(m[1]);
  for (const row of step.table?.rows ?? []) {
    for (const value of Object.values(row)) {
      for (const m of value.matchAll(PARAM)) names.add(m[1]);
    }
  }
  return names;
}

/**
 * Substitute `<name>` references into a step and re-parse it, so the result
 * binds like any hand-written step.
 *
 * Names with no value are left as written: a step may legitimately contain
 * angle brackets of its own (`<div>`), and the caller — which knows whether an
 * unresolved name is an error — decides what to do about it.
 */
export function substituteStep(step: Step, values: Map<string, string>): Step {
  const substitute = (text: string): string =>
    text.replace(PARAM, (whole, name: string) => values.get(name) ?? whole);

  const resolved = parseStepLine(substitute(step.text), step.line);
  if (step.table) resolved.table = substituteTable(step.table, substitute);
  return resolved;
}

function substituteTable(table: Table, substitute: (s: string) => string): Table {
  return {
    headers: table.headers,
    rows: table.rows.map((row) => {
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) out[key] = substitute(value);
      return out;
    }),
  };
}
