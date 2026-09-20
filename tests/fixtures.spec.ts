import { test, expect } from "@playwright/test";
import { requestedFixtures, destructuredNames } from "../src/fixtures.js";

test("reads the names a callback destructures", () => {
  const fn = ({ page, db, args }: { page: unknown; db: unknown; args: string[] }) => {
    void page;
    void db;
    void args;
  };
  expect(destructuredNames(fn)).toEqual(["page", "db", "args"]);
});

test("step data names are not treated as fixtures", () => {
  const fn = ({ db, args, table, text }: Record<string, unknown>) => {
    void db;
    void args;
    void table;
    void text;
  };
  expect(requestedFixtures(fn)).toEqual(["db"]);
});

test("handles renaming and defaults in the pattern", () => {
  const fn = ({ db: database, args = [] }: { db?: unknown; args?: string[] }) => {
    void database;
    void args;
  };
  // The fixture name is the key, not the local alias.
  expect(requestedFixtures(fn)).toEqual(["db"]);
});

test("an async callback is read the same way", () => {
  const fn = async ({ request, args }: { request: unknown; args: string[] }) => {
    void request;
    void args;
  };
  expect(requestedFixtures(fn)).toEqual(["request"]);
});

test("a callback with no fixtures requests none", () => {
  const fn = ({ args }: { args: string[] }) => void args;
  expect(requestedFixtures(fn)).toEqual([]);
});

test("rejects a callback that does not destructure", () => {
  const fn = (ctx: unknown) => void ctx;
  expect(() => requestedFixtures(fn)).toThrow(/must destructure its first argument/);
});

test("rejects a rest element, which hides the fixture names", () => {
  const fn = ({ args, ...rest }: Record<string, unknown>) => {
    void args;
    void rest;
  };
  expect(() => requestedFixtures(fn)).toThrow(/rest element/);
});
