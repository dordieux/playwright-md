import { step, log } from "./fixtures.js";

step("note {}", ({ record, args }) => {
  record(args[0]);
});

step("fail", () => {
  throw new Error("boom");
});

step("the log so far is {}", ({ args }) => {
  if (log.join(",") !== args[0]) {
    throw new Error(`log is "${log.join(",")}", expected "${args[0]}"`);
  }
});
