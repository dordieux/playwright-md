# Calculator

A tiny domain used to demonstrate playwright-md end to end: a running total you can
seed, add to, and assert on. No infrastructure — just enough to show that
Markdown scenarios become real Playwright tests.

## adds two numbers -- smoke

* the value is "2"
* add "3"
* the result is "5"

## sums a column of numbers

* the value is "0"
* add each row
    | n |
    |---|
    | 4 |
    | 6 |
* the result is "10"

## subtracts down to a negative

* the value is "3"
* subtract "10"
* the result is "-7"
