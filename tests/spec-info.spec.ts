import { test, expect } from "@playwright/test";
import path from "node:path";
import { specInfo } from "../src/spec-info.js";

function fakeTestInfo(annotations: { type: string; description?: string }[], tags: string[]) {
  return { annotations, tags, title: "a scenario" } as never;
}

test("reads the spec file, line and tag a scenario came from", () => {
  const info = specInfo(
    fakeTestInfo([{ type: "spec", description: "specs/batch/invoice.md:12" }], ["@basic"]),
  );
  expect(info).not.toBeNull();
  expect(info!.file).toBe(path.resolve(process.cwd(), "specs/batch/invoice.md"));
  expect(info!.line).toBe(12);
  expect(info!.tag).toBe("basic");
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
