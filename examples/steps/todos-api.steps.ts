import { step, expect } from "markspec";

interface Todo {
  id: number;
  title: string;
  done: boolean;
}

step("the todo API is empty", async ({ request }) => {
  const res = await request.post("/_reset");
  expect(res.ok()).toBeTruthy();
});

step("create a todo {}", async ({ request, world, args }) => {
  const res = await request.post("/todos", { data: { title: args[0] } });
  world.lastStatus = res.status();
  if (res.ok()) {
    world.lastId = ((await res.json()) as Todo).id;
  }
});

step("complete the last created todo", async ({ request, world }) => {
  const res = await request.post(`/todos/${world.lastId}/complete`);
  world.lastStatus = res.status();
});

step("the response status is {}", ({ world, args }) => {
  expect(world.lastStatus).toBe(Number(args[0]));
});

step("the todo list has {} items", async ({ request, args }) => {
  const list = (await (await request.get("/todos")).json()) as Todo[];
  expect(list).toHaveLength(Number(args[0]));
});

step("the todo list has {} completed", async ({ request, args }) => {
  const list = (await (await request.get("/todos")).json()) as Todo[];
  expect(list.filter((t) => t.done)).toHaveLength(Number(args[0]));
});
