import fs from "node:fs";
import path from "node:path";

/**
 * What marks a Markdown file as a concept file rather than a spec.
 *
 * A file's role is carried by its own name, the way Gauge distinguishes `.spec`
 * from `.cpt`, so concepts are added by dropping a file next to the specs — no
 * registration call, and no dependence on which directory it happens to sit in.
 * The trailing `.md` keeps editors, linters and Markdown tooling working.
 */
export const CONCEPT_SUFFIX = ".cpt.md";

/** Whether a path names a concept file. */
export function isConceptFile(file: string): boolean {
  return file.endsWith(CONCEPT_SUFFIX);
}

/**
 * Collect `.md` files from a target that is either a single file, a directory
 * (searched recursively), or an explicit list of paths.
 */
export function collectMarkdownFiles(target: string | string[]): string[] {
  if (Array.isArray(target)) {
    return target.map((t) => path.resolve(t));
  }
  const resolved = path.resolve(target);
  if (fs.statSync(resolved).isFile()) {
    return [resolved];
  }
  return walk(resolved).sort();
}

/**
 * Split a target's Markdown files by role, so `defineSpecs` can load a tree's
 * concepts before resolving the specs that call them.
 */
export function partitionMarkdownFiles(target: string | string[]): {
  concepts: string[];
  specs: string[];
} {
  const files = collectMarkdownFiles(target);
  return {
    concepts: files.filter(isConceptFile),
    specs: files.filter((f) => !isConceptFile(f)),
  };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}
