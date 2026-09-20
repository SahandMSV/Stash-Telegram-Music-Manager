import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { randomInt } from "node:crypto";
import { encrypt, decrypt } from "./crypto.js";
import { config } from "./config.js";

const PIN_FILE = resolve(process.cwd(), "data/pin.enc");

function ensureDataDir(): void {
  const dir = dirname(PIN_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function hasPin(): boolean {
  return existsSync(PIN_FILE);
}

export function generateAndStorePin(): string {
  ensureDataDir();
  const pin = randomInt(100000, 999999).toString();
  const key = config.getRequiredSessionKey();
  writeFileSync(PIN_FILE, encrypt(pin, key), "utf8");
  return pin;
}

export function verifyPin(candidate: string): boolean {
  if (!hasPin()) return false;
  const key = config.getRequiredSessionKey();
  const stored = decrypt(readFileSync(PIN_FILE, "utf8"), key);
  return stored === candidate;
}

export function resetPin(): string {
  return generateAndStorePin();
}
