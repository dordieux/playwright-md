# Todo app

Drives a real page in a real browser through playwright-md steps. The same Markdown
spec style as the pure-logic examples — only the step definitions differ, using
Playwright's `page`.

## adds todos and tracks the active count -- e2e

* open the app
* add a todo "Buy milk"
* add a todo "Write tests"
* the total count is "2"
* the active count is "2"

## completing a todo decreases the active count

* open the app
* add a todo "Buy milk"
* add a todo "Write tests"
* complete the todo "Buy milk"
* the total count is "2"
* the active count is "1"

## empty input does not add a todo

* open the app
* add a todo ""
* the total count is "0"
