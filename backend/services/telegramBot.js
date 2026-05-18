import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import { isProduction } from "../config.js";
import { setEscrowListingPrice } from "./telegramGiftEscrow.js";
import { Gift } from "../models/Gift.js";
import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
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
const languageCache = new Map();

const BOT_I18N = {
  en: {
    languagePrompt: "Welcome to Quanton Marketplace.\nPlease choose your language.",
    languageSaved: "Language set to English.",
    start: [
      "Welcome to Quanton Market.",
      "",
      "To sell a Telegram gift, send its link here:",
      "https://t.me/nft/...",
      "",
      "I will read the gift details, ask for your price in TON, and send it to admin for manual review.",
      "After a buyer pays, you transfer the gift manually. Payout is released after buyer confirmation.",
      "",
      "Send /help for all commands.",
    ],
    help: [
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
      "/language - change language",
    ],
    sell: [
      "Sell a Telegram gift",
      "",
      "1. Send the gift link here: https://t.me/nft/...",
      "2. Reply with your price, for example 5 or 5 TON.",
      "3. Admin verifies ownership and approves the listing.",
      "4. After buyer payment, transfer the gift manually.",
      "",
      "Payout is released only after the buyer confirms receipt.",
    ],
    sendPriceLike: "Send a price like 5 or 5 TON.",
    priceSetFailed: "Could not set price. Please try again later.",
    noPendingListing: "No pending listing found. Send a Telegram gift link first.",
    giftResolveFailed: "Could not create listing request: {error}",
    giftDetectedAskPrice: "Gift detected: {name}\nSend the price in TON for this gift.\n\nExample: 5 or 5 TON",
    giftDetectedWithPrice: "Gift detected: {name}\nPrice set to {price} TON.\nWaiting for admin review.",
    priceSet: "Price set to {price} TON.\nWaiting for admin review.",
    listingPriceSet: "Listing {listingId} price set to {price} TON. {state}",
    listingLive: "It is live.",
    waitingReview: "Waiting for admin review.",
    processGiftFailed: "Could not process that gift link. Please try again later.",
    orderNotFound: "Order not found.",
    onlyBuyerReceived: "Only the buyer can confirm receipt for this order.",
    onlyBuyerDispute: "Only the buyer can report an issue for this order.",
    receiptConfirmed: "Receipt confirmed. Admin has been notified to release payout.",
    receivedFailed: "Could not confirm receipt. Please try again later.",
    issueReported: "Issue reported. Admin will review this order.",
    disputeFailed: "Could not report issue. Please try again later.",
    adminReviewPrefix: "Listing ready for admin review.",
    adminReviewPricePrefix: "Listing price set. Review manually.",
    adminReviewNewPrefix: "New listing request pending admin review.",
    adminReviewTitle: "Listing: {listingId}\nSeller: {seller}\nGift: {name}\nCollection: {collection}\nModel: {model}\nSymbol: {symbol}\nBackdrop: {backdrop}\nGift link: {giftLink}\nRequested price: {price}",
    approveButton: "Approve listing",
    rejectButton: "Reject listing",
    receivedButton: "I received the gift",
    disputeButton: "Report issue",
    payoutButton: "Mark payout sent",
    listingApprovedSeller: "Your listing {listingId} was approved.{priceHint}",
    setPriceHint: " Set price: /price {listingId} <amountTon>",
    listingRejectedSeller: "Your listing {listingId} was rejected by admin review.",
    adminApproved: "Approved listing {listingId}.",
    adminRejected: "Rejected listing {listingId}.",
    cbApproved: "Listing approved.",
    cbRejected: "Listing rejected.",
    cbReceived: "Receipt confirmed.",
    cbDispute: "Issue reported to admin.",
    cbPayout: "Payout marked sent.",
    buyerConfirmedAdmin: "Buyer confirmed receipt. Release payout to seller.\n\nOrder: {orderId}\nBuyer: {buyer}\nListings: {listings}",
    buyerConfirmedAdminWithPayout: "Buyer confirmed receipt. You can now send payout.\n\nOrder: {orderId}\nBuyer: {buyer}\nListings: {listings}\nSeller payout address: {payoutAddress}",
    buyerConfirmedAdminNoPayout: "Buyer confirmed receipt. Waiting for seller payout address.\n\nOrder: {orderId}\nBuyer: {buyer}\nListings: {listings}",
    buyerConfirmedSeller: "Buyer confirmed receipt for {name}. Waiting for admin payout release.",
    disputedAdmin: "Buyer reported an issue. Manual review required.\n\nOrder: {orderId}\nBuyer: {buyer}\nListings: {listings}",
    payoutSentSeller: "Payout sent for {name}.",
    orderCompletedBuyer: "Order {orderId} completed.",
    paidSeller: "Your gift has a buyer.\n\nGift: {name}\nOrder: {orderId}\nBuyer: {buyer}\n\nPlease send the Telegram gift to this buyer.\nAfter sending, send your payout wallet address here.",
    paidAdmin: "✅ Payment received\n\nOrder: {orderId}\nGift: {giftLines}\nSeller: {seller}\nBuyer: {buyer}\nAmount paid: {amount}\nPayment method: {paymentMethod}\ntransferStatus = pending_manual_transfer\npayoutStatus = waiting_seller_wallet",
    paidBuyer: "Payment received. Seller has been notified to send your gift.\n\nGift: {giftNames}\nOrder: {orderId}",
    payoutAddressReceivedSeller: "Payout address received. Waiting for buyer confirmation.",
    payoutAddressReceivedSellerReady: "Payout address received. Buyer already confirmed receipt, so payout is pending admin review.",
    payoutAddressReceivedAdmin: "Seller payout address received\n\nOrder: {orderId}\nSeller: {seller}\nPayout address: {payoutAddress}\nAmount to payout: {amount}\nBuyer confirmation: {buyerConfirmation}",
    buyerConfirmedYes: "confirmed",
    buyerConfirmedNo: "not confirmed yet",
    payoutRequiresBuyer: "Buyer confirmation is required before payout.",
    payoutRequiresAddress: "Seller payout address is required before payout.",
  },
  ru: {
    languagePrompt: "Добро пожаловать в Quanton Marketplace.\nВыберите язык.",
    languageSaved: "Язык изменён на русский.",
    start: [
      "Добро пожаловать в Quanton Market.",
      "",
      "Чтобы продать Telegram-подарок, отправьте сюда ссылку:",
      "https://t.me/nft/...",
      "",
      "Я прочитаю данные подарка, попрошу цену в TON и отправлю лот администратору на ручную проверку.",
      "После оплаты покупателем вы вручную передаёте подарок. Выплата отправляется после подтверждения покупателя.",
      "",
      "Отправьте /help, чтобы увидеть все команды.",
    ],
    help: [
      "Помощь Quanton Market",
      "",
      "Отправьте ссылку на Telegram-подарок",
      "Вставьте ссылку вида https://t.me/nft/... . Я распознаю подарок и создам заявку на лот.",
      "",
      "Укажите цену",
      "После распознавания просто ответьте суммой в TON, например 5 или 5 TON.",
      "Запасная команда: /price <listingId> <amountTon>",
      "",
      "Подтверждение покупателя",
      "Когда покупатель оплатит, вы вручную отправляете ему подарок. Выплата будет только после подтверждения получения.",
      "",
      "Споры",
      "Если у покупателя проблема, он может открыть спор, и админ проверит заказ вручную.",
      "",
      "Команды",
      "/help - показать помощь",
      "/sell - краткая инструкция продавцу",
      "/price - задать цену по listing id",
      "/received - покупатель подтверждает получение по order id",
      "/dispute - покупатель сообщает о проблеме по order id",
      "/language - сменить язык",
    ],
    sell: [
      "Продажа Telegram-подарка",
      "",
      "1. Отправьте сюда ссылку: https://t.me/nft/...",
      "2. Ответьте ценой, например 5 или 5 TON.",
      "3. Админ вручную проверит владение и одобрит лот.",
      "4. После оплаты покупателем передайте подарок вручную.",
      "",
      "Выплата будет только после подтверждения покупателя.",
    ],
    sendPriceLike: "Отправьте цену, например 5 или 5 TON.",
    priceSetFailed: "Не удалось установить цену. Попробуйте позже.",
    noPendingListing: "Нет ожидающего лота. Сначала отправьте ссылку на Telegram-подарок.",
    giftResolveFailed: "Не удалось создать заявку: {error}",
    giftDetectedAskPrice: "Подарок найден: {name}\nОтправьте цену в TON для этого подарка.\n\nНапример: 5 или 5 TON",
    giftDetectedWithPrice: "Подарок найден: {name}\nЦена установлена: {price} TON.\nОжидаем проверку админа.",
    priceSet: "Цена установлена: {price} TON.\nОжидаем проверку админа.",
    listingPriceSet: "Цена лота {listingId} установлена: {price} TON. {state}",
    listingLive: "Лот в продаже.",
    waitingReview: "Ожидаем проверку админа.",
    processGiftFailed: "Не удалось обработать ссылку. Попробуйте позже.",
    orderNotFound: "Заказ не найден.",
    onlyBuyerReceived: "Только покупатель может подтвердить получение этого заказа.",
    onlyBuyerDispute: "Только покупатель может открыть спор по этому заказу.",
    receiptConfirmed: "Получение подтверждено. Админ получил уведомление о выплате.",
    receivedFailed: "Не удалось подтвердить получение. Попробуйте позже.",
    issueReported: "Проблема отправлена. Админ проверит заказ.",
    disputeFailed: "Не удалось отправить спор. Попробуйте позже.",
    adminReviewPrefix: "Лот готов к проверке админом.",
    adminReviewPricePrefix: "Цена лота установлена. Проверьте вручную.",
    adminReviewNewPrefix: "Новая заявка на лот ожидает проверки.",
    adminReviewTitle: "Лот: {listingId}\nПродавец: {seller}\nПодарок: {name}\nКоллекция: {collection}\nМодель: {model}\nСимвол: {symbol}\nФон: {backdrop}\nСсылка: {giftLink}\nЦена: {price}",
    approveButton: "Одобрить лот",
    rejectButton: "Отклонить лот",
    receivedButton: "Я получил подарок",
    disputeButton: "Сообщить о проблеме",
    payoutButton: "Отметить выплату",
    listingApprovedSeller: "Ваш лот {listingId} одобрен.{priceHint}",
    setPriceHint: " Укажите цену: /price {listingId} <amountTon>",
    listingRejectedSeller: "Ваш лот {listingId} отклонён после проверки админа.",
    adminApproved: "Лот {listingId} одобрен.",
    adminRejected: "Лот {listingId} отклонён.",
    cbApproved: "Лот одобрен.",
    cbRejected: "Лот отклонён.",
    cbReceived: "Получение подтверждено.",
    cbDispute: "Проблема отправлена админу.",
    cbPayout: "Выплата отмечена.",
    buyerConfirmedAdmin: "Покупатель подтвердил получение. Отправьте выплату продавцу.\n\nЗаказ: {orderId}\nПокупатель: {buyer}\nЛоты: {listings}",
    buyerConfirmedAdminWithPayout: "Покупатель подтвердил получение. Теперь можно отправить выплату.\n\nЗаказ: {orderId}\nПокупатель: {buyer}\nЛоты: {listings}\nАдрес выплаты продавцу: {payoutAddress}",
    buyerConfirmedAdminNoPayout: "Покупатель подтвердил получение. Ожидаем адрес выплаты продавца.\n\nЗаказ: {orderId}\nПокупатель: {buyer}\nЛоты: {listings}",
    buyerConfirmedSeller: "Покупатель подтвердил получение {name}. Ожидаем выплату админа.",
    disputedAdmin: "Покупатель сообщил о проблеме. Нужна ручная проверка.\n\nЗаказ: {orderId}\nПокупатель: {buyer}\nЛоты: {listings}",
    payoutSentSeller: "Выплата отправлена за {name}.",
    orderCompletedBuyer: "Заказ {orderId} завершён.",
    paidSeller: "У вашего подарка появился покупатель.\n\nПодарок: {name}\nЗаказ: {orderId}\nПокупатель: {buyer}\n\nПожалуйста, отправьте Telegram-подарок этому покупателю.\nПосле отправки пришлите сюда адрес кошелька для выплаты.",
    paidAdmin: "✅ Оплата получена\n\nЗаказ: {orderId}\nПодарок: {giftLines}\nПродавец: {seller}\nПокупатель: {buyer}\nСумма оплаты: {amount}\nМетод оплаты: {paymentMethod}\ntransferStatus = pending_manual_transfer\npayoutStatus = waiting_seller_wallet",
    paidBuyer: "Оплата получена. Продавец получил уведомление отправить подарок.\n\nПодарок: {giftNames}\nЗаказ: {orderId}",
    payoutAddressReceivedSeller: "Адрес выплаты получен. Ожидаем подтверждение покупателя.",
    payoutAddressReceivedSellerReady: "Адрес выплаты получен. Покупатель уже подтвердил получение, выплата ожидает админа.",
    payoutAddressReceivedAdmin: "Адрес выплаты продавца получен\n\nЗаказ: {orderId}\nПродавец: {seller}\nАдрес выплаты: {payoutAddress}\nСумма к выплате: {amount}\nПодтверждение покупателя: {buyerConfirmation}",
    buyerConfirmedYes: "подтверждено",
    buyerConfirmedNo: "пока не подтверждено",
    payoutRequiresBuyer: "Для выплаты сначала нужно подтверждение покупателя.",
    payoutRequiresAddress: "Для выплаты нужен адрес выплаты продавца.",
  },
};

