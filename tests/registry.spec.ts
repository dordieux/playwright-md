import { test, expect } from "@playwright/test";
import { parseMarkdown } from "../src/parser.js";
import { step, findStep, resetSteps, suggestStep } from "../src/registry.js";

test.beforeEach(() => resetSteps());

test("binds a template step and passes its quoted args", () => {
  const seen: string[][] = [];
  step("the value is {}", ({ args }) => {
    seen.push(args);
  });

  const s = parseMarkdown(`# S
## sc
* the value is "42"
`).scenarios[0].steps[0];

  const match = findStep(s);
  expect(match).not.toBeNull();
  match!.fn({
    world: {},
    args: match!.args,
    table: null,
    text: s.text,
    request: {} as never,
  });
  expect(seen).toEqual([["42"]]);
});

test("binds a RegExp step with capture groups as args", () => {
  step(/^wait (\d+) seconds$/, () => {});
  const s = parseMarkdown(`# S
## sc
* wait 5 seconds
`).scenarios[0].steps[0];

  const match = findStep(s);
  expect(match).not.toBeNull();
  expect(match!.args).toEqual(["5"]);
});

test("returns null when no definition matches", () => {
  step("known step", () => {});
  const s = parseMarkdown(`# S
## sc
* unknown step
`).scenarios[0].steps[0];

  expect(findStep(s)).toBeNull();
});

test("suggests the closest step for a near miss", () => {
  step("the value is {}", () => {});
  step("the result is {}", () => {});
  // A small typo in "result" should point back to the right template.
  expect(suggestStep("the reslt is {}")).toBe("the result is {}");
});

test("suggests nothing when no step is close", () => {
  step("the value is {}", () => {});
  expect(suggestStep("navigate to the dashboard")).toBeNull();
});
