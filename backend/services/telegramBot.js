import TelegramBot from "node-telegram-bot-api";
import { isProduction } from "../config.js";

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

/**
 * Reply keyboard shown after /start. One row: Web App button (opens MINI_APP_URL inside Telegram).
 * @returns {import("node-telegram-bot-api").ReplyKeyboardMarkup | undefined}
 */
function buildOpenMarketKeyboard(url) {
  return {
    keyboard: [[{ text: "🚀 Open Quanton Market", web_app: { url } }]],
    resize_keyboard: true,
    is_persistent: true,
  };
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
    const reply_markup = miniAppUrl ? buildOpenMarketKeyboard(miniAppUrl) : undefined;

    const lines = [
      "Welcome to Quanton Market 🚀",
      "",
      miniAppUrl
        ? "Tap the button below to open Quanton Market inside Telegram."
        : "Mini App URL is not configured. Ask your admin to set MINI_APP_URL on the server. You can still receive desk alerts in this chat.",
      "",
      "You will receive Quanton Market desk alerts here when they are enabled.",
    ];

    const options = reply_markup ? { reply_markup } : {};
    bot.sendMessage(msg.chat.id, lines.join("\n"), options).catch((e) => {
      console.error("[telegram] sendMessage failed:", e?.message || e);
    });
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
