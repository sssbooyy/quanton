import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import { isProduction } from "../config.js";
import { setEscrowListingPrice } from "./telegramGiftEscrow.js";
import { Gift } from "../models/Gift.js";
import { Order } from "../models/Order.js";
import { resolveGiftMetadata, applyResolvedMetadataToGiftDocument } from "./metadataProvider.js";
import { finalizeResolvedFloorMetadata } from "./floorProvider.js";
import { scheduleGiftImageUpscale, syncUpscaleMetadataFields } from "./imageUpscaler.js";

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

function adminChatId() {
  return String(process.env.ADMIN_CHAT_ID || "").trim();
}

function assertAdminCallback(query) {
  const chatId = String(query?.message?.chat?.id || "");
  const fromId = String(query?.from?.id || "");
  const admin = adminChatId();
  if (!admin) throw new Error("ADMIN_CHAT_ID is not configured.");
  if (chatId !== admin && fromId !== admin) throw new Error("Admin action is not allowed from this chat.");
}

function sellerUsernameFromMsg(msg) {
  return String(msg?.from?.username || "").trim();
}

function displayTelegramUser({ id, username }) {
  const u = String(username || "").trim();
  const i = String(id || "").trim();
  return u ? `@${u}${i ? ` / ${i}` : ""}` : i || "unknown";
}

function extractGiftLink(text) {
  const s = String(text || "").trim();
  const m = s.match(/https?:\/\/(?:t\.me|telegram\.me)\/nft\/[^\s]+/i);
  return m ? m[0] : "";
}

function parsePositiveTon(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function extractRequestedPriceTon(text) {
  const s = String(text || "");
  const m = s.match(/(?:price\s*)?([0-9]+(?:\.[0-9]+)?)\s*TON\b/i);
  return m ? parsePositiveTon(m[1]) : 0;
}

function parseStandaloneTonAmount(text) {
  const s = String(text || "").trim();
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)(?:\s*TON)?$/i);
  return m ? parsePositiveTon(m[1]) : 0;
}

function adminReviewKeyboard(listingId) {
  return {
    inline_keyboard: [
      [
        { text: "Approve listing", callback_data: `admin_approve:${listingId}` },
        { text: "Reject listing", callback_data: `admin_reject:${listingId}` },
      ],
    ],
  };
}

function buyerReceiptKeyboard(orderId) {
  return {
    inline_keyboard: [
      [
        { text: "I received the gift", callback_data: `buyer_received:${orderId}` },
        { text: "Report issue", callback_data: `buyer_dispute:${orderId}` },
      ],
    ],
  };
}

function adminPayoutKeyboard(orderId) {
  return {
    inline_keyboard: [[{ text: "Mark payout sent", callback_data: `admin_payout:${orderId}` }]],
  };
}

async function notifyAdmin(text, options = {}) {
  if (!bot || !adminChatId()) return;
  await bot.sendMessage(adminChatId(), text, options);
}

async function notifyChat(chatId, text, options = {}) {
  const id = String(chatId || "").trim();
  if (!bot || !id) return;
  await bot.sendMessage(id, text, options);
}

async function notifyAdminListingReview(gift, { prefix = "Listing ready for admin review." } = {}) {
  await notifyAdmin(
    [
      prefix,
      "",
      `Listing: ${gift.listingId}`,
      `Seller: ${displayTelegramUser({ id: gift.sellerTelegramId, username: gift.sellerUsername })}`,
      `Gift: ${gift.name}`,
      `Collection: ${gift.collection}`,
      `Model: ${gift.model || "—"}`,
      `Symbol: ${gift.symbol || "—"}`,
      `Backdrop: ${gift.backdrop || "—"}`,
      `Gift link: ${gift.giftLink}`,
      `Requested price: ${gift.priceTon > 0 ? `${gift.priceTon} TON` : "not set"}`,
    ].join("\n"),
    { reply_markup: adminReviewKeyboard(gift.listingId) }
  );
}

