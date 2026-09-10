# Contributing

Thanks for your interest in playwright-md! It's an early project, so issues,
discussion, and PRs are all welcome.

## Development

```bash
pnpm install
pnpm test        # runs the example specs + parser/registry unit tests
pnpm typecheck   # type-checks the whole project
pnpm build       # emits dist/ (what gets published)
```

The suite runs through Playwright itself:

- `examples/` — Markdown specs turned into tests (the end-to-end proof).
- `tests/` — plain unit tests for the parser and registry.

Neither launches a browser, so `pnpm test` needs no browser download.

## Guidelines

- Keep the core (`src/`) dependency-free. The only peer dependency is
  `@playwright/test`.
- Add or update a test for any behavior change. Prefer a parser/registry unit
  test for logic, and an example scenario when it demonstrates real usage.
- Run `pnpm typecheck` and `pnpm test` before opening a PR.
- Keep commits small and focused, with a clear message describing the change.

## Reporting bugs

Open an issue with a minimal spec + step definition that reproduces the problem,
and what you expected to happen.
