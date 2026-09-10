import { defineMarkdownSpecs } from "markspec";
import "./steps/todos-api.steps";

// API steps use ctx.request (Playwright's HTTP client) against the mock server
// started by playwright.config's `webServer`. No browser, no external services.
defineMarkdownSpecs(new URL("./api", import.meta.url).pathname);
