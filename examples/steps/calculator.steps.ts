import { step, expect } from "playwright-md";

step("the value is {}", ({ world, args }) => {
  world.value = Number(args[0]);
});

step("add {}", ({ world, args }) => {
  world.value = (world.value as number) + Number(args[0]);
});

step("subtract {}", ({ world, args }) => {
  world.value = (world.value as number) - Number(args[0]);
});

step("add each row", ({ world, table }) => {
  for (const row of table?.rows ?? []) {
    world.value = (world.value as number) + Number(row.n);
  }
});

step("the result is {}", ({ world, args }) => {
  expect(world.value).toBe(Number(args[0]));
});
