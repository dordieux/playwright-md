# playwright-md

[![CI](https://github.com/dordieux/playwright-md/actions/workflows/ci.yml/badge.svg)](https://github.com/dordieux/playwright-md/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/playwright-md.svg)](https://www.npmjs.com/package/playwright-md)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Write [Playwright](https://playwright.dev) tests as readable **Markdown specs**.

playwright-md is a thin, Gauge-flavored spec layer on top of the Playwright test
runner. You keep everything that makes Playwright great — fixtures, parallelism,
tracing, the HTML reporter, the VS Code extension — and get to describe behavior
in plain Markdown that non-engineers can read and review.

## Quickstart

```bash
npm init -y
npm pkg set type=module          # the examples use ESM (import.meta.url)
npm i -D playwright-md @playwright/test
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
// steps/calculator.steps.ts
import { step, expect } from "playwright-md";

step("the value is {}", ({ world, args }) => { world.value = Number(args[0]); });
step("add {}",          ({ world, args }) => { world.value = (world.value as number) + Number(args[0]); });
step("the result is {}",({ world, args }) => { expect(world.value).toBe(Number(args[0])); });
```

```ts
// calculator.spec.ts — Playwright collects this file
import { defineMarkdownSpecs } from "playwright-md";
import "./steps/calculator.steps";

defineMarkdownSpecs(new URL("./specs", import.meta.url).pathname);
```

```bash
npx playwright test
```

That's it — every `##` scenario is now a real Playwright test. For output grouped
by spec (and, on failure, the exact Markdown step and its `.md` line), add the
reporter in a `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [["playwright-md/reporter"]],
});
```

> **Note:** the examples use `import.meta.url`, so the project must be ESM — set
> `"type": "module"` in `package.json` (the `npm pkg set type=module` above). In a
> CommonJS project, use `__dirname` instead.

## Why

[Gauge](https://gauge.org) has a lovely idea: tests as Markdown. But it ships a
whole runtime — a separate process, a language-runner protocol, plugins, project
scaffolding — that you carry everywhere. Playwright already has a fast, modern
runner with first-class fixtures, tracing, and tooling. playwright-md keeps Gauge's
Markdown expressiveness and drops the rest by **compiling specs into Playwright
tests** instead of running its own engine.

## How it works

`defineMarkdownSpecs()` runs at collection time inside a `*.spec.ts` file:

1. It reads your `.md` files and parses each `##` scenario into ordered steps.
2. For every scenario it emits a Playwright `test()`; every step runs inside a
   `test.step()`, so it appears individually in reports and traces.
3. Steps bind to definitions you registered with `step()`.
4. Each scenario gets a fresh `world` object (a Playwright fixture) for scratch
   state — so nothing leaks between scenarios, and there are no module globals.

Because tests are generated at collection time, the whole Playwright toolchain
(`--ui`, `--trace`, sharding, retries, reporters) works unchanged.

## Spec syntax

A small, Gauge-flavored subset of Markdown:

| Markdown | Meaning |
| --- | --- |
| `# Title` | Spec title (the Playwright `describe` block). |
| `## Scenario -- tag` | A scenario. The optional ` -- tag` becomes a Playwright tag (`@tag`). |
| `* step text with "args"` | A step. Double-quoted substrings are its positional arguments. |
| A Markdown table indented under a step | The step's data table (`ctx.table`). |

Anything else — prose, blank lines, deeper headings — is ignored, so a spec
doubles as documentation.

## Step definitions

```ts
import { step } from "playwright-md";

// Template form: write the sentence with {} at each argument slot.
step("transfer {} from {} to {}", ({ args }) => {
  const [amount, from, to] = args;
  // ...
});

// RegExp form: capture groups become args.
step(/^wait (\d+) seconds$/, async ({ args }) => {
  await new Promise((r) => setTimeout(r, Number(args[0]) * 1000));
});
```

Every step receives one `ctx` object: `{ world, args, table, text, request, page }`.

## Background steps

Steps written after the `#` title but before the first `##` scenario are
**background** steps — they run before every scenario, so shared setup lives in
one place:

```markdown
# Todo API

* the API is empty        <!-- background: runs before each scenario below -->

## creates a todo
* create a todo "Buy milk"
* the todo list has "1" items

## rejects an empty title
* create a todo ""
* the response status is "400"
```

## Browser steps

Pure-logic specs never touch a browser. For specs that drive a real page, pass
`{ browser: true }` and Playwright's `page` arrives as `ctx.page`:

```ts
import { defineMarkdownSpecs } from "playwright-md";
import "./steps/todo.steps";

defineMarkdownSpecs(new URL("./browser", import.meta.url).pathname, {
  browser: true,
});
```

```ts
step("add a todo {}", async ({ page, args }) => {
  await page!.fill("#new-todo", args[0]);
  await page!.click("#new-form button");
});
```

Browser and non-browser specs live happily in the same suite and run through the
same command — only the `browser`-flagged ones launch a browser.

## API steps

`ctx.request` is Playwright's HTTP client, always available (no browser). Set a
`baseURL` in your Playwright config to call relative paths, and — for a
self-contained suite — point `webServer` at a local mock so tests depend on
nothing external:

```ts
// playwright.config.ts
use: { baseURL: "http://localhost:3210" },
webServer: {
  command: "node examples/mock-server/server.mjs",
  url: "http://localhost:3210/todos",
},
```

```ts
step("create a todo {}", async ({ request, world, args }) => {
  const res = await request.post("/todos", { data: { title: args[0] } });
  world.lastStatus = res.status();
});
step("the response status is {}", ({ world, args }) => {
  expect(world.lastStatus).toBe(Number(args[0]));
});
```

When a spec's scenarios share one stateful backend and each resets it on entry,
tell playwright-md not to run them concurrently — otherwise a `fullyParallel`
config lets their resets race:

```ts
defineMarkdownSpecs(specsDir, { parallel: false });
```

See `examples/api` for the full mock-API example.

## Reports

playwright-md ships a reporter that renders a run the way the specs read —
grouped by spec, one line per scenario, and, on failure, the exact Markdown step
that failed plus a link back to the `.md` file and line:

```
Todo API  examples/api/todos.md
  ✓ creates and lists todos (52ms)
  ✗ completes a todo (43ms)
      at step: the response status is "200"
      examples/api/todos.md:23
      Error: expect(received).toBe(expected)

✗ 2 passed, 1 failed  (2.4s)
```

Enable it in your Playwright config:

```ts
reporter: [["playwright-md/reporter"]],
```

Every generated scenario also carries its `.md` location as a `spec` annotation,
so the built-in `html` reporter and traces point back at the Markdown too.

## Status

Early proof of concept. The core (parse → generate → bind → run) works; the API
may still change. Feedback and issues welcome.

## License

[MIT](./LICENSE)
