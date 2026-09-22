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
import {
  getAuthStatus,
  startPhoneAuth,
  submitCode,
  submitPassword,
  logout,
} from "./telegram-client.js";

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
    json(res, 200, { ...getHealth(), auth: await getAuthStatus() });
    return;
  }

  if (req.method === "POST" && url === "/internal/verify-pin") {
    const body = await readBody(req);
    const { pin } = JSON.parse(body) as { pin: string };
    json(res, 200, { valid: await verifyPin(pin) });
    return;
  }

  if (req.method === "POST" && url === "/internal/generate-pin") {
    if (!isLocalhost(req)) {
      json(res, 403, { error: "localhost only" });
      return;
    }
    if (await hasPin()) {
      json(res, 409, { error: "pin already exists, use reset" });
      return;
    }
    const pin = await generateAndStorePin();
    json(res, 200, { pin });
    return;
  }

  if (req.method === "POST" && url === "/internal/reset-pin") {
    if (!isLocalhost(req)) {
      json(res, 403, { error: "localhost only" });
      return;
    }
    const pin = await resetPin();
    json(res, 200, { pin });
    return;
  }

  // Auth endpoints (localhost only)

  if (req.method === "GET" && url === "/internal/auth/status") {
    if (!isLocalhost(req)) {
      json(res, 403, { error: "localhost only" });
      return;
    }
    json(res, 200, await getAuthStatus());
    return;
  }

  if (req.method === "POST" && url === "/internal/auth/start") {
    if (!isLocalhost(req)) {
      json(res, 403, { error: "localhost only" });
      return;
    }
    try {
      const body = await readBody(req);
      const { phone } = JSON.parse(body) as { phone: string };
      const result = await startPhoneAuth(phone);
      json(res, 200, result);
    } catch (err) {
      json(res, 400, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (req.method === "POST" && url === "/internal/auth/code") {
    if (!isLocalhost(req)) {
      json(res, 403, { error: "localhost only" });
      return;
    }
    try {
      const body = await readBody(req);
      const { code } = JSON.parse(body) as { code: string };
      const result = await submitCode(code);
      json(res, 200, result);
    } catch (err) {
      json(res, 400, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (req.method === "POST" && url === "/internal/auth/password") {
    if (!isLocalhost(req)) {
      json(res, 403, { error: "localhost only" });
      return;
    }
    try {
      const body = await readBody(req);
      const { password } = JSON.parse(body) as { password: string };
      const result = await submitPassword(password);
      json(res, 200, result);
    } catch (err) {
      json(res, 400, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (req.method === "POST" && url === "/internal/auth/logout") {
    if (!isLocalhost(req)) {
      json(res, 403, { error: "localhost only" });
      return;
    }
    try {
      await logout();
      json(res, 200, { ok: true });
    } catch (err) {
      json(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
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
