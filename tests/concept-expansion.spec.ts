import { test, expect } from "@playwright/test";
import { ConceptRegistry, parseConcepts } from "../src/concepts.js";
import { resolveSteps, type PreparedStep } from "../src/generate.js";
import { parseMarkdown } from "../src/parser.js";
import { StepRegistry } from "../src/registry.js";

/** Resolve a spec's only scenario against the given steps and concepts. */
function resolve(
  specMd: string,
  conceptMd: string,
  define: (registry: StepRegistry) => void,
): { plan: PreparedStep[]; fixtures: string[] } {
  const steps = new StepRegistry();
  define(steps);

  const concepts = new ConceptRegistry();
  for (const concept of parseConcepts(conceptMd, "concepts.md")) {
    concepts.add(concept);
  }

  const fixtures = new Set<string>();
  const plan = resolveSteps(
    parseMarkdown(specMd, "spec.md").scenarios[0].steps,
    "spec.md",
    steps,
    concepts,
    fixtures,
    [],
  );
  return { plan, fixtures: [...fixtures].sort() };
}

const noop = ({ args }: { args: string[] }) => void args;

test("expands a concept into its body steps", () => {
  const { plan } = resolve(
    `# S
## sc
* log in as "park"
`,
    `## log in as "<user>"

* open "/login"
* type "<user>" into "#username"
`,
    (r) => {
      r.add("open {}", noop);
      r.add("type {} into {}", noop);
    },
  );

  expect(plan).toHaveLength(1);
  const concept = plan[0];
  expect(concept.kind).toBe("concept");
  if (concept.kind !== "concept") return;

  // The call site keeps the spec's own text and location; the body carries the
  // substituted arguments and points at the concept file.
  expect(concept.step.text).toBe('log in as "park"');
  expect(concept.file).toBe("spec.md");
  expect(concept.children.map((c) => c.step.text)).toEqual([
    'open "/login"',
    'type "park" into "#username"',
  ]);
  expect(concept.children.every((c) => c.file === "concepts.md")).toBe(true);
});

test("collects fixtures from steps reached through a concept", () => {
  const { fixtures } = resolve(
    `# S
## sc
* log in as "park"
`,
    `## log in as "<user>"

* type "<user>" into "#username"
`,
    (r) => {
      r.add("type {} into {}", ({ page, args }: { page: unknown; args: string[] }) => {
        void page;
        void args;
      });
    },
  );

  // A scenario whose only step is a concept still starts a browser, because a
  // step inside the concept asks for `page`.
  expect(fixtures).toEqual(["page"]);
});

test("expands a concept nested inside another concept", () => {
  const { plan } = resolve(
    `# S
## sc
* set up "park"
`,
    `## set up "<user>"

* log in as "<user>"
* open "/dashboard"

## log in as "<user>"

* type "<user>" into "#username"
`,
    (r) => {
      r.add("open {}", noop);
      r.add("type {} into {}", noop);
    },
  );

  const outer = plan[0];
  expect(outer.kind).toBe("concept");
  if (outer.kind !== "concept") return;

  const inner = outer.children[0];
  expect(inner.kind).toBe("concept");
  if (inner.kind !== "concept") return;

  // The argument flows down through both levels.
  expect(inner.step.text).toBe('log in as "park"');
  expect(inner.children[0].step.text).toBe('type "park" into "#username"');
  expect(outer.children[1].step.text).toBe('open "/dashboard"');
});

test("reports a recursive concept instead of expanding forever", () => {
  const { plan } = resolve(
    `# S
## sc
* set up "park"
`,
    `## set up "<user>"

* log in as "<user>"

## log in as "<user>"

* set up "<user>"
`,
    () => {},
  );

  const outer = plan[0];
  expect(outer.kind).toBe("concept");
  if (outer.kind !== "concept") return;
  const inner = outer.children[0];
  expect(inner.kind).toBe("concept");
  if (inner.kind !== "concept") return;

  expect(inner.children[0]).toMatchObject({ kind: "error" });
  expect((inner.children[0] as { message: string }).message).toMatch(
    /is recursive/,
  );
});

test("reports a step matched by both a concept and a step definition", () => {
  const { plan } = resolve(
    `# S
## sc
* log in as "park"
`,
    `## log in as "<user>"

* type "<user>" into "#username"
`,
    (r) => {
      r.add("type {} into {}", noop);
      r.add("log in as {}", noop);
    },
  );

  expect(plan[0]).toMatchObject({ kind: "error" });
  expect((plan[0] as { message: string }).message).toMatch(
    /matches both a concept .* and a step definition/s,
  );
});

test("reports an unmatched step inside a concept against the concept file", () => {
  const { plan } = resolve(
    `# S
## sc
* log in as "park"
`,
    `## log in as "<user>"

* type "<user>" into "#username"
`,
    () => {},
  );

  const concept = plan[0];
  expect(concept.kind).toBe("concept");
  if (concept.kind !== "concept") return;

  expect(concept.children[0]).toMatchObject({ kind: "error" });
  expect((concept.children[0] as { message: string }).message).toContain(
    "concepts.md:3",
  );
});

test("a spec step with no concept and no definition still reports normally", () => {
  const { plan } = resolve(
    `# S
## sc
* something unknown
`,
    `## log out

* click "Sign out"
`,
    (r) => {
      r.add("click {}", noop);
    },
  );

  expect(plan[0]).toMatchObject({ kind: "error" });
  expect((plan[0] as { message: string }).message).toMatch(
    /No step definition matches/,
  );
});
