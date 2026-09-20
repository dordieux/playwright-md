import { expect } from "@playwright/test";
import { step } from "../fixtures.js";

step("the value is {}", ({ total, args }) => {
  total.value = Number(args[0]);
});

step("add {}", ({ total, args }) => {
  total.value += Number(args[0]);
});

step("subtract {}", ({ total, args }) => {
  total.value -= Number(args[0]);
});

step("add each row", ({ total, table }) => {
  for (const row of table?.rows ?? []) {
    total.value += Number(row.n);
  }
});

step("the result is {}", ({ total, args }) => {
  expect(total.value).toBe(Number(args[0]));
});
