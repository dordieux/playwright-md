import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { parseMarkdown } from "../src/parser.js";
import { parseCsv, resolveSpecialParams } from "../src/special-params.js";

// Paths resolve relative to the spec file, so pretend the spec sits in tests/.
const SPEC = path.join(path.dirname(fileURLToPath(import.meta.url)), "spec.md");

function firstStep(md: string) {
  return parseMarkdown(md).scenarios[0].steps[0];
}

function resolve(stepText: string) {
  return resolveSpecialParams(
    firstStep(`# S\n## sc\n* ${stepText}\n`),
    SPEC,
  );
}

test("<file:…> becomes a positional argument holding the contents", () => {
  const step = resolve("show <file:data/note.txt>");

  expect(step.template).toBe("show {}");
  expect(step.args).toEqual(["hello from a file\nsecond line\n"]);
  // The sentence keeps the reference, so reports stay readable.
  expect(step.text).toBe("show <file:data/note.txt>");
});

test("<file:…> takes its position among the other quoted arguments", () => {
  const step = resolve('send "POST" with <file:data/note.txt> to "/api"');

  expect(step.template).toBe("send {} with {} to {}");
  expect(step.args).toEqual([
    "POST",
    "hello from a file\nsecond line\n",
    "/api",
  ]);
});

test("<table:…> becomes the step's data table and no argument", () => {
  const step = resolve("show the people <table:data/people.csv>");

  expect(step.template).toBe("show the people");
  expect(step.args).toEqual([]);
  expect(step.table).toEqual({
    headers: ["user", "role"],
    rows: [
      { user: "a", role: "admin" },
      { user: "b", role: "user" },
    ],
  });
});

test("a step with no special parameter is returned unchanged", () => {
  const step = firstStep(`# S\n## sc\n* the value is "2"\n`);
  expect(resolveSpecialParams(step, SPEC)).toBe(step);
});

test("a missing file is reported with the step's location", () => {
  expect(() => resolve("show <file:data/nope.txt>")).toThrow(
    /cannot read "data\/nope\.txt"/,
  );
});

test("a step cannot have two tables", () => {
  const step = parseMarkdown(`# S
## sc
* show <table:data/people.csv>
    | n |
    | - |
    | 1 |
`).scenarios[0].steps[0];

  expect(() => resolveSpecialParams(step, SPEC)).toThrow(/more than one table/);
});

test("CSV quoting: embedded commas, quotes and newlines", () => {
  expect(parseCsv(`name,note\n"Smith, John","says ""hi"""\n"multi\nline",plain\n`)).toEqual({
    headers: ["name", "note"],
    rows: [
      { name: "Smith, John", note: 'says "hi"' },
      { name: "multi\nline", note: "plain" },
    ],
  });
});

test("CSV: a short row fills the missing columns with empty strings", () => {
  expect(parseCsv("a,b,c\n1,2\n").rows).toEqual([{ a: "1", b: "2", c: "" }]);
});

test("CSV: an empty file is rejected", () => {
  expect(() => parseCsv("", "x.csv")).toThrow(/needs a header row/);
});
