import fs from "node:fs";
import { referencedParams, substituteStep } from "./params.js";
import { parseStepLine, parseTable } from "./parser.js";
import type { Step } from "./types.js";

/**
 * A concept: one named sentence that stands for a sequence of steps.
 *
 * Concepts live in Markdown alongside the specs, because they are part of the
 * spec's vocabulary rather than part of the test code — "log in as a trader" is
 * a sentence a reviewer reads, not a function they call.
 */
export interface Concept {
  /** The heading as written, for diagnostics. */
  text: string;
  /** Normalized heading with `{}` at each parameter slot — the binding key. */
  template: string;
  /** Parameter names, in the order they appear in the heading. */
  params: string[];
  /** The body: the steps this concept stands for, with `<param>` unresolved. */
  steps: Step[];
  /** Absolute path of the concept file. */
  file: string;
  /** 1-based line of the `##` heading. */
  line: number;
}

/** A concept bound to a call site, with the arguments it was called with. */
export interface ConceptMatch {
  concept: Concept;
  args: string[];
}

const H2 = /^##\s+(.*)$/;
const STEP = /^\*\s+(.*)$/;
const QUOTED = /"([^"]*)"/g;

/**
 * Parse a concept file, which is shaped like a spec file: `#` is the file's
 * title and each `##` heading is one concept, whose `*` steps are its body.
 *
 * A heading's parameters are written as quoted placeholders — `"<name>"` — so a
 * concept is called exactly like any other step, with quoted arguments:
 *
 * ```markdown
 * # Authentication
 *
 * ## log in as "<user>"
 *
 * * open "/login"
 * * type "<user>" into "#username"
 * * click "Sign in"
 * ```
 *
 * Prose, blank lines and the title are ignored, so a concept file reads as
 * documentation of the vocabulary a suite speaks.
 */
export function parseConcepts(content: string, file = "<memory>"): Concept[] {
  const concepts: Concept[] = [];
  const lines = content.split(/\r?\n/);

  let current: Concept | null = null;
  let step: Step | null = null;
  let tableLines: string[] = [];

  const flushTable = () => {
    if (step && tableLines.length > 0) step.table = parseTable(tableLines);
    tableLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    const trimmed = line.trim();

    const h2 = line.match(H2);
    if (h2) {
      flushTable();
      current = parseHeading(h2[1].trim(), file, lineNo);
      concepts.push(current);
      step = null;
      continue;
    }

    const s = line.match(STEP);
    if (s) {
      flushTable();
      if (!current) {
        throw new Error(
          `${file}:${lineNo}: a step appears before any concept heading. ` +
            "In a concept file `#` is the title and every step belongs under a " +
            "`##` concept heading.",
        );
      }
      step = parseStepLine(s[1].trim(), lineNo);
      current.steps.push(step);
      continue;
    }

    if (trimmed.startsWith("|") && step) {
      tableLines.push(trimmed);
      continue;
    }

    if (trimmed === "") flushTable();
  }

  flushTable();

  for (const concept of concepts) validate(concept);
  return concepts;
}

function parseHeading(heading: string, file: string, line: number): Concept {
  const quoted = [...heading.matchAll(QUOTED)].map((m) => m[1]);
  const params: string[] = [];
  for (const value of quoted) {
    const param = /^<([A-Za-z0-9_-]+)>$/.exec(value);
    if (!param) {
      throw new Error(
        `${file}:${line}: the concept "${heading}" has a quoted value "${value}" ` +
          'that is not a parameter. Write parameters as "<name>"; a concept ' +
          "heading cannot contain literal quoted text.",
      );
    }
    params.push(param[1]);
  }

  const duplicate = params.find((p, i) => params.indexOf(p) !== i);
  if (duplicate) {
    throw new Error(
      `${file}:${line}: the concept "${heading}" declares "<${duplicate}>" twice.`,
    );
  }

  return {
    text: heading,
    template: heading.replace(QUOTED, "{}").replace(/\s+/g, " ").trim(),
    params,
    steps: [],
    file,
    line,
  };
}

function validate(concept: Concept): void {
  if (concept.steps.length === 0) {
    throw new Error(
      `${concept.file}:${concept.line}: the concept "${concept.text}" has no steps.`,
    );
  }
  const referenced = new Set<string>();
  for (const step of concept.steps) {
    for (const name of referencedParams(step)) referenced.add(name);
  }
  const unused = concept.params.filter((p) => !referenced.has(p));
  if (unused.length > 0) {
    throw new Error(
      `${concept.file}:${concept.line}: the concept "${concept.text}" declares ` +
        `${unused.map((p) => `"<${p}>"`).join(", ")} but never uses ` +
        `${unused.length > 1 ? "them" : "it"}. ` +
        "This is usually a typo in the body.",
    );
  }
}

/**
 * The concepts a suite can call. Each `createSpecs()` owns one, next to its
 * step registry.
 */
export class ConceptRegistry {
  private readonly concepts: Concept[] = [];
  private readonly loaded = new Set<string>();

  add(concept: Concept): void {
    const duplicate = this.concepts.find((c) => c.template === concept.template);
    if (duplicate) {
      throw new Error(
        `a concept is already defined for "${concept.template}" ` +
          `(${duplicate.file}:${duplicate.line}). ` +
          `The one at ${concept.file}:${concept.line} could never run.`,
      );
    }
    this.concepts.push(concept);
  }

  /**
   * Load a concept file, once.
   *
   * Concept files are discovered automatically by `defineSpecs` and may also be
   * pointed at explicitly, and two spec directories may sit under one concept
   * directory — so the same file reaching here twice is ordinary, and loading it
   * again would be reported as a duplicate definition.
   */
  loadFile(file: string): void {
    if (this.loaded.has(file)) return;
    this.loaded.add(file);
    for (const concept of parseConcepts(fs.readFileSync(file, "utf8"), file)) {
      this.add(concept);
    }
  }

  /** Find the concept a spec step calls, or null. */
  find(step: Step): ConceptMatch | null {
    const concept = this.concepts.find((c) => c.template === step.template);
    return concept ? { concept, args: step.args } : null;
  }

  /** The number of registered concepts (for diagnostics and tests). */
  get size(): number {
    return this.concepts.length;
  }
}

/**
 * Substitute a concept's arguments into one of its body steps, and re-parse it
 * so the result binds like any hand-written step.
 */
export function resolveBodyStep(
  step: Step,
  params: string[],
  args: string[],
): Step {
  const values = new Map<string, string>();
  params.forEach((p, i) => values.set(p, args[i] ?? ""));

  // A name this concept does not declare is left as written; resolving the
  // expanded step is what reports it, with the same message a spec step gets.
  return substituteStep(step, values);
}
