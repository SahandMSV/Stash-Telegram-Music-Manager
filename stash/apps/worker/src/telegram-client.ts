import { TelegramClient } from "teleproto";
// @ts-expect-error teleproto subpath types resolve after pnpm install; runtime export is correct
import { StringSession } from "teleproto/sessions";
import { config } from "./config.js";
import {
  hasSession,
  loadSessionString,
  saveSessionString,
  clearSession,
  loadBinding,
  saveBinding,
  type AccountBinding,
} from "./session-store.js";
import { setTelegramConnected } from "./health-state.js";
import { hasPin, generateAndStorePin } from "./pin-store.js";

type AuthPhase =
  | "idle"
  | "awaiting_code"
  | "awaiting_password"
  | "connecting"
  | "connected"
  | "error";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const MAX_AUTH_ATTEMPTS = 5;

let client: TelegramClient | null = null;
let pendingClient: TelegramClient | null = null;
let phase: AuthPhase = "idle";
let lastError: string | null = null;
let codeDeferred: Deferred<string> | null = null;
let passwordDeferred: Deferred<string> | null = null;
let startPromise: Promise<void> | null = null;
let floodUntil = 0;
let authGeneration = 0;
let authAttempts = 0;

function getPhase(): AuthPhase {
  return phase;
}

function isFloodError(err: unknown): { seconds: number } | null {
  if (!err || typeof err !== "object") return null;
  const e = err as {
    code?: number;
    errorMessage?: string;
    seconds?: number;
    message?: string;
  };
  const msg = e.errorMessage ?? e.message ?? "";
  if (e.code === 420 || /FLOOD_WAIT/i.test(msg)) {
    const fromMsg = msg.match(/FLOOD_WAIT_(\d+)/i);
    const seconds =
      typeof e.seconds === "number"
        ? e.seconds
        : fromMsg
          ? Number(fromMsg[1])
          : 60;
    return { seconds };
  }
  return null;
}

function terminalSignInMessage(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { errorMessage?: string; message?: string };
  const msg = e.errorMessage ?? e.message ?? "";
  if (/PHONE_CODE_EXPIRED/i.test(msg)) {
    return "The login code expired before it was submitted. Click Send code to request a new one.";
  }
  if (/PHONE_NUMBER_UNOCCUPIED/i.test(msg)) {
    return "That phone number has no Telegram account registered.";
  }
  if (/PHONE_NUMBER_INVALID/i.test(msg)) {
    return "That phone number is not valid.";
  }
  return null;
}

function getApiCredentials(): { apiId: number; apiHash: string } {
  const apiId = Number(config.telegramApiId);
  const apiHash = config.telegramApiHash;
  if (!apiId || !apiHash) {
    throw new Error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set");
  }
  return { apiId, apiHash };
}

function createClient(sessionString = ""): TelegramClient {
  const { apiId, apiHash } = getApiCredentials();
  return new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 5,
  });
}

export async function getAuthStatus(): Promise<{
  phase: AuthPhase;
  connected: boolean;
  userId: string | null;
  username: string | null;
  firstName: string | null;
  error: string | null;
  floodSecondsRemaining: number | null;
  attempt: number;
  maxAttempts: number;
}> {
  const binding = await loadBinding();
  const remaining =
    floodUntil > Date.now()
      ? Math.ceil((floodUntil - Date.now()) / 1000)
      : null;
  return {
    phase,
    connected: phase === "connected",
    userId: binding?.userId ?? null,
    username: binding?.username ?? null,
    firstName: binding?.firstName ?? null,
    error: lastError,
    floodSecondsRemaining: remaining,
    attempt: authAttempts,
    maxAttempts: MAX_AUTH_ATTEMPTS,
  };
}

export function getClient(): TelegramClient | null {
  return client;
}

