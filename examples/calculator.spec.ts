import { defineSpecs } from "./fixtures.js";
import "./steps/calculator.steps.js";

// These steps never destructure `page`, so no browser is started for them.
defineSpecs(new URL("./specs", import.meta.url).pathname);
