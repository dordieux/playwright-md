# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-09-20

The execution model is now Playwright's. The Markdown dialect is unchanged, so
specs port as they are; the TypeScript API is not.

### Changed

- **Steps take fixtures.** A step destructures what it needs, exactly like a
  Playwright test: `step("...", async ({ page, db, args }) => ...)`. Alongside
  your fixtures it still receives `args`, `table` and `text`.
- **`createSpecs(test)` replaces the package-level `step` / `defineMarkdownSpecs`.**
  Extend Playwright's `test` with your resources, then
  `export const { step, defineSpecs } = createSpecs(test)`. The step registry
  belongs to that instance rather than to the module.
- **`{ browser: true }` is gone.** Only the fixtures a scenario's steps name are
  created, so a spec whose steps never mention `page` never starts a browser —
  automatically, and with no flag to drift out of sync.
- **`world` is gone.** Per-scenario scratch state is a test-scoped fixture you
  define; per-worker resources are worker-scoped fixtures, which is what lets a
  suite against a stateful backend run in parallel.

### Added

- `docs/execution-model.md` explaining how specs become tests and why the test
  body is built per scenario.

## [0.2.1] - 2026-09-20

### Changed

- The reporter now prints each scenario as it finishes instead of buffering
  everything until the end, so a long suite shows progress. Found while running
  a 148-scenario suite that sat silent for four minutes. Failures are recapped
  before the summary.

## [0.2.0] - 2026-09-20

### Changed

- **Only `*` marks a step.** `-` bullets are now prose, matching Gauge. Found by
  running an existing Gauge spec unmodified: its explanatory `-` list was being
  parsed as steps. If you wrote steps with `-`, change them to `*`.

## [0.1.1] - 2026-09-20

### Added

- `defineMarkdownSpecs(target, { parallel: false })` runs a spec's scenarios one
  at a time in a single worker, for specs whose scenarios share one stateful
  backend (a database, a mock server) and reset it on entry.

### Fixed

- Documented that the Quickstart project must be ESM (`type: module`), since the
  examples use `import.meta.url` — a fresh `npm init -y` project failed to load
  the spec otherwise.
- `reporter: [["playwright-md/reporter"]]` failed to resolve with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`, because the export map only declared an
  `import` condition while Playwright resolves reporters through CommonJS
  resolution. Both entry points now also declare a `default` condition.
- Added a `./package.json` entry to `exports`, so tools that read the package's
  own `package.json` no longer hit `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- Stopped shipping source maps that pointed at `src/` (absent from the published
  package), which made test locations resolve to a non-existent file.

## [0.1.0] - 2026-09-19

### Added

- Initial proof of concept: parse Markdown specs, generate Playwright tests,
  bind steps (template `{}` or RegExp), per-scenario `world` fixture, indented
  data tables, and the ` -- tag` scenario-tag convention.
- `defineMarkdownSpecs(target, { browser: true })` provides Playwright's `page`
  to steps (as `ctx.page`) for browser-driving specs, while pure-logic specs
  stay browser-free.
- `ctx.request` (Playwright's HTTP client) is available to every step for API
  testing, with a self-contained mock-API example (`examples/api` +
  `examples/mock-server`).
- Background steps: steps written before the first `##` scenario run before
  every scenario, so shared setup (open the app, reset the API) lives in one
  place.
- Source locations: the parser records line numbers, and each generated scenario
  carries its `.md` file and line as a `spec` annotation, so reports and traces
  point back at the Markdown instead of the generator. Step-not-found errors now
  include the `.md` file and line.
- A `playwright-md/reporter` that renders runs grouped by spec, with the exact
  failing Markdown step and its `.md` location on failure.
- Step-not-found errors suggest the closest registered step ("Did you mean …").

### Fixed

- CI: pin the package manager (`packageManager` field) so `pnpm/action-setup`
  resolves a version, and install the Chromium browser before running tests.
