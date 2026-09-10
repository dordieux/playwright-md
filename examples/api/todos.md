# Todo API

Exercises a JSON HTTP API through playwright-md steps, using Playwright's `request`
client. The API is a local, in-memory mock (examples/mock-server), so the tests
depend on nothing external. Each scenario resets the API first, so its own steps
alone define the state it asserts on.

## creates and lists todos -- api

* the todo API is empty
* create a todo "Buy milk"
* the response status is "201"
* create a todo "Write tests"
* the todo list has "2" items

## rejects a todo with an empty title

* the todo API is empty
* create a todo ""
* the response status is "400"
* the todo list has "0" items

## completes a todo

* the todo API is empty
* create a todo "Buy milk"
* complete the last created todo
* the response status is "200"
* the todo list has "1" completed
