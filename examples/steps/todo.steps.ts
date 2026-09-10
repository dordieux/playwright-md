import { step, expect } from "playwright-md";

const APP_URL = new URL("../app/index.html", import.meta.url).href;

step("open the app", async ({ page }) => {
  await page!.goto(APP_URL);
});

step("add a todo {}", async ({ page, args }) => {
  await page!.fill("#new-todo", args[0]);
  await page!.click("#new-form button");
});

step("complete the todo {}", async ({ page, args }) => {
  await page!
    .locator(`li[data-title="${args[0]}"] input[type="checkbox"]`)
    .check();
});

step("the total count is {}", async ({ page, args }) => {
  await expect(page!.locator("#total")).toHaveText(args[0]);
});

step("the active count is {}", async ({ page, args }) => {
  await expect(page!.locator("#active")).toHaveText(args[0]);
});
