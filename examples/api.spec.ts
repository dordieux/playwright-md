import { defineMarkdownSpecs } from "playwright-md";
import "./steps/todos-api.steps";

// API steps use ctx.request (Playwright's HTTP client) against the mock server
// started by playwright.config's `webServer`. No browser, no external services.
//
// parallel: false — every scenario resets the one shared mock server, so they
// must not run concurrently.
defineMarkdownSpecs(new URL("./api", import.meta.url).pathname, {
  parallel: false,
});
