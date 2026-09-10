# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Fixed

- CI: pin the package manager (`packageManager` field) so `pnpm/action-setup`
  resolves a version, and install the Chromium browser before running tests.