function adminChatId() {
  return String(process.env.ADMIN_CHAT_ID || "").trim();
}

function normalizeBotLang(lang) {
  return lang === "ru" ? "ru" : "en";
}

function tr(lang, key, vars = {}) {
  const pack = BOT_I18N[normalizeBotLang(lang)] || BOT_I18N.en;
  const raw = pack[key] ?? BOT_I18N.en[key] ?? key;
  const text = Array.isArray(raw) ? raw.join("\n") : String(raw);
  return text.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ""));
}

function languageKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🇷🇺 Русский", callback_data: "lang:ru" }],
      [{ text: "🇺🇸 English", callback_data: "lang:en" }],
    ],
  };
}

async function getUserLanguage(telegramId) {
  const id = String(telegramId || "").trim();
  if (!id) return "en";
  if (languageCache.has(id)) return languageCache.get(id);
  try {
    const user = await User.findOne({ telegramId: id }).lean();
    const lang = user?.languageCode === "ru" ? "ru" : user?.languageCode === "en" ? "en" : "";
    if (lang) {
      languageCache.set(id, lang);
      return lang;
    }
  } catch (e) {
    console.warn("[telegram] language lookup failed:", e?.message || e);
  }
  return "";
}

async function getUserLanguageOrDefault(telegramId) {
  return normalizeBotLang((await getUserLanguage(telegramId)) || "en");
}

