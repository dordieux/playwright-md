# Todo app, data-driven

The table below makes every scenario that mentions one of its columns run once
per row. A table no step refers to is documentation, so a spec can explain
itself without multiplying its scenarios.

| first     | second       | total | active |
| --------- | ------------ | ----- | ------ |
| Buy milk  | Write tests  | 2     | 1      |
| Walk dog  | Read a book  | 2     | 1      |

* open the app

## completing the first todo leaves one active

* add the todos "<first>" and "<second>"
* complete the todo "<first>"
* the app shows "<total>" todos with "<active>" active

## a scenario that refers to no column runs once

* add a todo "Only once"
* the total count is "1"

## a scenario can carry its own table

| title      |
| ---------- |
| Buy milk   |
| Walk dog   |
| Read email |

* add a todo "<title>"
* the total count is "1"
