import { test, expect } from "@playwright/test";
import { HookRegistry } from "../src/hooks.js";

const noop = () => {};

test("a hook with no tags applies to every scenario", () => {
  const hooks = new HookRegistry();
  hooks.add("before", noop);

  expect(hooks.select("before", new Set())).toHaveLength(1);
  expect(hooks.select("before", new Set(["smoke"]))).toHaveLength(1);
});

test("a tagged hook applies only to scenarios carrying every tag", () => {
  const hooks = new HookRegistry();
  hooks.add("after", noop, { tags: ["browser", "slow"] });

  expect(hooks.select("after", new Set(["browser"]))).toHaveLength(0);
  expect(hooks.select("after", new Set(["browser", "slow"]))).toHaveLength(1);
  expect(hooks.select("after", new Set(["browser", "slow", "x"]))).toHaveLength(1);
});

test("before and after hooks are selected separately", () => {
  const hooks = new HookRegistry();
  hooks.add("before", noop);
  hooks.add("after", noop);

  expect(hooks.select("before", new Set())).toHaveLength(1);
  expect(hooks.select("after", new Set())).toHaveLength(1);
});

test("a hook's fixtures are read from its destructuring, minus its own data", () => {
  const hooks = new HookRegistry();
  hooks.add("after", ({ page, db, text, args, table, error }: Record<string, unknown>) => {
    void [page, db, text, args, table, error];
  });

  // text/args/table/error are supplied by playwright-md, not fixtures.
  expect(hooks.select("after", new Set())[0].fixtures).toEqual(["page", "db"]);
});

test("registries are independent", () => {
  const a = new HookRegistry();
  const b = new HookRegistry();
  a.add("before", noop);

  expect(a.size).toBe(1);
  expect(b.size).toBe(0);
});
