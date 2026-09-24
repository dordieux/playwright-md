import { requestedFixtures } from "./fixtures.js";

/**
 * Data a step hook receives on top of the fixtures it destructures.
 *
 * `error` is only ever set for an after-hook, and only when the step it ran
 * after threw.
 */
export const HOOK_DATA_NAMES = ["text", "args", "table", "error"] as const;

/** When a hook runs relative to the step. */
export type HookKind = "before" | "after";

/** Options for registering a step hook. */
export interface HookOptions {
  /**
   * Only run this hook for scenarios carrying all of these tags.
   *
   * This is also what keeps a hook from pulling its fixtures into every
   * scenario: a hook that asks for `page` and is tagged `browser` leaves the
   * logic-only specs browser-free.
   */
  tags?: string[];
}

/** A registered step hook. */
export interface Hook {
  kind: HookKind;
  fn: (ctx: never) => unknown;
  /** Playwright fixture names the callback destructures. */
  fixtures: string[];
  /** Tags a scenario must all carry for this hook to apply. */
  tags: string[];
}

/**
 * The step hooks a suite registers. Each `createSpecs()` owns one, next to its
 * step and concept registries.
 */
export class HookRegistry {
  private readonly hooks: Hook[] = [];

  add(kind: HookKind, fn: (ctx: never) => unknown, opts: HookOptions = {}): void {
    this.hooks.push({
      kind,
      fn,
      fixtures: requestedFixtures(fn, HOOK_DATA_NAMES),
      tags: opts.tags ?? [],
    });
  }

  /** The hooks of one kind that apply to a scenario carrying these tags. */
  select(kind: HookKind, tags: ReadonlySet<string>): Hook[] {
    return this.hooks.filter(
      (h) => h.kind === kind && h.tags.every((t) => tags.has(t)),
    );
  }

  /** The number of registered hooks (for diagnostics and tests). */
  get size(): number {
    return this.hooks.length;
  }
}
