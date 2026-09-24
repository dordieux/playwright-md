import { test, expect } from "@playwright/test";
import path from "node:path";
import { specInfo } from "../src/spec-info.js";

function fakeTestInfo(annotations: { type: string; description?: string }[], tags: string[]) {
  return { annotations, tags, title: "a scenario" } as never;
}

test("reads the spec file, line and tag a scenario came from", () => {
  const info = specInfo(
    fakeTestInfo(
      [
        { type: "spec", description: "specs/batch/invoice.md:12" },
        { type: "spec-tag", description: "basic" },
      ],
      ["@basic"],
    ),
  );
  expect(info).not.toBeNull();
  expect(info!.file).toBe(path.resolve(process.cwd(), "specs/batch/invoice.md"));
  expect(info!.line).toBe(12);
  expect(info!.tag).toBe("basic");
});

test("`tag` is the `-- tag` suffix, not whichever tag comes first", () => {
  // A spec-level `Tags:` line also becomes a Playwright tag, and suites key
  // fixture directories off the heading suffix, so the two must not be mixed up.
  const info = specInfo(
    fakeTestInfo(
      [
        { type: "spec", description: "a.md:3" },
        { type: "spec-tag", description: "basic" },
      ],
      ["@smoke", "@slow", "@basic"],
    ),
  );
  expect(info!.tag).toBe("basic");
  expect(info!.tags).toEqual(["smoke", "slow", "basic"]);
});

test("a scenario with only inherited tags has no `-- tag`", () => {
  const info = specInfo(
    fakeTestInfo([{ type: "spec", description: "a.md:3" }], ["@smoke"]),
  );
  expect(info!.tag).toBeNull();
  expect(info!.tags).toEqual(["smoke"]);
});

test("a scenario without a tag reports null", () => {
  const info = specInfo(fakeTestInfo([{ type: "spec", description: "a.md:3" }], []));
  expect(info!.tag).toBeNull();
});

test("returns null for a test playwright-md did not generate", () => {
  expect(specInfo(fakeTestInfo([], []))).toBeNull();
  expect(specInfo(fakeTestInfo([{ type: "issue", description: "x" }], []))).toBeNull();
});

test("returns null when the annotation is malformed", () => {
  expect(specInfo(fakeTestInfo([{ type: "spec", description: "no-line" }], []))).toBeNull();
  expect(specInfo(fakeTestInfo([{ type: "spec", description: "a.md:nope" }], []))).toBeNull();
});
