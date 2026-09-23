# Todo app

Drives a real page in a real browser through playwright-md steps. The same Markdown
spec style as the pure-logic examples — only the step definitions differ, using
Playwright's `page`.

The background step opens a fresh page before every scenario.

* open the app

## adds todos and tracks the active count -- e2e

* add a todo "Buy milk"
* add a todo "Write tests"
* the total count is "2"
* the active count is "2"

## completing a todo decreases the active count

The first two sentences are concepts (see `examples/concepts/todo.md`): each
stands for a pair of steps, and the second concept is itself built from two
others.

* start with two todos
* complete the todo "Buy milk"
* the app shows "2" todos with "1" active

## empty input does not add a todo

* add a todo ""
* the total count is "0"
