import { config } from "./config.js";
import { startServer } from "./server.js";
import { hasPin } from "./pin-store.js";
import { tryRestoreSession } from "./telegram-client.js";
import { startBot } from "./bot.js";

async function bootstrap(): Promise<void> {
  console.log("[worker] starting stash worker");

  if (await hasPin()) {
    console.log("[worker] PIN already provisioned");
  } else {
    console.log("[worker] PIN will be generated on first successful login");
  }

  startServer();
  startBot();

  console.log(`[worker] api id present: ${Boolean(config.telegramApiId)}`);
  console.log(`[worker] bot token present: ${Boolean(config.botToken)}`);

  if (config.telegramApiId && config.telegramApiHash) {
    const restored = await tryRestoreSession();
    if (restored) {
      console.log("[worker] MTProto session restored and connected");
    } else {
      console.log("[worker] no valid session — ready for phone auth");
    }
  } else {
    console.log(
      "[worker] TELEGRAM_API_ID / TELEGRAM_API_HASH missing — auth disabled",
    );
  }
}

bootstrap().catch((err) => {
  console.error("[worker] bootstrap failed:", err);
  process.exit(1);
});
