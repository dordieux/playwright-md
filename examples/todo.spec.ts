import { defineSpecs } from "./fixtures.js";
import "./steps/todo.steps.js";

// No `browser` flag: these steps destructure `page`, so Playwright starts a
// browser for them and for nothing else.
defineSpecs(new URL("./browser", import.meta.url).pathname);
