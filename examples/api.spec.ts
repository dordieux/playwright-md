import { defineSpecs } from "./fixtures.js";
import "./steps/todos-api.steps.js";

// These scenarios share one mock server that each of them resets, so they must
// not run concurrently. With a worker-scoped mock instead, this would not be
// needed — see the README.
defineSpecs(new URL("./api", import.meta.url).pathname, { parallel: false });
