import { defineMarkdownSpecs } from "playwright-md";
import "./steps/todo.steps";

// `browser: true` provides Playwright's `page` to steps (as ctx.page) and runs
// each scenario in a real browser.
defineMarkdownSpecs(new URL("./browser", import.meta.url).pathname, {
  browser: true,
});
