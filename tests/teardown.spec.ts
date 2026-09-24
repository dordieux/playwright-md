import { test, expect } from "@playwright/test";
import { parseMarkdown } from "../src/parser.js";

test("steps after `___` are the spec's teardown", () => {
  const spec = parseMarkdown(`# Spec

## scenario

* do something

___

* clean up
* and again
`);

  expect(spec.scenarios[0].steps.map((s) => s.text)).toEqual(["do something"]);
  expect(spec.teardown.map((s) => s.text)).toEqual(["clean up", "and again"]);
});

test("a spec with no `___` has no teardown", () => {
  const spec = parseMarkdown(`# Spec

## scenario

* do something
`);
  expect(spec.teardown).toEqual([]);
});

test("a scenario after `___` is rejected", () => {
  expect(() =>
    parseMarkdown(
      `# Spec

## scenario

* do something

___

* clean up

## another scenario

* do something else
`,
      "spec.md",
    ),
  ).toThrow(/cannot follow the `___` teardown separator/);
});
