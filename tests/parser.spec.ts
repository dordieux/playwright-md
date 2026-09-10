import { test, expect } from "@playwright/test";
import { parseMarkdown } from "../src/parser.js";

test("parses spec title and scenarios", () => {
  const spec = parseMarkdown(`# Calculator

## adds two numbers -- smoke
* the value is "2"
* add "3"
`);
  expect(spec.title).toBe("Calculator");
  expect(spec.scenarios).toHaveLength(1);
  expect(spec.scenarios[0].title).toBe("adds two numbers");
  expect(spec.scenarios[0].tag).toBe("smoke");
  expect(spec.scenarios[0].steps).toHaveLength(2);
});

test("extracts quoted args and builds the {} template", () => {
  const spec = parseMarkdown(`# S
## sc
* the value is "2"
`);
  const step = spec.scenarios[0].steps[0];
  expect(step.args).toEqual(["2"]);
  expect(step.template).toBe("the value is {}");
});

test("supports multiple args in one step", () => {
  const spec = parseMarkdown(`# S
## sc
* transfer "100" from "alice" to "bob"
`);
  const step = spec.scenarios[0].steps[0];
  expect(step.args).toEqual(["100", "alice", "bob"]);
  expect(step.template).toBe("transfer {} from {} to {}");
});

test("attaches an indented table to its step", () => {
  const spec = parseMarkdown(`# S
## sc
* add each row
    | n |
    |---|
    | 4 |
    | 6 |
* the result is "10"
`);
  const [withTable, afterTable] = spec.scenarios[0].steps;
  expect(withTable.table).not.toBeNull();
  expect(withTable.table?.headers).toEqual(["n"]);
  expect(withTable.table?.rows).toEqual([{ n: "4" }, { n: "6" }]);
  // The table must not bleed into the following step.
  expect(afterTable.table).toBeNull();
});

test("a scenario without a tag has tag null", () => {
  const spec = parseMarkdown(`# S
## no tag here
* noop
`);
  expect(spec.scenarios[0].tag).toBeNull();
});

test("ignores prose and deeper headings", () => {
  const spec = parseMarkdown(`# S

Some explanatory prose that should be ignored.

### a sub-heading, not a scenario

## real scenario
* noop
`);
  expect(spec.scenarios).toHaveLength(1);
  expect(spec.scenarios[0].title).toBe("real scenario");
});
