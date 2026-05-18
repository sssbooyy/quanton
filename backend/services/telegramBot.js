import TelegramBot from "node-telegram-bot-api";
import { isProduction } from "../config.js";
import { setEscrowListingPrice } from "./telegramGiftEscrow.js";

/**
 * Telegram Mini Apps
 * --------------------
 * Mini Apps are web pages opened inside Telegram (in-app browser). Telegram passes
 * context via window.Telegram.WebApp (initData, theme, user, etc.) — load telegram.org/js/telegram-web-app.js in your SPA.
 * Docs: https://core.telegram.org/bots/webapps
 *
 * Environment (Render / production)
 * -----------------------------------
 * - BOT_TOKEN — from @BotFather
 * - ADMIN_CHAT_ID — chat id for desk alerts (same chat where you /start)
 * - MINI_APP_URL — public HTTPS URL of the Vite/React app (Telegram rejects non-HTTPS except localhost)
 * See backend/DEPLOYMENT.md for Render-specific steps.
 */

let bot = null;

/** @returns {string | null} Normalized base URL or null if unset / invalid */
function getMiniAppUrl() {
  const raw = process.env.MINI_APP_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      console.warn(
        "[telegram] MINI_APP_URL must start with http:// or https://. Web App button disabled."
      );
      return null;
    }
    const normalized = parsed.toString().replace(/\/$/, "");
    if (
      isProduction &&
      parsed.protocol === "http:" &&
      !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)
    ) {
      console.warn(
        "[telegram] MINI_APP_URL uses http:// in production. Telegram Mini Apps require HTTPS on the public web — use https:// for your deployed SPA."
      );
    }
    return normalized;
  } catch {
    console.warn(
      "[telegram] MINI_APP_URL is not a valid URL. Web App keyboard disabled."
    );
    return null;
  }
}

export function initTelegramBot() {
  if (!process.env.BOT_TOKEN) {
    console.log("[telegram] BOT_TOKEN is missing — bot disabled (API still runs).");
    return null;
  }

  if (!getMiniAppUrl()) {
    console.warn(
      "[telegram] MINI_APP_URL is missing or invalid. Web App keyboard disabled; /start still works. Set MINI_APP_URL to your public Mini App URL."
    );
  }

  bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: {
      interval: 300,
      autoStart: true,
      params: { timeout: 10 },
    },
  });

  bot.on("polling_error", (err) => {
    console.error("[telegram] polling_error:", err?.message || err);
  });

  bot.onText(/\/start/, (msg) => {
    const miniAppUrl = getMiniAppUrl();

    const lines = [
      "Welcome to Quanton Market",
      "",
      miniAppUrl
        ? "Tap the button below to open Quanton Market inside Telegram."
        : "Mini App URL is not configured. Ask your admin to set MINI_APP_URL on the server. You can still receive desk alerts in this chat.",
      "",
      "Seller flow: send your Telegram gift to the Quanton bot/business account. Quanton verifies escrow ownership, then asks you for a TON price.",
      "Dev price command: /price <listingId> <amountTon>",
    ];

    bot.sendMessage(msg.chat.id, lines.join("\n")).catch((e) => {
      console.error("[telegram] sendMessage failed:", e?.message || e);
    });
  });

  bot.onText(/\/sell/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      [
        "To list a gift in escrow:",
        "1. Send the actual Telegram gift to the Quanton bot/business account.",
        "2. Quanton verifies the gift is held in escrow.",
        "3. Set the price when the bot asks.",
        "",
        "Until Business API permissions are connected, admins can use the guarded dev escrow intake endpoint.",
      ].join("\n")
    ).catch((e) => console.error("[telegram] sendMessage failed:", e?.message || e));
  });

  bot.onText(/\/price\s+(\S+)\s+([0-9]+(?:\.[0-9]+)?)/, async (msg, match) => {
    const listingId = match?.[1] || "";
    const priceTon = match?.[2] || "";
    try {
      const result = await setEscrowListingPrice({
        listingId,
        priceTon,
        sellerTelegramId: String(msg.from?.id || ""),
      });
      if (result.error) {
        await bot.sendMessage(msg.chat.id, result.error.body.error);
        return;
      }
      await bot.sendMessage(
        msg.chat.id,
        `Listing ${result.gift.listingId} is live at ${result.gift.priceTon} TON.`
      );
    } catch (e) {
      console.error("[telegram] /price failed:", e);
      await bot.sendMessage(msg.chat.id, "Could not set price. Please try again later.");
    }
  });

  console.log("[telegram] Bot polling started");
  return bot;
}

export async function stopTelegramBot() {
  if (!bot) return;
  try {
    await bot.stopPolling({ cancel: true });
  } catch (e) {
    console.warn("[telegram] stopPolling:", e?.message || e);
  }
  bot = null;
}

export async function sendAdminAlert(text) {
  if (!bot || !process.env.ADMIN_CHAT_ID) return;
  await bot.sendMessage(process.env.ADMIN_CHAT_ID, text, { parse_mode: "HTML" });
}
