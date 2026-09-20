import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../../.env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  telegramApiId: process.env.TELEGRAM_API_ID ?? "",
  telegramApiHash: process.env.TELEGRAM_API_HASH ?? "",
  botToken: process.env.BOT_TOKEN ?? "",
  workerPort: Number(process.env.WORKER_PORT ?? 4001),
  sessionEncryptionKey: process.env.WORKER_SESSION_ENCRYPTION_KEY ?? "",
  getRequiredSessionKey: () => required("WORKER_SESSION_ENCRYPTION_KEY"),
};
