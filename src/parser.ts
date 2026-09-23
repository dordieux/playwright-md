import type { Spec, Scenario, Step, Table } from "./types.js";

const H1 = /^#\s+(.*)$/;
const H2 = /^##\s+(.*)$/;
// Steps are asterisk bullets only. A `-` bullet is prose, so a spec can carry
// explanatory bullet lists without them being mistaken for steps.
const STEP = /^\*\s+(.*)$/;
const QUOTED = /"([^"]*)"/g;

/**
 * Parse a Markdown spec into a {@link Spec}.
 *
 * Recognized syntax (a small, Gauge-flavored subset):
 *
 * - `# Heading` — the spec title (first one wins).
 * - `## Scenario -- tag` — a scenario; the optional ` -- tag` suffix becomes a
 *   Playwright tag (`@tag`).
 * - `* step text with "args"` — a step. Double-quoted substrings are the step's
 *   positional arguments. Steps before the first `##` scenario become background
 *   steps, run before every scenario. Only `*` marks a step; `-` bullets are
 *   prose, so explanatory lists are left alone.
 * - A Markdown table indented under a step becomes that step's data table.
 *
 * Everything else (blank lines, prose, headings deeper than `##`) is ignored,
 * so a spec doubles as human-readable documentation.
 */
export function parseMarkdown(content: string, file = "<memory>"): Spec {
  const spec: Spec = { title: "", background: [], scenarios: [], file };
  const lines = content.split(/\r?\n/);

  let scenario: Scenario | null = null;
  let step: Step | null = null;
  let tableLines: string[] = [];

  const flushTable = () => {
    if (step && tableLines.length > 0) {
      step.table = parseTable(tableLines);
    }
    tableLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    const trimmed = line.trim();

    const h1 = line.match(H1);
    if (h1 && !line.startsWith("##")) {
      flushTable();
      if (!spec.title) spec.title = h1[1].trim();
      continue;
    }

    const h2 = line.match(H2);
    if (h2) {
      flushTable();
      scenario = parseScenarioHeading(h2[1].trim(), lineNo);
      spec.scenarios.push(scenario);
      step = null;
      continue;
    }

    const s = line.match(STEP);
    if (s) {
      flushTable();
      step = parseStepLine(s[1].trim(), lineNo);
      // Steps before the first scenario are background; the rest belong to the
      // current scenario.
      (scenario ? scenario.steps : spec.background).push(step);
      continue;
    }

    if (trimmed.startsWith("|") && step) {
      tableLines.push(trimmed);
      continue;
    }

    // Blank line or prose: ends any table in progress but keeps the scenario.
    if (trimmed === "") flushTable();
  }

  flushTable();
  return spec;
}

function parseScenarioHeading(heading: string, line: number): Scenario {
  const sep = heading.indexOf(" -- ");
  if (sep === -1) {
    return { line, title: heading, tag: null, steps: [] };
  }
  const title = heading.slice(0, sep).trim();
  const tag = heading.slice(sep + 4).trim() || null;
  return { line, title, tag, steps: [] };
}

/**
 * Parse one step line into a {@link Step}: quoted substrings become `args`, and
 * the sentence with `{}` at each of their positions becomes the binding key.
 *
 * Shared with the concept parser, whose body steps are the same syntax.
 */
export function parseStepLine(text: string, line: number): Step {
  const args = [...text.matchAll(QUOTED)].map((m) => m[1]);
  const template = text.replace(QUOTED, "{}").replace(/\s+/g, " ").trim();
  return { line, text, template, args, table: null };
}

/** Parse the `|`-delimited lines indented under a step into its data table. */
export function parseTable(rows: string[]): Table {
  const cells = (row: string): string[] =>
    row
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const isSeparator = (row: string): boolean =>
    cells(row).every((c) => /^:?-+:?$/.test(c));

  const rowCells = rows.map(cells);
  const headers = rowCells[0] ?? [];
  const bodyRows = rowCells
    .slice(1)
    .filter((_, i) => !isSeparator(rows[i + 1]));

  const body = bodyRows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = r[i] ?? "";
    });
    return obj;
  });

  return { headers, rows: body };
}