async function persistSuccessfulLogin(tgClient: TelegramClient): Promise<void> {
  const me = await tgClient.getMe();
  const userId = String(me.id);

  const existing = await loadBinding();
  if (existing && existing.userId !== userId) {
    await tgClient.logOut();
    throw new Error(
      `This instance is already bound to another account (${existing.username ?? existing.userId}). Logout first or use a fresh worker data directory.`,
    );
  }

  const session = tgClient.session.save() as string;
  await saveSessionString(session);

  const binding: AccountBinding = {
    userId,
    username: me.username ?? null,
    firstName: me.firstName ?? null,
    boundAt: Date.now(),
  };
  await saveBinding(binding);

  client = tgClient;
  phase = "connected";
  lastError = null;
  floodUntil = 0;
  setTelegramConnected(true);

  if (!(await hasPin())) {
    const pin = await generateAndStorePin();
    console.log("[worker] generated PIN for remote access (shown once):");
    console.log(`[worker] PIN: ${pin}`);
  }

  console.log(
    `[worker] logged in as ${binding.username ?? binding.firstName ?? binding.userId}`,
  );
}

export async function tryRestoreSession(): Promise<boolean> {
  if (!(await hasSession())) {
    phase = "idle";
    setTelegramConnected(false);
    return false;
  }

  phase = "connecting";
  lastError = null;

  try {
    const sessionString = await loadSessionString();
    if (!sessionString) {
      phase = "idle";
      return false;
    }

    const tgClient = createClient(sessionString);
    await tgClient.connect();

    if (!(await tgClient.checkAuthorization())) {
      console.log("[worker] saved session is no longer authorized");
      await clearSession();
      await tgClient.disconnect();
      phase = "idle";
      setTelegramConnected(false);
      return false;
    }

    await persistSuccessfulLogin(tgClient);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[worker] failed to restore session:", msg);
    lastError = msg;
    phase = "error";
    setTelegramConnected(false);
    await clearSession();
    return false;
  }
}

export async function startPhoneAuth(
  phone: string,
): Promise<{ phase: AuthPhase; error?: string }> {
  if (phase === "connected") {
    throw new Error("already connected");
  }
  if (startPromise) {
    throw new Error("auth already in progress");
  }
  if (floodUntil > Date.now()) {
    const sec = Math.ceil((floodUntil - Date.now()) / 1000);
    throw new Error(
      `Telegram rate limit — wait ${sec} seconds before trying again`,
    );
  }

  const normalized = phone.replace(/\s+/g, "");
  if (!normalized) {
    throw new Error("phone number required");
  }

  const generation = ++authGeneration;
  authAttempts = 0;
  phase = "awaiting_code";
  lastError = null;
  codeDeferred = createDeferred<string>();
  passwordDeferred = createDeferred<string>();

  const tgClient = createClient("");
  pendingClient = tgClient;

  function isCurrent(): boolean {
    return generation === authGeneration;
  }

  startPromise = (async () => {
    try {
      await tgClient.start({
        phoneNumber: async () => normalized,
        phoneCode: async () => {
          if (!isCurrent()) {
            throw new Error("AUTH_USER_CANCEL");
          }
          phase = "awaiting_code";
          const code = await codeDeferred!.promise;
          if (!isCurrent()) {
            throw new Error("AUTH_USER_CANCEL");
          }
          codeDeferred = createDeferred<string>();
          return code;
        },
        password: async (hint?: string) => {
          if (!isCurrent()) {
            throw new Error("AUTH_USER_CANCEL");
          }
          phase = "awaiting_password";
          if (hint) {
            console.log(`[worker] 2FA hint: ${hint}`);
          }
          const password = await passwordDeferred!.promise;
          if (!isCurrent()) {
            throw new Error("AUTH_USER_CANCEL");
          }
          passwordDeferred = createDeferred<string>();
          return password;
        },
        onError: async (err) => {
          if (!isCurrent()) {
            return true;
          }

          const flood = isFloodError(err);
          if (flood) {
            floodUntil = Date.now() + flood.seconds * 1000;
            lastError = `Telegram rate limit — wait ${flood.seconds} seconds before trying again`;
            phase = "error";
            console.error(`[worker] FLOOD_WAIT ${flood.seconds}s — stopping`);
            return true;
          }

          const terminal = terminalSignInMessage(err);
          if (terminal) {
            lastError = terminal;
            phase = "error";
            console.error("[worker] terminal auth error:", err);
            return true;
          }

          authAttempts += 1;
          const msg = err instanceof Error ? err.message : String(err);
          if (authAttempts >= MAX_AUTH_ATTEMPTS) {
            lastError = `${msg} — too many attempts. Click Send code to start over.`;
            phase = "error";
            console.error(
              `[worker] auth error (attempt ${authAttempts}/${MAX_AUTH_ATTEMPTS}), giving up:`,
              err,
            );
            return true;
          }

          lastError = msg;
          console.error(
            `[worker] auth error (attempt ${authAttempts}/${MAX_AUTH_ATTEMPTS}), retrying:`,
            err,
          );
          return false;
        },
      });

      if (!isCurrent()) {
        try {
          await tgClient.disconnect();
        } catch {}
        return;
      }

      await persistSuccessfulLogin(tgClient);
    } catch (err) {
      if (!isCurrent()) {
        try {
          await tgClient.disconnect();
        } catch {}
        return;
      }
      const flood = isFloodError(err);
      if (flood) {
        floodUntil = Date.now() + flood.seconds * 1000;
        lastError = `Telegram rate limit — wait ${flood.seconds} seconds before trying again`;
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[worker] auth failed:", msg);
        lastError = msg;
      }
      phase = "error";
      setTelegramConnected(false);
      try {
        await tgClient.disconnect();
      } catch {}
    } finally {
      if (isCurrent()) {
        startPromise = null;
        codeDeferred = null;
        passwordDeferred = null;
        pendingClient = null;
      }
    }
  })();

  await new Promise((r) => setTimeout(r, 400));
  return { phase: getPhase(), error: lastError ?? undefined };
}

