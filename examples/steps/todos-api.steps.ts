import { expect } from "@playwright/test";
import { step } from "../fixtures.js";

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

step("the todo API is empty", async ({ request }) => {
  const res = await request.post("/_reset");
  expect(res.ok()).toBeTruthy();
});

step("create a todo {}", async ({ request, lastStatus, args }) => {
  const res = await request.post("/todos", { data: { title: args[0] } });
  lastStatus.code = res.status();
});

step("complete the last created todo", async ({ request, lastStatus }) => {
  const list = (await (await request.get("/todos")).json()) as Todo[];
  const res = await request.post(`/todos/${list[list.length - 1]?.id}/complete`);
  lastStatus.code = res.status();
});

step("the response status is {}", ({ lastStatus, args }) => {
  expect(lastStatus.code).toBe(Number(args[0]));
});

step("the todo list has {} items", async ({ request, args }) => {
  const list = (await (await request.get("/todos")).json()) as Todo[];
  expect(list).toHaveLength(Number(args[0]));
});

step("the todo list has {} completed", async ({ request, args }) => {
  const list = (await (await request.get("/todos")).json()) as Todo[];
  expect(list.filter((t) => t.done)).toHaveLength(Number(args[0]));
});
