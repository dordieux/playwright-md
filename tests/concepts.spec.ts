import { test, expect } from "@playwright/test";
import {
  ConceptRegistry,
  parseConcepts,
  resolveBodyStep,
} from "../src/concepts.js";
import { parseMarkdown } from "../src/parser.js";

function firstStep(md: string) {
  return parseMarkdown(md).scenarios[0].steps[0];
}

function only(md: string) {
  const concepts = parseConcepts(md, "concepts.md");
  expect(concepts).toHaveLength(1);
  return concepts[0];
}

test("parses a concept's heading into a bindable template", () => {
  const concept = only(`## log in as "<user>"

* open "/login"
* type "<user>" into "#username"
`);

  expect(concept.template).toBe("log in as {}");
  expect(concept.params).toEqual(["user"]);
  expect(concept.steps.map((s) => s.text)).toEqual([
    'open "/login"',
    'type "<user>" into "#username"',
  ]);
});

test("parses several concepts from one file", () => {
  const concepts = parseConcepts(`## log in as "<user>"

* type "<user>" into "#username"

## log out

* click "Sign out"
`);

  expect(concepts.map((c) => c.template)).toEqual(["log in as {}", "log out"]);
  expect(concepts[1].params).toEqual([]);
});

test("ignores the file's `#` title, like a spec's", () => {
  const concepts = parseConcepts(`# Authentication

Prose describing the vocabulary.

## log out

* click "Sign out"
`);

  expect(concepts.map((c) => c.template)).toEqual(["log out"]);
});

test("records the concept file and line for diagnostics", () => {
  const concept = parseConcepts(
    `Some prose about the vocabulary.

## log out

* click "Sign out"
`,
    "/specs/concepts/auth.md",
  )[0];

  expect(concept.file).toBe("/specs/concepts/auth.md");
  expect(concept.line).toBe(3);
  expect(concept.steps[0].line).toBe(5);
});

test("a concept step keeps its data table", () => {
  const concept = only(`## seed "<area>"

* insert rows into "<area>"
    | day | mw |
    | 1   | 10 |
`);

  expect(concept.steps[0].table).toEqual({
    headers: ["day", "mw"],
    rows: [{ day: "1", mw: "10" }],
  });
});

test("rejects a literal quoted value in a heading", () => {
  expect(() => parseConcepts(`## log in as "admin"

* click "Sign in"
`)).toThrow(/not a parameter/);
});

test("rejects a parameter declared twice", () => {
  expect(() => parseConcepts(`## copy "<name>" to "<name>"

* copy "<name>"
`)).toThrow(/declares "<name>" twice/);
});

test("rejects a concept with no steps", () => {
  expect(() => parseConcepts(`## log out
`)).toThrow(/has no steps/);
});

test("rejects a parameter the body never uses", () => {
  expect(() => parseConcepts(`## log in as "<user>"

* click "Sign in"
`)).toThrow(/never uses it/);
});

test("rejects a step written before any heading", () => {
  expect(() => parseConcepts(`* click "Sign in"
`)).toThrow(/before any concept heading/);
});

test("substitutes arguments into a body step and re-parses it", () => {
  const concept = only(`## log in as "<user>"

* type "<user>" into "#username"
`);

  const resolved = resolveBodyStep(concept.steps[0], concept.params, ["park"]);
  expect(resolved.text).toBe('type "park" into "#username"');
  expect(resolved.template).toBe("type {} into {}");
  expect(resolved.args).toEqual(["park", "#username"]);
});

test("substitutes arguments into a body step's table", () => {
  const concept = only(`## seed "<area>"

* insert rows
    | area    | mw |
    | <area>  | 10 |
`);

  const resolved = resolveBodyStep(concept.steps[0], concept.params, ["TOKYO"]);
  expect(resolved.table!.rows).toEqual([{ area: "TOKYO", mw: "10" }]);
});

test("leaves angle brackets that are not parameters alone", () => {
  const concept = only(`## render "<tag>"

* the markup is "<<tag>>" and not "<div>"
`);

  const resolved = resolveBodyStep(concept.steps[0], concept.params, ["span"]);
  expect(resolved.args).toEqual(["<span>", "<div>"]);
});

test("binds a spec step to a concept by template", () => {
  const registry = new ConceptRegistry();
  registry.add(
    only(`## log in as "<user>"

* type "<user>" into "#username"
`),
  );

  const match = registry.find(firstStep(`# S
## sc
* log in as "park"
`));
  expect(match).not.toBeNull();
  expect(match!.args).toEqual(["park"]);
});

test("returns null when no concept matches", () => {
  const registry = new ConceptRegistry();
  registry.add(
    only(`## log out

* click "Sign out"
`),
  );

  expect(registry.find(firstStep(`# S
## sc
* log in as "park"
`))).toBeNull();
});

test("rejects two concepts with the same template", () => {
  const registry = new ConceptRegistry();
  const concept = () =>
    only(`## log in as "<user>"

* type "<user>" into "#username"
`);

  registry.add(concept());
  expect(() => registry.add(concept())).toThrow(/already defined/);
});
