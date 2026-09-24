import { test, expect } from "@playwright/test";
import { parseMarkdown } from "../src/parser.js";

test("a `Tags:` line under the spec heading is the spec's", () => {
  const spec = parseMarkdown(`# Spec
Tags: smoke, slow

## scenario

* do something
`);

  expect(spec.tags).toEqual(["smoke", "slow"]);
  expect(spec.scenarios[0].tags).toEqual([]);
});

test("a `Tags:` line under a scenario heading is that scenario's", () => {
  const spec = parseMarkdown(`# Spec
Tags: shared

## first
Tags: smoke

* do something

## second

* do something
`);

  expect(spec.tags).toEqual(["shared"]);
  expect(spec.scenarios[0].tags).toEqual(["smoke"]);
  expect(spec.scenarios[1].tags).toEqual([]);
});

test("the `-- tag` suffix stays separate from `Tags:`", () => {
  const spec = parseMarkdown(`# Spec
Tags: shared

## scenario -- basic
Tags: smoke

* do something
`);

  expect(spec.scenarios[0].tag).toBe("basic");
  expect(spec.scenarios[0].tags).toEqual(["smoke"]);
});

test("tags are trimmed, and empty entries dropped", () => {
  const spec = parseMarkdown(`# Spec
Tags:  a ,, b ,

## scenario

* do something
`);
  expect(spec.tags).toEqual(["a", "b"]);
});

test("`Tags:` is recognized whatever its case, and after prose", () => {
  const spec = parseMarkdown(`# Spec

Some prose.

tags: a

## scenario

* do something
`);
  expect(spec.tags).toEqual(["a"]);
});

test("a spec with no `Tags:` line has none", () => {
  const spec = parseMarkdown(`# Spec

## scenario

* do something
`);
  expect(spec.tags).toEqual([]);
  expect(spec.scenarios[0].tags).toEqual([]);
});
