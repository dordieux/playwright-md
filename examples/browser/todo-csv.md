# Todo app, from a CSV

A long fixture does not have to sit in the sentence: `<table:…>` reads a CSV
file into the step's data table, and `<file:…>` reads a file's contents into a
positional argument. Paths are relative to this spec.

* open the app

## adds every todo in the file

* add every todo <table:data/todos.csv>
* the total count is "3"
