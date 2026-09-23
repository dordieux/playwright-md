import { defineSpecs } from "./fixtures.js";
import "./steps/todo.steps.js";

// `examples/browser/` holds both the spec and a `.cpt.md` concept file; the
// concepts are picked up because they are there, with no call of their own.
//
// No `browser` flag either: these steps destructure `page`, so Playwright
// starts a browser for them and for nothing else — including the steps a
// concept expands into.
defineSpecs(new URL("./browser", import.meta.url).pathname);
