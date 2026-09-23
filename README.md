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

## Concepts: one sentence for a sequence of steps

A browser spec repeats itself — log in, navigate, fill the same form. A
**concept** gives that sequence a name the spec can say instead. Concepts live
in Markdown, because they are part of the vocabulary a reviewer reads rather
than part of the test code.

Adding one is dropping a `*.cpt.md` file next to your specs. There is nothing
to register: `defineSpecs` loads the concept files it finds in the tree before
the specs that call them.

A concept file is shaped like a spec file: `#` is its title, each `##` heading
is one concept, and parameters are quoted placeholders.

```markdown
<!-- specs/auth.cpt.md -->
# Authentication

## log in as "<user>"

* open "/login"
* type "<user>" into "#username"
* click "Sign in"
```

The spec beside it calls that concept exactly like any other step:

```markdown
## a trader sees their positions

* log in as "trader@example.com"
* the page shows "Positions"
```

Concepts compose — a concept's body may call another concept — and they are
resolved while Playwright collects tests, which is what keeps everything else
working through them:

- **Fixtures still follow use.** A scenario whose only step is a concept starts
  a browser when a step *inside* that concept asks for `page`, and not otherwise.
- **Reports nest.** A concept is a parent step whose children are its body, so a
  failure points at the line inside the concept file, with the arguments already
  substituted.
- **Mistakes are caught early.** A parameter the body never uses, a literal
  quoted value in a heading, a concept defined twice, a recursive concept, and a
  sentence matched by both a concept and a step definition are all reported when
  the file is loaded.

Concepts take precedence over step definitions, so a concept cannot be silently
shadowed by one.

For concepts kept outside the spec tree — a directory shared by several suites —
load them explicitly, before `defineSpecs`:

```ts
defineConcepts(new URL("../shared/concepts", import.meta.url).pathname);
defineSpecs(new URL("./specs", import.meta.url).pathname);
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

A file named `*.cpt.md` is a **concept** file rather than a spec: `#` is its
title and each `##` heading is a concept whose parameters are written `"<name>"`.

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

## Troubleshooting

**`Test has unknown parameter "x"`, pointing inside `playwright-md`.** A step
destructured a fixture your `test` does not define. Playwright resolves fixtures
before the test body runs, so the failure surfaces at the generated call rather
than at the step — search your step definitions for `x` and either define that
fixture or fix the name.

**`a step is already defined for ...`.** Two definitions share a pattern, so one
of them could never run. Remove or rename one.

**`"..." matches 2 step definitions`.** A spec step matches more than one
pattern — typically a literal template and a RegExp that both cover it. Which
one would run depends on registration order, so make the patterns distinct.

**`declares "<x>" but never uses it`.** A concept's heading takes a parameter its
body never mentions — usually a typo on one side or the other.

**A concept is not recognized and the step is reported as unmatched.** Check the
file is named `*.cpt.md` and sits inside the tree `defineSpecs` was given. If it
lives elsewhere, `defineConcepts` has to load it *before* `defineSpecs` — specs
are resolved as they are collected, so concepts loaded afterwards are too late.

**A `.md` edit is not picked up.** Specs are read when Playwright collects
tests, so re-running picks up edits with no build step. Playwright's watch and
`--only-changed` follow the TypeScript module graph, which a `.md` is not part
of, so those will not notice a spec-only change.

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
