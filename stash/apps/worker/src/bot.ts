import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { loadBinding } from "./session-store.js";
import { getAuthStatus } from "./telegram-client.js";

let bot: Bot | null = null;

function webAppUrl(): string {
  return process.env.NEXT_PUBLIC_WEB_APP_URL ?? "http://localhost:3000";
}

function isHttps(url: string): boolean {
  return url.startsWith("https://");
}

export function startBot(): void {
  if (!config.botToken) {
    console.log("[worker] BOT_TOKEN missing — bot disabled");
    return;
  }

  bot = new Bot(config.botToken);

  bot.command("start", async (ctx) => {
    const url = webAppUrl();
    const status = await getAuthStatus();
    const binding = await loadBinding();

    if (status.connected && binding) {
      const label = binding.username
        ? `@${binding.username}`
        : (binding.firstName ?? binding.userId);

      if (isHttps(url)) {
        await ctx.reply(
          `Stash is linked to ${label}.\nOpen the app to manage your music.`,
          {
            reply_markup: new InlineKeyboard().webApp("Open Stash", url),
          },
        );
      } else {
        await ctx.reply(
          `Stash is linked to ${label}.\n\nOpen the app on your machine:\n${url}`,
        );
      }
      return;
    }

    if (isHttps(url)) {
      await ctx.reply(
        "Welcome to Stash.\n\nConnect your Telegram account from the app first. Once linked, use the button below.",
        {
          reply_markup: new InlineKeyboard().webApp("Open Stash", url),
        },
      );
    } else {
      await ctx.reply(
        "Welcome to Stash.\n\nOpen the app on your machine to connect your account:\n" +
          `${url}/setup\n\n` +
          "(Web App buttons require HTTPS. For phone access later, put a tunnel URL in NEXT_PUBLIC_WEB_APP_URL.)",
      );
    }
  });

  bot.command("status", async (ctx) => {
    const status = await getAuthStatus();
    if (!status.connected) {
      await ctx.reply(
        "Not connected. Open the web UI on your machine to log in.",
      );
      return;
    }
    const name = status.username
      ? `@${status.username}`
      : (status.firstName ?? status.userId);
    await ctx.reply(`Connected as ${name}`);
  });

  bot.catch((err) => {
    console.error("[worker] bot error:", err);
  });

  void bot.start({
    onStart: () => console.log("[worker] bot started"),
  });
}

export function stopBot(): void {
  if (bot) {
    void bot.stop();
    bot = null;
  }
}
