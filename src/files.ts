import fs from "node:fs";
import path from "node:path";

/**
 * Collect `.md` spec files from a target that is either a single `.md` file, a
 * directory (searched recursively), or an explicit list of paths.
 */
export function collectSpecFiles(target: string | string[]): string[] {
  if (Array.isArray(target)) {
    return target.map((t) => path.resolve(t));
  }
  const resolved = path.resolve(target);
  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return [resolved];
  }
  return walk(resolved).sort();
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
