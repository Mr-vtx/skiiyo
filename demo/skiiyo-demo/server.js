"use strict";

import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = process.env.PORT || 5173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split("?")[0]);

  if (reqPath === "/config.js") {
    const config = `
window.SKIIYO_CONFIG = {
  API_BASE_URL: ${JSON.stringify(
    process.env.API_BASE_URL || "http://localhost:8000/api/v1",
  )},
  GOOGLE_CLIENT_ID: ${JSON.stringify(process.env.GOOGLE_CLIENT_ID || "")},
  API_KEY: ${JSON.stringify(process.env.API_KEY || "")}
};
`;

    res.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    });

    return res.end(config);
  }

  if (reqPath === "/") {
    reqPath = "/index.html";
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, {
        "Content-Type": "text/plain",
      });

      return res.end("Not found");
    }

    const ext = path.extname(filePath);

    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
    });

    res.end(content);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nSkiiyo console running on port ${PORT}\n`);
});
