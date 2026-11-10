import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
const root = path.resolve("out");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};
http
  .createServer(async (req, res) => {
    try {
      const u = new URL(req.url, "http://localhost");
      let file = path.resolve(root, "." + decodeURIComponent(u.pathname));
      if (!file.startsWith(root + path.sep) && file !== root) {
        res.writeHead(403).end();
        return;
      }
      if ((await stat(file)).isDirectory())
        file = path.join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(3000, "127.0.0.1", () => console.log("한 획: http://127.0.0.1:3000"));
