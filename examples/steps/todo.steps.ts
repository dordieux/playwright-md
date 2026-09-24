import { expect } from "@playwright/test";
import { step } from "../fixtures.js";

const APP_URL = new URL("../app/index.html", import.meta.url).href;

// These steps destructure `page`, which is what makes their scenarios start a
// browser. Specs whose steps never name it stay browser-free.
step("open the app", async ({ page }) => {
  await page.goto(APP_URL);
});

step("add a todo {}", async ({ page, args }) => {
  await page.fill("#new-todo", args[0]);
  await page.click("#new-form button");
});

step("complete the todo {}", async ({ page, args }) => {
  await page.locator(`li[data-title="${args[0]}"] input[type="checkbox"]`).check();
});

step("the total count is {}", async ({ page, args }) => {
  await expect(page.locator("#total")).toHaveText(args[0]);
});

step("the active count is {}", async ({ page, args }) => {
  await expect(page.locator("#active")).toHaveText(args[0]);
});

// `<table:…>` reads a CSV file into the step's data table, exactly as an
// indented Markdown table would.
step("add every todo", async ({ page, table }) => {
  for (const row of table!.rows) {
    await page.fill("#new-todo", row.title);
    await page.click("#new-form button");
  }
});
