import { defineMarkdownSpecs } from "markspec";
import "./steps/calculator.steps";

// Point at the Markdown specs. Playwright collects this file, which turns every
// scenario in ./specs into a real test.
defineMarkdownSpecs(new URL("./specs", import.meta.url).pathname);
