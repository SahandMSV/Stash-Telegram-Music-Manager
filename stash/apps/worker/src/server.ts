import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { config } from "./config.js";
import { getHealth } from "./health-state.js";
import {
  verifyPin,
  generateAndStorePin,
  hasPin,
  resetPin,
} from "./pin-store.js";

function isLocalhost(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress ?? "";
  return (
    remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1"
  );
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((res, rej) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => res(data));
    req.on("error", rej);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = req.url ?? "";

  if (req.method === "GET" && url === "/health") {
    json(res, 200, getHealth());
    return;
  }

  if (req.method === "POST" && url === "/internal/verify-pin") {
    const body = await readBody(req);
    const { pin } = JSON.parse(body) as { pin: string };
    json(res, 200, { valid: verifyPin(pin) });
    return;
  }

  if (req.method === "POST" && url === "/internal/generate-pin") {
    if (!isLocalhost(req)) {
      json(res, 403, { error: "localhost only" });
      return;
    }
    if (hasPin()) {
      json(res, 409, { error: "pin already exists, use reset" });
      return;
    }
    const pin = generateAndStorePin();
    json(res, 200, { pin });
    return;
  }

  if (req.method === "POST" && url === "/internal/reset-pin") {
    if (!isLocalhost(req)) {
      json(res, 403, { error: "localhost only" });
      return;
    }
    const pin = resetPin();
    json(res, 200, { pin });
    return;
  }

  json(res, 404, { error: "not found" });
}

export function startServer(): void {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      json(res, 500, { error: String(err) });
    });
  });
  server.listen(config.workerPort, () => {
    console.log(`[worker] internal API listening on :${config.workerPort}`);
  });
}
