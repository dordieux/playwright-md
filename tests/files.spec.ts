import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { ConceptRegistry } from "../src/concepts.js";
import {
  collectMarkdownFiles,
  isConceptFile,
  partitionMarkdownFiles,
} from "../src/files.js";

function tree(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "playwright-md-"));
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

const CONCEPT = `## log out

* click "Sign out"
`;

test("a .cpt.md file is a concept file, any other .md is a spec", () => {
  expect(isConceptFile("/specs/auth.cpt.md")).toBe(true);
  expect(isConceptFile("/specs/auth.md")).toBe(false);
  // Only the suffix decides, not the directory the file sits in.
  expect(isConceptFile("/concepts/auth.md")).toBe(false);
});

test("splits a tree into concepts and specs", () => {
  const dir = tree({
    "login.cpt.md": CONCEPT,
    "checkout.md": "# Checkout\n",
    "nested/deep.cpt.md": CONCEPT,
    "nested/deep.md": "# Deep\n",
    "notes.txt": "ignored",
  });

  const { concepts, specs } = partitionMarkdownFiles(dir);
  expect(concepts.map((f) => path.relative(dir, f)).sort()).toEqual([
    "login.cpt.md",
    path.join("nested", "deep.cpt.md"),
  ]);
  expect(specs.map((f) => path.relative(dir, f)).sort()).toEqual([
    "checkout.md",
    path.join("nested", "deep.md"),
  ]);
});

test("a single file target is returned as-is", () => {
  const dir = tree({ "login.cpt.md": CONCEPT });
  const file = path.join(dir, "login.cpt.md");

  expect(collectMarkdownFiles(file)).toEqual([file]);
  expect(partitionMarkdownFiles(file)).toEqual({ concepts: [file], specs: [] });
});

test("loading the same concept file twice is a no-op", () => {
  const dir = tree({ "login.cpt.md": CONCEPT });
  const file = path.join(dir, "login.cpt.md");
  const registry = new ConceptRegistry();

  registry.loadFile(file);
  registry.loadFile(file);

  // Without the guard the second load would be reported as a duplicate
  // definition — which is what an explicit defineConcepts plus the automatic
  // discovery in defineSpecs would otherwise produce.
  expect(registry.size).toBe(1);
});

test("two files defining the same concept are still reported", () => {
  const dir = tree({ "a.cpt.md": CONCEPT, "b.cpt.md": CONCEPT });
  const registry = new ConceptRegistry();

  registry.loadFile(path.join(dir, "a.cpt.md"));
  expect(() => registry.loadFile(path.join(dir, "b.cpt.md"))).toThrow(
    /already defined/,
  );
});
