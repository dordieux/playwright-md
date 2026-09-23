import { test, expect } from "@playwright/test";
import { dataRows, titleFor } from "../src/generate.js";
import { parseMarkdown } from "../src/parser.js";

/** The rows the spec's only scenario would run for, as plain objects. */
function rowsFor(md: string, index = 0) {
  const spec = parseMarkdown(md, "spec.md");
  return dataRows(spec, spec.scenarios[index]).map((r) =>
    r === null ? null : Object.fromEntries(r),
  );
}

test("a table nothing refers to is documentation, not a data table", () => {
  // The exact shape a spec uses to explain its fixture data. Treating it as a
  // data table would silently run every scenario three times.
  expect(
    rowsFor(`# Spec

| id | party | can issue |
| -- | ----- | --------- |
| 1  | A     | yes       |
| 2  | B     | yes       |
| 3  | C     | no        |

## scenario

* do something
`),
  ).toEqual([null]);
});

test("a referenced column makes the scenario run once per row", () => {
  expect(
    rowsFor(`# Spec

| user | role  |
| ---- | ----- |
| a    | admin |
| b    | user  |

## scenario

* say hello to <user>
`),
  ).toEqual([
    { user: "a", role: "admin" },
    { user: "b", role: "user" },
  ]);
});

test("only the scenarios that refer to the column multiply", () => {
  const md = `# Spec

| user |
| ---- |
| a    |
| b    |

## refers to it

* say hello to <user>

## does not

* say hello
`;
  expect(rowsFor(md, 0)).toHaveLength(2);
  expect(rowsFor(md, 1)).toEqual([null]);
});

test("a reference from a background step drives the scenario too", () => {
  expect(
    rowsFor(`# Spec

| user |
| ---- |
| a    |
| b    |

* log in as <user>

## scenario

* do something
`),
  ).toHaveLength(2);
});

test("a reference inside a step's own table counts", () => {
  expect(
    rowsFor(`# Spec

| user |
| ---- |
| a    |
| b    |

## scenario

* seed
    | who     |
    | ------- |
    | <user>  |
`),
  ).toHaveLength(2);
});

test("spec and scenario tables nest", () => {
  expect(
    rowsFor(`# Spec

| user |
| ---- |
| a    |
| b    |

## scenario

| n |
| - |
| 1 |
| 2 |
| 3 |

* say hello to <user>
* count to <n>
`),
  ).toEqual([
    { user: "a", n: "1" },
    { user: "a", n: "2" },
    { user: "a", n: "3" },
    { user: "b", n: "1" },
    { user: "b", n: "2" },
    { user: "b", n: "3" },
  ]);
});

test("a scenario table alone drives that scenario", () => {
  expect(
    rowsFor(`# Spec

## scenario

| n |
| - |
| 1 |
| 2 |

* count to <n>
`),
  ).toEqual([{ n: "1" }, { n: "2" }]);
});

test("the scenario's column wins a clash with the spec's", () => {
  expect(
    rowsFor(`# Spec

| n |
| - |
| 1 |

## scenario

| n |
| - |
| 9 |

* count to <n>
`),
  ).toEqual([{ n: "9" }]);
});

test("row values are appended to the title so tests stay distinct", () => {
  expect(titleFor("adds a todo", new Map([["user", "a"], ["role", "admin"]]))).toBe(
    "adds a todo [user: a, role: admin]",
  );
  expect(titleFor("adds a todo", null)).toBe("adds a todo");
});
