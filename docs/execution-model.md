# Execution model

How a Markdown spec becomes Playwright tests, and why it is built this way.

## The shape

```
defineSpecs(dir)
  ├─ for each *.cpt.md: parse `##` headings into concepts (template, params, body)
  └─ for each other .md: parse into a Spec (title, background, scenarios, line numbers)
      └─ for each scenario, once per data-table row:
          ├─ resolve every step — a concept expands into its body, recursively
          ├─ union the fixtures every reached step destructures
          ├─ build a test body whose parameter names exactly that union
          └─ test(title, { tag, annotation: "file.md:line" }, body)
```

Everything happens at collection time, inside the `*.spec.ts` that Playwright
already loads. There is no code generation step and no generated files.

## Why the test body is built at runtime

Playwright decides which fixtures to create by **reading the destructuring
pattern of the test function** — it parses the function's source. A fixed
signature would therefore have to name every fixture any step might use, which
would create all of them for every scenario. That is not a theoretical concern:
requesting `page` starts a browser.

So the signature is generated per scenario from the fixtures its own steps ask
for:

```js
// for a scenario whose steps destructure `db` and `args`
async function ({ db }) { return run({ db }); }
```

A scenario whose steps never name `page` produces a body that never names it
either, so no browser is started. The wrapper is cached per fixture set, so the
function is built once per distinct shape rather than once per scenario.

## Why steps declare fixtures by destructuring

A step callback is read the same way Playwright reads a test function:

```ts
step("the page shows {}", async ({ page, args }) => { ... });
//                                 ^^^^ fixture   ^^^^ step data
```

`args`, `table` and `text` are supplied by playwright-md; every other name is a
fixture to request. Deriving the list from the callback means there is no
separate declaration to keep in sync — the dependency is stated once, where it
is used.

This inherits Playwright's constraint: the first parameter must be an object
pattern, and a rest element (`{ ...rest }`) hides the names. Both cases throw at
registration with an explanatory message rather than failing mysteriously later.

## Why concepts are Markdown, and expanded at collection time

A concept names a sequence of steps. It could have been a TypeScript helper that
calls other steps, but a concept is part of what a reviewer reads — "log in as a
trader" is a sentence in the spec's vocabulary, not a function in the test code.
Keeping it in Markdown means the vocabulary stays reviewable by the same people
who review the specs.

That also means adding one should not require touching TypeScript at all, so a
file's role is carried by its own name — `*.cpt.md` — the way Gauge separates
`.spec` from `.cpt`. `defineSpecs` walks its tree once and loads the concept
files before the specs. The alternative, a directory convention, would make a
file's meaning depend on where it was moved to; `defineConcepts` remains for the
one case the name cannot express, a concept tree shared by several suites.

Expansion happens while the plan is being built, not while the test runs, which
is what lets a concept participate in everything else:

- **Fixtures.** The union is collected over the whole expanded tree, so a
  scenario whose only step is a concept still starts a browser when a step
  *inside* that concept asks for `page`. The rule stays "only what is used".
- **Diagnostics.** A missing step definition inside a concept is reported
  against the concept file and line, and a recursive concept is caught with the
  chain that closed the loop rather than overflowing the stack.
- **Reports.** A concept becomes a parent `test.step` whose children are its
  body, so the run shows the sentence the spec wrote *and* what it stood for —
  and a failure inside one points at the concept's own line.

Concepts take precedence over step definitions, and a step matched by both is
reported rather than silently resolved — the same rule the step registry applies
within itself.

## Why a data table only counts when it is referenced

Gauge multiplies a scenario across the rows of a table written above it. Taken
literally that makes any table in that position load-bearing, and specs use
tables to *explain themselves* — "these are the fixture rows this spec assumes".
Silently running such a spec three times is the worst kind of change: it still
passes.

So a table drives execution only when some step refers to one of its columns,
which is also what Gauge does in practice — verified by running the two shapes
through Gauge itself. The check is per scenario, so in one spec the scenario
that reads a column is multiplied and its neighbour that does not is run once.

The other half of the rule is that `<column>` must resolve: a reference no table
satisfies is an error, not literal text. Between them, neither a table nor a
reference can be silently ignored.

## Why step hooks are tag-restricted

A hook's fixtures have to join the scenario's union — it runs in the same test,
so whatever it destructures must exist. Left there, one `afterStep` asking for
`page` would start a browser for every scenario in the suite, quietly undoing
the property that a logic-only spec is browser-free.

`tags` is the answer, and it is Gauge's too: a hook applies only to scenarios
carrying all of its tags, so only those scenarios pull in its fixtures. The rule
stays "only what is used", with the hook's own scope as part of what is used.

Hooks wrap the steps that actually execute, not the concept sentences that led
to them — which is what Gauge does, verified against it.

## Why teardown steps exist next to fixtures

A fixture's code after `use()` already runs on failure, with scoping a spec
cannot express, so teardown steps are not the mechanism a suite should reach for
first. They exist because cleanup is sometimes part of what the spec *says* —
"cancel every open order" belongs in the spec a trader reads, not only in the
TypeScript. Anything a reader need not see belongs in a fixture.

The failure rule follows from that: teardown runs whatever the scenario did, but
its own failure is raised only when the scenario passed. Otherwise a broken
cleanup would replace the reason the scenario failed with a consequence of it.

## Why there is no `world`

Gauge-style suites keep per-scenario state in a mutable global that every step
shares. Fixtures already express this, with real scoping and types: a
test-scoped fixture is per scenario, a worker-scoped one is per worker.

That scoping is also what makes parallel runs against stateful backends work. A
suite that gives each worker its own database and its own mock server can run
its scenarios concurrently without any coordination, because there is nothing
shared to coordinate over.

## Source locations

A generated test's location is the line inside this library that called
`test()`, which is useless to a spec author. Each scenario therefore carries its
`.md` path and line as a `spec` annotation, which the bundled reporter uses to
point at the Markdown, and which the built-in reporters and traces also surface.

Emitting real `.spec.ts` files would give true locations and editor gutter
integration. That is a deliberate future option, not a lost cause — it trades
the current "no build step" property for tooling, and can be added alongside
this path rather than replacing it.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `files` | Which `.md` files a target holds, and which of them are concept files. |
| `parser` | Markdown → `Spec` (scenarios, background, steps, tables, line numbers). Owns the dialect. |
| `special-params` | `<file:…>` and `<table:…>`: reading them from disk, and parsing CSV. |
| `hooks` | Step hooks: their fixtures and the tags that restrict them. One registry per `createSpecs`. |
| `params` | `<name>` references: which a step makes, and substituting values into one. Shared by concepts and data tables. |
| `concepts` | Markdown → concepts; binding by template; argument substitution into a body. One registry per `createSpecs`. |
| `registry` | Step definitions and matching; template `{}` or RegExp; "did you mean" suggestions. One instance per `createSpecs`. |
| `fixtures` | Reads a callback's destructuring pattern and separates fixtures from step data. |
| `generate` | Spec × registry × concepts → Playwright tests, including the per-scenario signature. |
| `reporter` | Spec-grouped output, failing step, `.md` location, collection errors. |
| `create` | Binds the above to a caller's `test` and returns `{ step, defineConcepts, defineSpecs }`. |

`createSpecs` owning the registry is what keeps module-level mutable state out
of the library: two suites in one process have two registries.
