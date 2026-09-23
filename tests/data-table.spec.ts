import { test, expect } from "@playwright/test";
import { parseMarkdown } from "../src/parser.js";

test("a table before the first step is the spec's data table", () => {
  const spec = parseMarkdown(`# Spec

| user | role  |
| ---- | ----- |
| a    | admin |
| b    | user  |

## scenario

* say hello to <user>
`);

  expect(spec.dataTable).toEqual({
    headers: ["user", "role"],
    rows: [
      { user: "a", role: "admin" },
      { user: "b", role: "user" },
    ],
  });
  expect(spec.scenarios[0].dataTable).toBeNull();
});

test("prose between the heading and the table does not matter", () => {
  const spec = parseMarkdown(`# Spec

Some prose first.

| user |
| ---- |
| a    |

## scenario

* say hello to <user>
`);

  expect(spec.dataTable?.rows).toEqual([{ user: "a" }]);
});

test("only the first table before the first scenario is taken", () => {
  const spec = parseMarkdown(`# Spec

| user |
| ---- |
| a    |

| other |
| ----- |
| x     |

## scenario

* say hello to <user>
`);

  expect(spec.dataTable?.headers).toEqual(["user"]);
});

test("a table under a scenario heading is that scenario's data table", () => {
  const spec = parseMarkdown(`# Spec

## scenario

| n |
| - |
| 1 |
| 2 |

* count to <n>
`);

  expect(spec.dataTable).toBeNull();
  expect(spec.scenarios[0].dataTable?.rows).toEqual([{ n: "1" }, { n: "2" }]);
});

test("a table under a step still belongs to that step", () => {
  const spec = parseMarkdown(`# Spec

## scenario

* seed the rows
    | n |
    | - |
    | 1 |
`);

  expect(spec.scenarios[0].dataTable).toBeNull();
  expect(spec.scenarios[0].steps[0].table?.rows).toEqual([{ n: "1" }]);
});

test("a table after a background step belongs to that step", () => {
  const spec = parseMarkdown(`# Spec

* seed the rows
    | n |
    | - |
    | 1 |

## scenario

* do something
`);

  expect(spec.dataTable).toBeNull();
  expect(spec.background[0].table?.rows).toEqual([{ n: "1" }]);
});