async function setUserLanguage(telegramUser, lang) {
  const id = String(telegramUser?.id || telegramUser || "").trim();
  const languageCode = normalizeBotLang(lang);
  if (!id) return languageCode;
  languageCache.set(id, languageCode);
  try {
    await User.findOneAndUpdate(
      { telegramId: id },
      {
        $set: {
          telegramId: id,
          username: String(telegramUser?.username || "").trim(),
          firstName: String(telegramUser?.first_name || "").trim(),
          lastName: String(telegramUser?.last_name || "").trim(),
          languageCode,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (e) {
    console.warn("[telegram] language save failed:", e?.message || e);
  }
  return languageCode;
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

function parsePayoutAddress(text) {
  const s = String(text || "").trim();
  if (!s || s.length < 12 || s.length > 300) return "";
  if (/^https?:\/\//i.test(s) || extractGiftLink(s) || s.startsWith("/")) return "";
  if (/^[UE]Q[A-Za-z0-9_-]{46,}$/.test(s)) return s;
  if (/^[A-Za-z0-9_-]{32,}$/.test(s)) return s;
  if (/\b(card|humo|uzcard|payme|click|visa|mastercard|карта|кошел|wallet)\b/i.test(s)) return s;
  return "";
}

function paymentMethodLabel(order) {
  if (order.paymentMethod === "card") {
    return order.cardProvider === "payme" ? "Payme / Humo / Uzcard" : "Click / Humo / Uzcard";
  }
  return "TON Wallet";
}

function amountPaidLabel(order) {
  const ton = Number(order.totalTon);
  const uzs = Number(order.totalUzs);
  if (order.paymentMethod === "card" && Number.isFinite(uzs) && uzs > 0) {
    return `${Math.round(uzs).toLocaleString("en-US").replace(/,/g, " ")} UZS (${ton} TON)`;
  }
  return `${ton} TON`;
}

function adminReviewKeyboard(listingId, lang = "en") {
  return {
    inline_keyboard: [
      [
        { text: tr(lang, "approveButton"), callback_data: `admin_approve:${listingId}` },
        { text: tr(lang, "rejectButton"), callback_data: `admin_reject:${listingId}` },
      ],
    ],
  };
}

function buyerReceiptKeyboard(orderId, lang = "en") {
  return {
    inline_keyboard: [
      [
        { text: tr(lang, "receivedButton"), callback_data: `buyer_received:${orderId}` },
        { text: tr(lang, "disputeButton"), callback_data: `buyer_dispute:${orderId}` },
      ],
    ],
  };
}

function adminPayoutKeyboard(orderId, lang = "en") {
  return {
    inline_keyboard: [[{ text: tr(lang, "payoutButton"), callback_data: `admin_payout:${orderId}` }]],
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

async function notifyAdminListingReview(gift, { prefix = "" } = {}) {
  const lang = await getUserLanguageOrDefault(adminChatId());
  await notifyAdmin(
    [
      prefix || tr(lang, "adminReviewPrefix"),
      "",
      tr(lang, "adminReviewTitle", {
        listingId: gift.listingId,
        seller: displayTelegramUser({ id: gift.sellerTelegramId, username: gift.sellerUsername }),
        name: gift.name,
        collection: gift.collection,
        model: gift.model || "—",
        symbol: gift.symbol || "—",
        backdrop: gift.backdrop || "—",
        giftLink: gift.giftLink,
        price: gift.priceTon > 0 ? `${gift.priceTon} TON` : "not set",
      }),
    ].join("\n"),
    { reply_markup: adminReviewKeyboard(gift.listingId, lang) }
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
  const lang = await getUserLanguageOrDefault(sellerTelegramId);
  if (!price) return { error: tr(lang, "sendPriceLike") };

  const gift = await Gift.findOne({
    listingSource: "manual_admin_verified",
    sellerTelegramId: String(sellerTelegramId || "").trim(),
    status: { $in: ["pending_admin_review", "listed"] },
    verificationStatus: { $in: ["pending_admin_review", "admin_verified"] },
  }).sort({ updatedAt: -1 });

  if (!gift) {
    return { error: tr(lang, "noPendingListing") };
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
  const hasPayoutAddress = Boolean(String(order.sellerPayoutAddress || "").trim());
  order.status = "buyer_confirmed";
  order.transferStatus = "buyer_confirmed_received";
  order.payoutStatus = hasPayoutAddress ? "pending_admin_payout" : "waiting_seller_wallet";
  await order.save();

  await Gift.updateMany(
    { listingId: { $in: order.listingIds } },
    {
      $set: {
        status: "completed_pending_payout",
        transferStatus: "buyer_confirmed_received",
        payoutStatus: hasPayoutAddress ? "pending_admin_payout" : "waiting_seller_wallet",
      },
    }
  );

  const gifts = await Gift.find({ listingId: { $in: order.listingIds } });
  const adminLang = await getUserLanguageOrDefault(adminChatId());
  const adminMessageKey = hasPayoutAddress ? "buyerConfirmedAdminWithPayout" : "buyerConfirmedAdminNoPayout";
  await notifyAdmin(
    tr(adminLang, adminMessageKey, {
      orderId: order.orderId,
      buyer: displayTelegramUser({ id: order.buyerTelegramId, username: order.buyerUsername }),
      listings: order.listingIds.join(", "),
      payoutAddress: order.sellerPayoutAddress || "—",
    }),
    hasPayoutAddress ? { reply_markup: adminPayoutKeyboard(order.orderId, adminLang) } : {}
  );
  for (const gift of gifts) {
    const sellerLang = await getUserLanguageOrDefault(gift.sellerTelegramId);
    await notifyChat(gift.sellerTelegramId, tr(sellerLang, "buyerConfirmedSeller", { name: gift.name }));
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
  const gifts = await Gift.find({ listingId: { $in: order.listingIds } });
  const seller = gifts[0]
    ? displayTelegramUser({ id: gifts[0].sellerTelegramId || gifts[0].escrowOwnerTelegramId, username: gifts[0].sellerUsername })
    : displayTelegramUser({ id: order.sellerTelegramId, username: order.sellerUsername });
  const adminLang = await getUserLanguageOrDefault(adminChatId());
  await notifyAdmin(tr(adminLang, "disputedAdmin", {
    orderId: order.orderId,
    buyer: displayTelegramUser({ id: order.buyerTelegramId, username: order.buyerUsername }),
    listings: `${order.listingIds.join(", ")}\nSeller: ${seller}`,
  }));
}

async function markPayoutSent(orderId) {
  const order = await Order.findOne({ orderId: String(orderId || "").trim() });
  if (!order) throw new Error("Order not found.");
  if (order.status !== "buyer_confirmed") {
    const lang = await getUserLanguageOrDefault(adminChatId());
    throw new Error(tr(lang, "payoutRequiresBuyer"));
  }
  if (!String(order.sellerPayoutAddress || "").trim()) {
    const lang = await getUserLanguageOrDefault(adminChatId());
    throw new Error(tr(lang, "payoutRequiresAddress"));
  }

  order.status = "completed";
  order.payoutStatus = "paid";
  order.completedAt = new Date();
  await order.save();
  const gifts = await Gift.find({ listingId: { $in: order.listingIds } });
  for (const gift of gifts) {
    gift.status = "completed";
    gift.payoutStatus = "paid";
    gift.completedAt = order.completedAt;
    await gift.save();
    const sellerLang = await getUserLanguageOrDefault(gift.sellerTelegramId);
    await notifyChat(gift.sellerTelegramId, tr(sellerLang, "payoutSentSeller", { name: gift.name }));
  }
  const buyerLang = await getUserLanguageOrDefault(order.buyerTelegramId);
  await notifyChat(order.buyerTelegramId, tr(buyerLang, "orderCompletedBuyer", { orderId: order.orderId }));
}

async function collectSellerPayoutAddress({ sellerTelegramId, payoutAddress }) {
  const gift = await Gift.findOne({
    sellerTelegramId: String(sellerTelegramId || "").trim(),
    status: { $in: ["awaiting_seller_transfer", "completed_pending_payout"] },
    transferStatus: { $in: ["pending_manual_transfer", "buyer_confirmed_received"] },
    payoutStatus: { $in: ["waiting_seller_wallet", "waiting_buyer_confirmation", "pending_admin_payout"] },
    orderId: { $ne: "" },
  }).sort({ paidAt: -1, updatedAt: -1 });

  if (!gift) return { ok: false };

  const order = await Order.findOne({ orderId: gift.orderId });
  if (!order) return { ok: false };

  const buyerConfirmed = order.status === "buyer_confirmed" || order.transferStatus === "buyer_confirmed_received";
  const payoutStatus = buyerConfirmed ? "pending_admin_payout" : "waiting_buyer_confirmation";
  const receivedAt = new Date();

  order.sellerTelegramId = gift.sellerTelegramId || order.sellerTelegramId || "";
  order.sellerUsername = gift.sellerUsername || order.sellerUsername || "";
  order.sellerPayoutAddress = payoutAddress;
  order.sellerPayoutAddressReceivedAt = receivedAt;
  order.payoutStatus = payoutStatus;
  await order.save();

  await Gift.updateMany(
    { listingId: { $in: order.listingIds }, sellerTelegramId: gift.sellerTelegramId },
    { $set: { sellerPayoutAddress: payoutAddress, payoutStatus } }
  );

  const sellerLang = await getUserLanguageOrDefault(sellerTelegramId);
  await notifyChat(
    sellerTelegramId,
    tr(sellerLang, buyerConfirmed ? "payoutAddressReceivedSellerReady" : "payoutAddressReceivedSeller")
  );

  const adminLang = await getUserLanguageOrDefault(adminChatId());
  await notifyAdmin(
    tr(adminLang, "payoutAddressReceivedAdmin", {
      orderId: order.orderId,
      seller: displayTelegramUser({ id: order.sellerTelegramId, username: order.sellerUsername }),
      payoutAddress,
      amount: amountPaidLabel(order),
      buyerConfirmation: tr(adminLang, buyerConfirmed ? "buyerConfirmedYes" : "buyerConfirmedNo"),
    }),
    buyerConfirmed ? { reply_markup: adminPayoutKeyboard(order.orderId, adminLang) } : {}
  );

  return { ok: true, order };
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

  bot.onText(/\/start/, async (msg) => {
    const selected = await getUserLanguage(String(msg.from?.id || msg.chat.id || ""));
    if (!selected) {
      await bot.sendMessage(msg.chat.id, BOT_I18N.en.languagePrompt, { reply_markup: languageKeyboard() }).catch((e) => {
        console.error("[telegram] sendMessage failed:", e?.message || e);
      });
      return;
    }

    bot.sendMessage(msg.chat.id, tr(selected, "start")).catch((e) => {
      console.error("[telegram] sendMessage failed:", e?.message || e);
    });
  });

  bot.onText(/\/language/, async (msg) => {
    const lang = await getUserLanguageOrDefault(String(msg.from?.id || msg.chat.id || ""));
    bot.sendMessage(msg.chat.id, tr(lang, "languagePrompt"), { reply_markup: languageKeyboard() }).catch((e) => {
      console.error("[telegram] sendMessage failed:", e?.message || e);
    });
  });

  bot.onText(/\/help/, async (msg) => {
    const lang = await getUserLanguageOrDefault(String(msg.from?.id || msg.chat.id || ""));
    bot.sendMessage(
      msg.chat.id,
      tr(lang, "help")
    ).catch((e) => console.error("[telegram] sendMessage failed:", e?.message || e));
  });

  bot.onText(/\/sell/, async (msg) => {
    const lang = await getUserLanguageOrDefault(String(msg.from?.id || msg.chat.id || ""));
    bot.sendMessage(
      msg.chat.id,
      tr(lang, "sell")
    ).catch((e) => console.error("[telegram] sendMessage failed:", e?.message || e));
  });

  bot.onText(/\/price\s+(\S+)\s+([0-9]+(?:\.[0-9]+)?)/, async (msg, match) => {
    const listingId = match?.[1] || "";
    const priceTon = match?.[2] || "";
    const lang = await getUserLanguageOrDefault(String(msg.from?.id || msg.chat.id || ""));
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
        tr(lang, "listingPriceSet", {
          listingId: result.gift.listingId,
          price: result.gift.priceTon,
          state: result.gift.status === "listed" ? tr(lang, "listingLive") : tr(lang, "waitingReview"),
        })
      );
      if (result.gift.listingSource === "manual_admin_verified") {
        const adminLang = await getUserLanguageOrDefault(adminChatId());
        await notifyAdminListingReview(result.gift, { prefix: tr(adminLang, "adminReviewPricePrefix") });
      }
    } catch (e) {
      console.error("[telegram] /price failed:", e);
      await bot.sendMessage(msg.chat.id, tr(lang, "priceSetFailed"));
    }
  });

  bot.onText(/\/received\s+(\S+)/, async (msg, match) => {
    const lang = await getUserLanguageOrDefault(String(msg.from?.id || msg.chat.id || ""));
    try {
      const orderId = match?.[1] || "";
      const order = await Order.findOne({ orderId });
      if (!order) {
        await bot.sendMessage(msg.chat.id, tr(lang, "orderNotFound"));
        return;
      }
      if (String(msg.from?.id || "") !== String(order.buyerTelegramId || "")) {
        await bot.sendMessage(msg.chat.id, tr(lang, "onlyBuyerReceived"));
        return;
      }
      await markBuyerReceived(order);
      await bot.sendMessage(msg.chat.id, tr(lang, "receiptConfirmed"));
    } catch (e) {
      console.error("[telegram] /received failed:", e);
      await bot.sendMessage(msg.chat.id, tr(lang, "receivedFailed"));
    }
  });

  bot.onText(/\/dispute\s+(\S+)/, async (msg, match) => {
    const lang = await getUserLanguageOrDefault(String(msg.from?.id || msg.chat.id || ""));
    try {
      const orderId = match?.[1] || "";
      const order = await Order.findOne({ orderId });
      if (!order) {
        await bot.sendMessage(msg.chat.id, tr(lang, "orderNotFound"));
        return;
      }
      if (String(msg.from?.id || "") !== String(order.buyerTelegramId || "")) {
        await bot.sendMessage(msg.chat.id, tr(lang, "onlyBuyerDispute"));
        return;
      }
      await markOrderDisputed(order);
      await bot.sendMessage(msg.chat.id, tr(lang, "issueReported"));
    } catch (e) {
      console.error("[telegram] /dispute failed:", e);
      await bot.sendMessage(msg.chat.id, tr(lang, "disputeFailed"));
    }
  });

  bot.on("message", async (msg) => {
    try {
      const text = String(msg.text || "");
      if (!text || text.startsWith("/")) return;
      const lang = await getUserLanguageOrDefault(String(msg.from?.id || msg.chat.id || ""));
      const giftLink = extractGiftLink(text);
      if (!giftLink) {
        const amount = parseStandaloneTonAmount(text);
        if (!amount) {
          const payoutAddress = parsePayoutAddress(text);
          if (!payoutAddress) return;
          const collected = await collectSellerPayoutAddress({
            sellerTelegramId: String(msg.from?.id || ""),
            payoutAddress,
          });
          if (collected.ok) return;
          return;
        }

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
          tr(lang, "priceSet", { price: result.gift.priceTon })
        );
        const adminLang = await getUserLanguageOrDefault(adminChatId());
        await notifyAdminListingReview(result.gift, { prefix: tr(adminLang, "adminReviewPricePrefix") });
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
        await bot.sendMessage(msg.chat.id, tr(lang, "giftResolveFailed", { error: result.error }));
        return;
      }

      const gift = result.gift;
      if (gift.priceTon > 0) {
        await bot.sendMessage(
          msg.chat.id,
          tr(lang, "giftDetectedWithPrice", { name: gift.name, price: gift.priceTon })
        );
        const adminLang = await getUserLanguageOrDefault(adminChatId());
        await notifyAdminListingReview(gift, { prefix: tr(adminLang, "adminReviewNewPrefix") });
        return;
      }

      await bot.sendMessage(
        msg.chat.id,
        tr(lang, "giftDetectedAskPrice", { name: gift.name })
      );
    } catch (e) {
      console.error("[telegram] gift link intake failed:", e);
      const lang = await getUserLanguageOrDefault(String(msg.from?.id || msg.chat.id || ""));
      await bot.sendMessage(msg.chat.id, tr(lang, "processGiftFailed"));
    }
  });

  bot.on("callback_query", async (query) => {
    const data = String(query.data || "");
    try {
      if (data.startsWith("lang:")) {
        const lang = await setUserLanguage(query.from, data.slice("lang:".length));
        await bot.answerCallbackQuery(query.id, { text: tr(lang, "languageSaved") });
        await bot.sendMessage(query.message.chat.id, tr(lang, "start"));
        return;
      }

      if (data.startsWith("admin_approve:")) {
        assertAdminCallback(query);
        const adminLang = await getUserLanguageOrDefault(String(query.from?.id || query.message?.chat?.id || ""));
        const listingId = data.slice("admin_approve:".length);
        const gift = await Gift.findOne({ listingId, status: "pending_admin_review" });
        if (!gift) throw new Error("Listing request not found or already reviewed.");
        gift.listingSource = "manual_admin_verified";
        gift.status = "listed";
        gift.verificationStatus = "admin_verified";
        gift.transferStatus = "not_started";
        gift.payoutStatus = "not_ready";
        await gift.save();
        const sellerLang = await getUserLanguageOrDefault(gift.sellerTelegramId);
        await notifyChat(gift.sellerTelegramId, tr(sellerLang, "listingApprovedSeller", {
          listingId: gift.listingId,
          priceHint: gift.priceTon > 0 ? "" : tr(sellerLang, "setPriceHint", { listingId: gift.listingId }),
        }));
        await bot.answerCallbackQuery(query.id, { text: tr(adminLang, "cbApproved") });
        await bot.sendMessage(query.message.chat.id, tr(adminLang, "adminApproved", { listingId: gift.listingId }));
        return;
      }

      if (data.startsWith("admin_reject:")) {
        assertAdminCallback(query);
        const adminLang = await getUserLanguageOrDefault(String(query.from?.id || query.message?.chat?.id || ""));
        const listingId = data.slice("admin_reject:".length);
        const gift = await Gift.findOne({ listingId, status: "pending_admin_review" });
        if (!gift) throw new Error("Listing request not found or already reviewed.");
        gift.status = "rejected";
        gift.verificationStatus = "rejected";
        await gift.save();
        const sellerLang = await getUserLanguageOrDefault(gift.sellerTelegramId);
        await notifyChat(gift.sellerTelegramId, tr(sellerLang, "listingRejectedSeller", { listingId: gift.listingId }));
        await bot.answerCallbackQuery(query.id, { text: tr(adminLang, "cbRejected") });
        await bot.sendMessage(query.message.chat.id, tr(adminLang, "adminRejected", { listingId: gift.listingId }));
        return;
      }

      if (data.startsWith("buyer_received:")) {
        const lang = await getUserLanguageOrDefault(String(query.from?.id || ""));
        const orderId = data.slice("buyer_received:".length);
        const order = await Order.findOne({ orderId });
        if (!order) throw new Error("Order not found.");
        if (String(query.from?.id || "") !== String(order.buyerTelegramId || "")) {
          throw new Error("Only the buyer can confirm receipt.");
        }
        await markBuyerReceived(order);
        await bot.answerCallbackQuery(query.id, { text: tr(lang, "cbReceived") });
        return;
      }

      if (data.startsWith("buyer_dispute:")) {
        const lang = await getUserLanguageOrDefault(String(query.from?.id || ""));
        const orderId = data.slice("buyer_dispute:".length);
        const order = await Order.findOne({ orderId });
        if (!order) throw new Error("Order not found.");
        if (String(query.from?.id || "") !== String(order.buyerTelegramId || "")) {
          throw new Error("Only the buyer can report an issue.");
        }
        await markOrderDisputed(order);
        await bot.answerCallbackQuery(query.id, { text: tr(lang, "cbDispute") });
        return;
      }

      if (data.startsWith("admin_payout:")) {
        assertAdminCallback(query);
        const lang = await getUserLanguageOrDefault(String(query.from?.id || query.message?.chat?.id || ""));
        const orderId = data.slice("admin_payout:".length);
        await markPayoutSent(orderId);
        await bot.answerCallbackQuery(query.id, { text: tr(lang, "cbPayout") });
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
  const giftList = Array.isArray(gifts) ? gifts : [];
  const giftLines = giftList.map((g) => `${g.name} / ${g.listingId}`).join("\n");
  const giftNames = giftList.map((g) => g.name).join(", ");
  const firstGift = giftList[0];
  const seller = firstGift
    ? displayTelegramUser({ id: firstGift.sellerTelegramId || firstGift.escrowOwnerTelegramId || order.sellerTelegramId, username: firstGift.sellerUsername || order.sellerUsername })
    : displayTelegramUser({ id: order.sellerTelegramId, username: order.sellerUsername });
  for (const gift of gifts || []) {
    const sellerLang = await getUserLanguageOrDefault(gift.sellerTelegramId || gift.escrowOwnerTelegramId);
    await notifyChat(
      gift.sellerTelegramId || gift.escrowOwnerTelegramId,
      tr(sellerLang, "paidSeller", {
        name: gift.name,
        orderId: order.orderId,
        buyer,
      })
    );
  }
  const adminLang = await getUserLanguageOrDefault(adminChatId());
  await notifyAdmin(tr(adminLang, "paidAdmin", {
    orderId: order.orderId,
    buyer,
    seller,
    giftLines,
    amount: amountPaidLabel(order),
    paymentMethod: paymentMethodLabel(order),
  }));
  const buyerLang = await getUserLanguageOrDefault(order.buyerTelegramId);
  await notifyChat(
    order.buyerTelegramId,
    tr(buyerLang, "paidBuyer", { orderId: order.orderId, giftNames }),
    { reply_markup: buyerReceiptKeyboard(order.orderId, buyerLang) }
  );
}
