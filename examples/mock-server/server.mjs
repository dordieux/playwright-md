// A tiny, dependency-free mock Todo API used by the API example specs.
// State lives in memory; POST /_reset clears it so each scenario starts clean.
import { createServer } from "node:http";

const port = Number(process.env.PORT) || 3210;

let todos = [];
let nextId = 1;

const server = createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };

  const readBody = () =>
    new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve(null);
        }
      });
    });

  if (req.method === "POST" && req.url === "/_reset") {
    todos = [];
    nextId = 1;
    return send(200, { ok: true });
  }

  if (req.method === "GET" && req.url === "/todos") {
    return send(200, todos);
  }

  if (req.method === "POST" && req.url === "/todos") {
    return readBody().then((body) => {
      const title = body && typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return send(400, { error: "title is required" });
      const todo = { id: nextId++, title, done: false };
      todos.push(todo);
      return send(201, todo);
    });
  }

  const complete = req.url.match(/^\/todos\/(\d+)\/complete$/);
  if (req.method === "POST" && complete) {
    const todo = todos.find((t) => t.id === Number(complete[1]));
    if (!todo) return send(404, { error: "not found" });
    todo.done = true;
    return send(200, todo);
  }

  send(404, { error: "not found" });
});

server.listen(port, () => {
  console.log(`mock todo api listening on http://localhost:${port}`);
});
