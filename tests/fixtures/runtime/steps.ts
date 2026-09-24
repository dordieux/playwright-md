import { step, beforeStep, afterStep, log } from "./fixtures.js";

beforeStep(({ text }) => {
  log.push(`before:${text}`);
});

afterStep(({ text, error }) => {
  log.push(`after:${text}${error ? "!" : ""}`);
});

// Tag-restricted, and no scenario here carries @never, so it must never run.
beforeStep(() => {
  log.push("never-tagged");
}, { tags: ["never"] });

step("note {}", ({ record, args }) => {
  record(args[0]);
});

step("fail", () => {
  throw new Error("boom");
});