async function createManualAdminReviewListing({ giftLink, sellerTelegramId, sellerUsername, priceTon }) {
  const resolved = await resolveGiftMetadata(giftLink);
  if (!resolved.ok) {
    return { error: resolved.error || "Could not resolve gift metadata." };
  }
  await finalizeResolvedFloorMetadata(resolved, {});
  const resolvedName = String(resolved.name ?? "").trim();
  const resolvedImage = String(resolved.imageHiRes || resolved.image || "").trim();
  if (!resolvedName || !resolvedImage) {
    return { error: "Could not resolve gift metadata (missing title or image)." };
  }

  const gift = new Gift({
    listingId: `manual_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    giftLink,
    priceTon: parsePositiveTon(priceTon),
    status: "pending_admin_review",
    listingSource: "manual_admin_verified",
    verificationStatus: "pending_admin_review",
    escrowStatus: "none",
    transferStatus: "not_started",
    payoutStatus: "not_ready",
    sellerTelegramId,
    sellerUsername,
    telegramUserSnapshot: {
      id: sellerTelegramId,
      username: sellerUsername,
    },
  });

  applyResolvedMetadataToGiftDocument(gift, resolved);
  syncUpscaleMetadataFields(gift, resolved);
  await gift.save();
  if (gift.imageUpscaleStatus === "pending") {
    scheduleGiftImageUpscale(gift.listingId);
  }
  return { gift };
}

async function setSellerListingPrice({ listingId, sellerTelegramId, priceTon }) {
  const price = parsePositiveTon(priceTon);
  if (!price) return { error: "Price in TON must be greater than 0." };

  const manual = await Gift.findOne({
    listingId: String(listingId || "").trim(),
    listingSource: "manual_admin_verified",
    sellerTelegramId: String(sellerTelegramId || "").trim(),
    status: { $in: ["pending_admin_review", "listed"] },
  });
  if (manual) {
    manual.priceTon = price;
    if (manual.verificationStatus === "admin_verified") {
      manual.status = "listed";
    }
    await manual.save();
    return { gift: manual };
  }

  const escrow = await setEscrowListingPrice({ listingId, sellerTelegramId, priceTon });
  if (escrow.error) return { error: escrow.error.body.error };
  return { gift: escrow.gift };
}

async function setLatestPendingListingPrice({ sellerTelegramId, priceTon }) {
  const price = parsePositiveTon(priceTon);
  if (!price) return { error: "Send a price like 5 or 5 TON." };

  const gift = await Gift.findOne({
    listingSource: "manual_admin_verified",
    sellerTelegramId: String(sellerTelegramId || "").trim(),
    status: { $in: ["pending_admin_review", "listed"] },
    verificationStatus: { $in: ["pending_admin_review", "admin_verified"] },
  }).sort({ updatedAt: -1 });

  if (!gift) {
    return { error: "No pending listing found. Send a Telegram gift link first." };
  }

  gift.priceTon = price;
  if (gift.verificationStatus === "admin_verified") {
    gift.status = "listed";
  }
  await gift.save();
  return { gift };
}

async function markBuyerReceived(order) {
  if (order.status !== "paid") {
    throw new Error(`Order is ${order.status}; receipt can be confirmed only after payment.`);
  }
  order.status = "buyer_confirmed";
  order.transferStatus = "buyer_confirmed_received";
  order.payoutStatus = "pending_admin_payout";
  await order.save();

  await Gift.updateMany(
    { listingId: { $in: order.listingIds } },
    {
      $set: {
        status: "completed_pending_payout",
        transferStatus: "buyer_confirmed_received",
        payoutStatus: "pending_admin_payout",
      },
    }
  );

  const gifts = await Gift.find({ listingId: { $in: order.listingIds } });
  await notifyAdmin(
    [
      "Buyer confirmed receipt. Release payout to seller.",
      "",
      `Order: ${order.orderId}`,
      `Buyer: ${displayTelegramUser({ id: order.buyerTelegramId, username: order.buyerUsername })}`,
      `Listings: ${order.listingIds.join(", ")}`,
    ].join("\n"),
    { reply_markup: adminPayoutKeyboard(order.orderId) }
  );
  for (const gift of gifts) {
    await notifyChat(gift.sellerTelegramId, `Buyer confirmed receipt for ${gift.name}. Waiting for admin payout release.`);
  }
}

async function markOrderDisputed(order) {
  order.status = "disputed";
  order.transferStatus = "disputed";
  await order.save();
  await Gift.updateMany(
    { listingId: { $in: order.listingIds } },
    { $set: { status: "disputed", transferStatus: "disputed" } }
  );
  await notifyAdmin(
    [
      "Buyer reported an issue. Manual review required.",
      "",
      `Order: ${order.orderId}`,
      `Buyer: ${displayTelegramUser({ id: order.buyerTelegramId, username: order.buyerUsername })}`,
      `Listings: ${order.listingIds.join(", ")}`,
    ].join("\n")
  );
}

async function markPayoutSent(orderId) {
  const order = await Order.findOne({ orderId: String(orderId || "").trim() });
  if (!order) throw new Error("Order not found.");
  if (order.status !== "buyer_confirmed") {
    throw new Error(`Order is ${order.status}; buyer confirmation is required before payout.`);
  }

  order.status = "completed";
  order.payoutStatus = "paid";
  await order.save();
  const gifts = await Gift.find({ listingId: { $in: order.listingIds } });
  for (const gift of gifts) {
    gift.status = "completed";
    gift.payoutStatus = "paid";
    await gift.save();
    await notifyChat(gift.sellerTelegramId, `Payout sent for ${gift.name}.`);
  }
  await notifyChat(order.buyerTelegramId, `Order ${order.orderId} completed.`);
}

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
    const lines = [
      "Welcome to Quanton Market.",
      "",
      "To sell a Telegram gift, send its link here:",
      "https://t.me/nft/...",
      "",
      "I will read the gift details, ask for your price in TON, and send it to admin for manual review.",
      "After a buyer pays, you transfer the gift manually. Payout is released after buyer confirmation.",
      "",
      "Send /help for all commands.",
    ];

    bot.sendMessage(msg.chat.id, lines.join("\n")).catch((e) => {
      console.error("[telegram] sendMessage failed:", e?.message || e);
    });
  });

  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      [
        "Quanton Market help",
        "",
        "Send a Telegram gift link",
        "Paste a link like https://t.me/nft/... . I will detect the gift and create a pending listing.",
        "",
        "Set a price",
        "After the gift is detected, just reply with a TON amount, for example 5 or 5 TON.",
        "Fallback command: /price <listingId> <amountTon>",
        "",
        "Buyer confirmation",
        "When a buyer pays, you manually send the gift to them. The buyer confirms receipt before payout.",
        "",
        "Disputes",
        "If the buyer has an issue, they can report it and admin will review manually.",
        "",
        "Commands list",
        "/help - show this help",
        "/sell - quick seller instructions",
        "/price - set price by listing id",
        "/received - buyer confirms receipt by order id",
        "/dispute - buyer reports an issue by order id",
      ].join("\n")
    ).catch((e) => console.error("[telegram] sendMessage failed:", e?.message || e));
  });

  bot.onText(/\/sell/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      [
        "Sell a Telegram gift",
        "",
        "1. Send the gift link here: https://t.me/nft/...",
        "2. Reply with your price, for example 5 or 5 TON.",
        "3. Admin verifies ownership and approves the listing.",
        "4. After buyer payment, transfer the gift manually.",
        "",
        "Payout is released only after the buyer confirms receipt.",
      ].join("\n")
    ).catch((e) => console.error("[telegram] sendMessage failed:", e?.message || e));
  });

  bot.onText(/\/price\s+(\S+)\s+([0-9]+(?:\.[0-9]+)?)/, async (msg, match) => {
    const listingId = match?.[1] || "";
    const priceTon = match?.[2] || "";
    try {
      const result = await setSellerListingPrice({
        listingId,
        priceTon,
        sellerTelegramId: String(msg.from?.id || ""),
      });
      if (result.error) {
        await bot.sendMessage(msg.chat.id, result.error);
        return;
      }
      await bot.sendMessage(
        msg.chat.id,
        `Listing ${result.gift.listingId} price set to ${result.gift.priceTon} TON. ${result.gift.status === "listed" ? "It is live." : "Waiting for admin review."}`
      );
      if (result.gift.listingSource === "manual_admin_verified") {
        await notifyAdminListingReview(result.gift, { prefix: "Listing price set. Review manually." });
      }
    } catch (e) {
      console.error("[telegram] /price failed:", e);
      await bot.sendMessage(msg.chat.id, "Could not set price. Please try again later.");
    }
  });

  bot.onText(/\/received\s+(\S+)/, async (msg, match) => {
    try {
      const orderId = match?.[1] || "";
      const order = await Order.findOne({ orderId });
      if (!order) {
        await bot.sendMessage(msg.chat.id, "Order not found.");
        return;
      }
      if (String(msg.from?.id || "") !== String(order.buyerTelegramId || "")) {
        await bot.sendMessage(msg.chat.id, "Only the buyer can confirm receipt for this order.");
        return;
      }
      await markBuyerReceived(order);
      await bot.sendMessage(msg.chat.id, "Receipt confirmed. Admin has been notified to release payout.");
    } catch (e) {
      console.error("[telegram] /received failed:", e);
      await bot.sendMessage(msg.chat.id, "Could not confirm receipt. Please try again later.");
    }
  });

  bot.onText(/\/dispute\s+(\S+)/, async (msg, match) => {
    try {
      const orderId = match?.[1] || "";
      const order = await Order.findOne({ orderId });
      if (!order) {
        await bot.sendMessage(msg.chat.id, "Order not found.");
        return;
      }
      if (String(msg.from?.id || "") !== String(order.buyerTelegramId || "")) {
        await bot.sendMessage(msg.chat.id, "Only the buyer can report an issue for this order.");
        return;
      }
      await markOrderDisputed(order);
      await bot.sendMessage(msg.chat.id, "Issue reported. Admin will review this order.");
    } catch (e) {
      console.error("[telegram] /dispute failed:", e);
      await bot.sendMessage(msg.chat.id, "Could not report issue. Please try again later.");
    }
  });

  bot.on("message", async (msg) => {
    try {
      const text = String(msg.text || "");
      if (!text || text.startsWith("/")) return;
      const giftLink = extractGiftLink(text);
      if (!giftLink) {
        const amount = parseStandaloneTonAmount(text);
        if (!amount) return;

        const result = await setLatestPendingListingPrice({
          sellerTelegramId: String(msg.from?.id || ""),
          priceTon: amount,
        });
        if (result.error) {
          await bot.sendMessage(msg.chat.id, result.error);
          return;
        }

        await bot.sendMessage(
          msg.chat.id,
          [`Price set to ${result.gift.priceTon} TON.`, "Waiting for admin review."].join("\n")
        );
        await notifyAdminListingReview(result.gift, { prefix: "Listing price set. Review manually." });
        return;
      }

      const sellerTelegramId = String(msg.from?.id || "");
      const sellerUsername = sellerUsernameFromMsg(msg);
      const result = await createManualAdminReviewListing({
        giftLink,
        sellerTelegramId,
        sellerUsername,
        priceTon: extractRequestedPriceTon(text),
      });
      if (result.error) {
        await bot.sendMessage(msg.chat.id, `Could not create listing request: ${result.error}`);
        return;
      }

      const gift = result.gift;
      if (gift.priceTon > 0) {
        await bot.sendMessage(
          msg.chat.id,
          [
            `Gift detected: ${gift.name}`,
            `Price set to ${gift.priceTon} TON.`,
            "Waiting for admin review.",
          ].join("\n")
        );
        await notifyAdminListingReview(gift, { prefix: "New listing request pending admin review." });
        return;
      }

      await bot.sendMessage(
        msg.chat.id,
        [
          `Gift detected: ${gift.name}`,
          "Send the price in TON for this gift.",
          "",
          "Example: 5 or 5 TON",
        ].join("\n")
      );
    } catch (e) {
      console.error("[telegram] gift link intake failed:", e);
      await bot.sendMessage(msg.chat.id, "Could not process that gift link. Please try again later.");
    }
  });

  bot.on("callback_query", async (query) => {
    const data = String(query.data || "");
    try {
      if (data.startsWith("admin_approve:")) {
        assertAdminCallback(query);
        const listingId = data.slice("admin_approve:".length);
        const gift = await Gift.findOne({ listingId, status: "pending_admin_review" });
        if (!gift) throw new Error("Listing request not found or already reviewed.");
        gift.listingSource = "manual_admin_verified";
        gift.status = "listed";
        gift.verificationStatus = "admin_verified";
        gift.transferStatus = "not_started";
        gift.payoutStatus = "not_ready";
        await gift.save();
        await notifyChat(gift.sellerTelegramId, `Your listing ${gift.listingId} was approved.${gift.priceTon > 0 ? "" : ` Set price: /price ${gift.listingId} <amountTon>`}`);
        await bot.answerCallbackQuery(query.id, { text: "Listing approved." });
        await bot.sendMessage(query.message.chat.id, `Approved listing ${gift.listingId}.`);
        return;
      }

      if (data.startsWith("admin_reject:")) {
        assertAdminCallback(query);
        const listingId = data.slice("admin_reject:".length);
        const gift = await Gift.findOne({ listingId, status: "pending_admin_review" });
        if (!gift) throw new Error("Listing request not found or already reviewed.");
        gift.status = "rejected";
        gift.verificationStatus = "rejected";
        await gift.save();
        await notifyChat(gift.sellerTelegramId, `Your listing ${gift.listingId} was rejected by admin review.`);
        await bot.answerCallbackQuery(query.id, { text: "Listing rejected." });
        await bot.sendMessage(query.message.chat.id, `Rejected listing ${gift.listingId}.`);
        return;
      }

      if (data.startsWith("buyer_received:")) {
        const orderId = data.slice("buyer_received:".length);
        const order = await Order.findOne({ orderId });
        if (!order) throw new Error("Order not found.");
        if (String(query.from?.id || "") !== String(order.buyerTelegramId || "")) {
          throw new Error("Only the buyer can confirm receipt.");
        }
        await markBuyerReceived(order);
        await bot.answerCallbackQuery(query.id, { text: "Receipt confirmed." });
        return;
      }

      if (data.startsWith("buyer_dispute:")) {
        const orderId = data.slice("buyer_dispute:".length);
        const order = await Order.findOne({ orderId });
        if (!order) throw new Error("Order not found.");
        if (String(query.from?.id || "") !== String(order.buyerTelegramId || "")) {
          throw new Error("Only the buyer can report an issue.");
        }
        await markOrderDisputed(order);
        await bot.answerCallbackQuery(query.id, { text: "Issue reported to admin." });
        return;
      }

      if (data.startsWith("admin_payout:")) {
        assertAdminCallback(query);
        const orderId = data.slice("admin_payout:".length);
        await markPayoutSent(orderId);
        await bot.answerCallbackQuery(query.id, { text: "Payout marked sent." });
        return;
      }
    } catch (e) {
      console.error("[telegram] callback failed:", e?.message || e);
      if (query.id) {
        await bot.answerCallbackQuery(query.id, { text: e?.message || "Action failed.", show_alert: true }).catch(() => {});
      }
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

export async function notifyManualOrderPaid(order, gifts) {
  if (!bot) return;
  const buyer = displayTelegramUser({ id: order.buyerTelegramId, username: order.buyerUsername });
  for (const gift of gifts || []) {
    await notifyChat(
      gift.sellerTelegramId || gift.escrowOwnerTelegramId,
      [
        "Your gift was purchased.",
        "",
        `Gift: ${gift.name}`,
        `Order: ${order.orderId}`,
        `Buyer: ${buyer}`,
        "",
        "Please send this gift manually to the buyer. Payout is released only after buyer confirmation.",
      ].join("\n")
    );
  }
  await notifyAdmin(
    [
      "Order paid. Waiting for seller transfer.",
      "",
      `Order: ${order.orderId}`,
      `Buyer: ${buyer}`,
      `Listings: ${order.listingIds.join(", ")}`,
    ].join("\n")
  );
  await notifyChat(
    order.buyerTelegramId,
    [
      "Payment received. Waiting for seller to transfer gift.",
      "",
      `Order: ${order.orderId}`,
      "",
      `After receiving the gift, tap the button below or send /received ${order.orderId}. If there is an issue, send /dispute ${order.orderId}.`,
    ].join("\n"),
    { reply_markup: buyerReceiptKeyboard(order.orderId) }
  );
}
