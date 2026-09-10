# markspec

Write [Playwright](https://playwright.dev) tests as readable **Markdown specs**.

markspec is a thin, Gauge-flavored spec layer on top of the Playwright test
runner. You keep everything that makes Playwright great — fixtures, parallelism,
tracing, the HTML reporter, the VS Code extension — and get to describe behavior
in plain Markdown that non-engineers can read and review.

```markdown
# Calculator

## adds two numbers -- smoke

* the value is "2"
* add "3"
* the result is "5"
```

```ts
// steps/calculator.steps.ts
import { step, expect } from "markspec";

step("the value is {}", ({ world, args }) => { world.value = Number(args[0]); });
step("add {}",          ({ world, args }) => { world.value = (world.value as number) + Number(args[0]); });
step("the result is {}",({ world, args }) => { expect(world.value).toBe(Number(args[0])); });
```

```ts
// calculator.spec.ts — Playwright collects this file
import { defineMarkdownSpecs } from "markspec";
import "./steps/calculator.steps";

defineMarkdownSpecs(new URL("./specs", import.meta.url).pathname);
```

```bash
npx playwright test
```

That's it — every `##` scenario is now a real Playwright test.

## Why

[Gauge](https://gauge.org) has a lovely idea: tests as Markdown. But it ships a
whole runtime — a separate process, a language-runner protocol, plugins, project
scaffolding — that you carry everywhere. Playwright already has a fast, modern
runner with first-class fixtures, tracing, and tooling. markspec keeps Gauge's
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
import { step } from "markspec";

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

Every step receives one `ctx` object: `{ world, args, table, text, page }`.

## Browser steps

Pure-logic specs never touch a browser. For specs that drive a real page, pass
`{ browser: true }` and Playwright's `page` arrives as `ctx.page`:

```ts
import { defineMarkdownSpecs } from "markspec";
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

## Status

Early proof of concept. The core (parse → generate → bind → run) works; the API
may still change. Feedback and issues welcome.

## License

[MIT](./LICENSE)
