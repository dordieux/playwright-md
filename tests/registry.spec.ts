import { test, expect } from "@playwright/test";
import { parseMarkdown } from "../src/parser.js";
import { StepRegistry } from "../src/registry.js";

function firstStep(md: string) {
  return parseMarkdown(md).scenarios[0].steps[0];
}

test("binds a template step and passes its quoted args", () => {
  const registry = new StepRegistry();
  const seen: string[][] = [];
  registry.add("the value is {}", ({ args }: { args: string[] }) => {
    seen.push(args);
  });

  const step = firstStep(`# S
## sc
* the value is "42"
`);
  const match = registry.find(step);
  expect(match).not.toBeNull();
  expect(match!.args).toEqual(["42"]);
});

test("binds a RegExp step with capture groups as args", () => {
  const registry = new StepRegistry();
  registry.add(/^wait (\d+) seconds$/, ({ args }: { args: string[] }) => void args);

  const match = registry.find(firstStep(`# S
## sc
* wait 5 seconds
`));
  expect(match).not.toBeNull();
  expect(match!.args).toEqual(["5"]);
});

test("returns null when no definition matches", () => {
  const registry = new StepRegistry();
  registry.add("known step", ({ args }: { args: string[] }) => void args);

  expect(registry.find(firstStep(`# S
## sc
* unknown step
`))).toBeNull();
});

test("records the fixtures a step destructures", () => {
  const registry = new StepRegistry();
  registry.add("open {}", ({ page, args }: { page: unknown; args: string[] }) => {
    void page;
    void args;
  });

  const match = registry.find(firstStep(`# S
## sc
* open "/home"
`));
  // `args` is step data, not a fixture, so only `page` is requested.
  expect(match!.definition.fixtures).toEqual(["page"]);
});

test("suggests the closest step for a near miss", () => {
  const registry = new StepRegistry();
  registry.add("the value is {}", ({ args }: { args: string[] }) => void args);
  registry.add("the result is {}", ({ args }: { args: string[] }) => void args);

  expect(registry.suggest("the reslt is {}")).toBe("the result is {}");
});

test("suggests nothing when no step is close", () => {
  const registry = new StepRegistry();
  registry.add("the value is {}", ({ args }: { args: string[] }) => void args);

  expect(registry.suggest("navigate to the dashboard")).toBeNull();
});

test("registries are independent", () => {
  const a = new StepRegistry();
  const b = new StepRegistry();
  a.add("only in a", ({ args }: { args: string[] }) => void args);

  expect(a.size).toBe(1);
  expect(b.size).toBe(0);
});