export async function submitCode(
  code: string,
): Promise<{ phase: AuthPhase; error?: string }> {
  if (getPhase() !== "awaiting_code" || !codeDeferred) {
    throw new Error("not awaiting code");
  }
  const trimmed = code.trim();
  if (!trimmed) {
    throw new Error("code required");
  }

  lastError = null;
  codeDeferred.resolve(trimmed);

  await new Promise((r) => setTimeout(r, 300));

  return { phase: getPhase(), error: lastError ?? undefined };
}

export async function submitPassword(
  password: string,
): Promise<{ phase: AuthPhase; error?: string }> {
  if (getPhase() !== "awaiting_password" || !passwordDeferred) {
    throw new Error("not awaiting password");
  }
  if (!password) {
    throw new Error("password required");
  }

  lastError = null;
  passwordDeferred.resolve(password);

  await new Promise((r) => setTimeout(r, 300));

  return { phase: getPhase(), error: lastError ?? undefined };
}

export async function logout(): Promise<void> {
  authGeneration += 1;

  if (codeDeferred) {
    codeDeferred.resolve("");
  }
  if (passwordDeferred) {
    passwordDeferred.resolve("");
  }

  const pending = startPromise;
  if (pending) {
    try {
      await Promise.race([pending, new Promise((r) => setTimeout(r, 3000))]);
    } catch {}
  }

  if (pendingClient) {
    try {
      await pendingClient.disconnect();
    } catch {}
    pendingClient = null;
  }

  if (client) {
    try {
      await client.logOut();
    } catch (err) {
      console.error("[worker] logout error:", err);
      try {
        await client.disconnect();
      } catch {}
    }
  }

  client = null;
  startPromise = null;
  codeDeferred = null;
  passwordDeferred = null;
  authAttempts = 0;
  await clearSession();
  phase = "idle";
  lastError = null;
  floodUntil = 0;
  setTelegramConnected(false);
  console.log("[worker] logged out and session cleared");
}
