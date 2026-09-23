# Todo concepts

Concepts are the suite's vocabulary: one sentence a spec can say in place of a
sequence of steps. They live in Markdown rather than in TypeScript because they
are part of what a reviewer reads, not part of the test code.

A concept file is shaped like a spec file — `#` is its title, and each `##`
heading is one concept. Parameters are written as quoted placeholders,
`"<title>"`, so a spec calls a concept exactly the way it calls any other step.

## add the todos "<first>" and "<second>"

* add a todo "<first>"
* add a todo "<second>"

## the app shows "<total>" todos with "<active>" active

* the total count is "<total>"
* the active count is "<active>"

## start with two todos

Concepts compose: this one calls the two above it, so a spec can open a scenario
with a single sentence.

* add the todos "Buy milk" and "Write tests"
* the app shows "2" todos with "2" active
