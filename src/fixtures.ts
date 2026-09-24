/**
 * Step data that playwright-md supplies itself. Every other name a step
 * destructures is treated as a Playwright fixture to request.
 */
export const STEP_DATA_NAMES = ["args", "table", "text"] as const;

const stepDataNames: ReadonlySet<string> = new Set(STEP_DATA_NAMES);

/**
 * The fixture names a step callback asks for.
 *
 * Playwright decides which fixtures to build by reading the destructuring
 * pattern of a test function; playwright-md reads step callbacks the same way,
 * so a step declares its dependencies exactly like a Playwright test does:
 *
 * ```ts
 * step("the page shows {}", async ({ page, args }) => { ... });
 * //                                 ^^^^ requested fixture
 * ```
 *
 * Because the request is per step, a scenario only pulls in what its own steps
 * use — a spec whose steps never mention `page` never starts a browser.
 */
export function requestedFixtures(
  fn: (...args: never[]) => unknown,
  reserved: readonly string[] = STEP_DATA_NAMES,
): string[] {
  const supplied = reserved === STEP_DATA_NAMES ? stepDataNames : new Set(reserved);
  return destructuredNames(fn).filter((name) => !supplied.has(name));
}

/**
 * Parse the names bound by the first parameter's object pattern.
 *
 * A callback that takes no parameter at all asks for nothing, the way a
 * Playwright test with no parameter does. Anything else must be an object
 * pattern, mirroring Playwright's own constraint ("First argument must use the
 * object destructuring pattern"): without a pattern there is no way to know
 * what the step needs.
 */
export function destructuredNames(fn: (...args: never[]) => unknown): string[] {
  const source = fn.toString();
  if (takesNoParameter(source)) return [];

  const pattern = objectPatternSource(source);
  if (pattern === null) {
    throw new Error(
      "a step callback must destructure its first argument, e.g. " +
        "step(\"...\", async ({ page, args }) => { ... }). " +
        "Playwright reads the destructuring pattern to decide which fixtures to " +
        `create, so it cannot be a plain parameter or a rest element.\n  got: ${firstLine(source)}`,
    );
  }

  const names: string[] = [];
  for (const part of splitTopLevel(pattern)) {
    const entry = part.trim();
    if (entry === "") continue;
    if (entry.startsWith("...")) {
      throw new Error(
        "a step callback cannot use a rest element in its destructuring pattern: " +
          "the fixtures it needs must be named explicitly.\n  got: " +
          firstLine(source),
      );
    }
    // `name`, `name: alias`, `name = default`, `name: alias = default`.
    const name = entry.split(":")[0].split("=")[0].trim();
    if (name !== "") names.push(name);
  }
  return names;
}

/** Whether the callback's parameter list is empty. */
function takesNoParameter(source: string): boolean {
  const open = source.indexOf("(");
  if (open === -1) return false;
  let i = open + 1;
  while (i < source.length && /\s/.test(source[i])) i++;
  return source[i] === ")";
}

/** The text between the braces of the first parameter's object pattern. */
function objectPatternSource(source: string): string | null {
  const open = source.indexOf("(");
  if (open === -1) return null;

  let i = open + 1;
  while (i < source.length && /\s/.test(source[i])) i++;
  if (source[i] !== "{") return null;

  let depth = 0;
  for (let j = i; j < source.length; j++) {
    const ch = source[j];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(i + 1, j);
    }
  }
  return null;
}

/** Split on commas that are not nested inside braces, brackets or parens. */
function splitTopLevel(pattern: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "{" || ch === "[" || ch === "(") depth++;
    else if (ch === "}" || ch === "]" || ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(pattern.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(pattern.slice(start));
  return parts;
}

function firstLine(source: string): string {
  const line = source.split("\n")[0];
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}
