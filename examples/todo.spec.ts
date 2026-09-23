import { defineConcepts, defineSpecs } from "./fixtures.js";
import "./steps/todo.steps.js";

// Concepts are loaded before the specs that call them: specs are resolved as
// Playwright collects them.
defineConcepts(new URL("./concepts", import.meta.url).pathname);

// No `browser` flag: these steps destructure `page`, so Playwright starts a
// browser for them and for nothing else — including the steps a concept
// expands into.
defineSpecs(new URL("./browser", import.meta.url).pathname);
