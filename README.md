# playwright-md

[![CI](https://github.com/dordieux/playwright-md/actions/workflows/ci.yml/badge.svg)](https://github.com/dordieux/playwright-md/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/playwright-md.svg)](https://www.npmjs.com/package/playwright-md)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Write [Playwright](https://playwright.dev) tests as readable **Markdown specs**.

Specs are Markdown that non-engineers can read and review. Steps are ordinary
Playwright code: they take fixtures, so the resources a suite needs — a browser,
an HTTP client, a database, a mock server — are declared and scoped the way
Playwright already does it.

## Quickstart

```bash
npm init -y
npm pkg set type=module          # the examples use ESM (import.meta.url)
npm i -D playwright-md @playwright/test
```

```ts
// fixtures.ts — bind playwright-md to your `test`
import { test as base } from "@playwright/test";
import { createSpecs } from "playwright-md";

export const test = base.extend<{ total: { value: number } }>({
  total: async ({}, use) => {
    await use({ value: 0 });
  },
});

export const { step, defineSpecs } = createSpecs(test);
```

```ts
// steps/calculator.steps.ts — a step destructures what it needs
import { expect } from "@playwright/test";
import { step } from "../fixtures.js";

step("the value is {}", ({ total, args }) => { total.value = Number(args[0]); });
step("add {}",          ({ total, args }) => { total.value += Number(args[0]); });
step("the result is {}",({ total, args }) => { expect(total.value).toBe(Number(args[0])); });
```

```markdown
<!-- specs/calculator.md -->
# Calculator

## adds two numbers -- smoke

* the value is "2"
* add "3"
* the result is "5"
```

```ts
// calculator.spec.ts — Playwright collects this file
import { defineSpecs } from "./fixtures.js";
import "./steps/calculator.steps.js";

defineSpecs(new URL("./specs", import.meta.url).pathname);
```

```bash
npx playwright test
```

Every `##` scenario is now a real Playwright test. For output grouped by spec —
and, on failure, the exact Markdown step and its `.md` line — add the reporter:

```ts
// playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [["playwright-md/reporter"]],
});
```

> **Note:** the examples use `import.meta.url`, so the project must be ESM — set
> `"type": "module"` in `package.json`. In a CommonJS project, use `__dirname`.

## Steps take fixtures

A step declares its dependencies by destructuring, exactly like a Playwright
test. Alongside your fixtures it receives the step's own data: `args` (the
double-quoted values), `table`, and `text`.

```ts
step("the page shows {}", async ({ page, args }) => {
  await expect(page.getByRole("heading")).toHaveText(args[0]);
});

step("the API has {} todos", async ({ request, args }) => {
  const todos = await (await request.get("/todos")).json();
  expect(todos).toHaveLength(Number(args[0]));
});
```

**Only the fixtures a scenario's steps actually name are created.** A spec whose
steps never mention `page` never starts a browser — there is no flag to set, and
no way for the two to drift apart.

Steps can also be registered with a RegExp, whose capture groups become `args`:

```ts
step(/^wait (\d+) seconds$/, async ({ args }) => { ... });
```

## Running against a stateful backend, in parallel

This is what fixtures buy you. Scenarios that share one database cannot run
concurrently — but scenarios that each have *their own* can. Make the resource
**worker-scoped** and every Playwright worker gets its own:

```ts
export const test = base.extend<{}, { db: Database; wiremock: WireMock }>({
  db: [async ({}, use, workerInfo) => {
    const db = await connect(`app_w${workerInfo.parallelIndex}`);
    await use(db);
    await db.end();
  }, { scope: "worker" }],

  wiremock: [async ({}, use, workerInfo) => {
    await use(new WireMock(50051 + workerInfo.parallelIndex));
  }, { scope: "worker" }],
});
```

Steps then just ask for them, and isolation is a property of the setup rather
than something each suite re-implements:

```ts
step("the table {} has {} rows", async ({ db, args }) => {
  expect(await db.count(args[0])).toBe(Number(args[1]));
});
```

Several resources of the same kind are no different — a suite that reads from
one database and writes to another declares `sourceDb` and `db` as two
fixtures.

If your scenarios genuinely share one backend that each of them resets, tell
playwright-md not to run them concurrently:

```ts
defineSpecs(specsDir, { parallel: false });
```

## Spec syntax

A small, Gauge-flavored subset of Markdown:

| Markdown | Meaning |
| --- | --- |
| `# Title` | Spec title (the Playwright `describe` block). |
| `## Scenario -- tag` | A scenario. The optional ` -- tag` becomes a Playwright tag (`@tag`). |
| `* step text with "args"` | A step. Double-quoted substrings are its positional arguments. Only `*` marks a step — `-` bullets are prose. |
| Steps before the first `##` | Background: they run before every scenario. |
| A Markdown table indented under a step | The step's data table (`ctx.table`). |

Anything else — prose, blank lines, deeper headings — is ignored, so a spec
doubles as documentation.

```markdown
# Todo API

* the API is empty        <!-- background: runs before each scenario below -->

## creates a todo
* create a todo "Buy milk"
* the todo list has "1" items
```

## Reports

The bundled reporter renders a run the way the specs read — grouped by spec, one
line per scenario as it finishes, and on failure the exact Markdown step plus a
link back to the `.md` file and line:

```
Todo API  examples/api/todos.md
  ✓ creates and lists todos (52ms)
  ✗ completes a todo (43ms)
      at step: the response status is "200"
      examples/api/todos.md:23
      Error: expect(received).toBe(expected)

✗ 2 passed, 1 failed  (2.4s)
```

Each step carries its own `.md` file and line, so the built-in `html` reporter
and the trace viewer link to the exact step too — not just to the scenario.

If your suite keeps fixtures in directories named after the spec and tag,
`specInfo(testInfo)` tells you which scenario is running:

```ts
import { specInfo } from "playwright-md";

scenario: async ({}, use, testInfo) => {
  const info = specInfo(testInfo)!;   // { file, line, tag }
  await use(resolveResources(info.file, info.tag));
},
```

## Why

[Gauge](https://gauge.org) has a lovely idea: tests as Markdown. But it ships a
whole runtime — a separate process, a language-runner protocol, plugins, project
scaffolding. Playwright already has a fast, modern runner with first-class
fixtures, tracing and tooling. playwright-md keeps the Markdown and drops the
rest by **compiling specs into Playwright tests** instead of running its own
engine.

The Markdown dialect stays close to Gauge's, so existing specs port with little
or no editing. The execution model does not: state lives in fixtures rather than
a global world object, and resource isolation is a scope you declare.

See [docs/execution-model.md](./docs/execution-model.md) for how the generation
works.

## License

[MIT](./LICENSE)
