import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectAllProvidersSnapshot } from "./collector.js";
import { loadMonitorConfig, sanitizeProvider } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const publicDir = path.join(projectRoot, "public");
const port = Number(process.env.USAGE_MONITOR_PORT) || 4173;

let cache = {
  snapshot: null,
  fetchedAt: 0
};

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendFile(response, filePath) {
  if (!fs.existsSync(filePath)) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const extension = path.extname(filePath);
  response.writeHead(200, {
    "Content-Type": contentTypes[extension] ?? "application/octet-stream"
  });
  response.end(fs.readFileSync(filePath));
}

function getPublicFilePath(requestPath) {
  if (requestPath === "/") {
    return path.join(publicDir, "index.html");
  }

  const relativePath = path.normalize(requestPath).replace(/^(\.\.[\\/])+/, "").replace(/^[/\\]+/, "");
  return path.join(publicDir, relativePath);
}

async function getSnapshot(forceRefresh = false) {
  const config = loadMonitorConfig(projectRoot);
  const ttl = config.pollingIntervalMs;

  if (!forceRefresh && cache.snapshot && Date.now() - cache.fetchedAt < ttl) {
    return cache.snapshot;
  }

  const snapshot = await collectAllProvidersSnapshot(config);
  cache = {
    snapshot,
    fetchedAt: Date.now()
  };

  return snapshot;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (requestUrl.pathname === "/api/providers") {
    const config = loadMonitorConfig(projectRoot);
    sendJson(response, 200, {
      pollingIntervalMs: config.pollingIntervalMs,
      configPath: config.configPath,
      candidatePaths: config.candidatePaths,
      providers: config.providers.map((provider) => sanitizeProvider(provider))
    });
    return;
  }

  if (requestUrl.pathname === "/api/snapshot") {
    try {
      const forceRefresh = requestUrl.searchParams.get("refresh") === "1";
      const snapshot = await getSnapshot(forceRefresh);
      sendJson(response, 200, snapshot);
    } catch (error) {
      sendJson(response, 500, {
        error: "无法生成监控快照",
        details: error.message
      });
    }
    return;
  }

  if (requestUrl.pathname === "/api/config-example") {
    sendFile(response, path.join(projectRoot, "config", "providers.example.json"));
    return;
  }

  sendFile(response, getPublicFilePath(requestUrl.pathname));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`usage-monitor-web listening on http://127.0.0.1:${port}`);
});
