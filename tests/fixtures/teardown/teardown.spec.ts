import { defineSpecs } from "./fixtures.js";
import "./steps.js";

// Serial: the scenarios share the in-memory log they assert on.
defineSpecs(new URL("./specs", import.meta.url).pathname, { parallel: false });
