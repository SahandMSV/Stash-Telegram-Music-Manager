import { config } from "./config.js";
import { startServer } from "./server.js";
import { hasPin, generateAndStorePin } from "./pin-store.js";

function bootstrap(): void {
  console.log("[worker] starting stash worker");

  if (!hasPin()) {
    const pin = generateAndStorePin();
    console.log("[worker] generated PIN for remote access (shown once):");
    console.log(`[worker] PIN: ${pin}`);
  } else {
    console.log("[worker] PIN already provisioned");
  }

  startServer();

  console.log(`[worker] api id present: ${Boolean(config.telegramApiId)}`);
  console.log(`[worker] bot token present: ${Boolean(config.botToken)}`);
  console.log("[worker] MTProto client not yet initialized (next step)");
}

bootstrap();
