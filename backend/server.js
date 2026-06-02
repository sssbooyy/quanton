import crypto from "crypto";
import express from "express";
import dotenv from "dotenv";
import axios from "axios";
import {
  getTelegramWebhookInfo,
  confirmAdminTonPayment,
  handleManualEscrowAfterPayment,
  handleTelegramWebhookUpdate,
  initTelegramBot,
  notifyAdminPaymentClaim,
  rejectAdminTonPayment,
  sendAdminAlert,
  stopTelegramBot,
} from "./services/telegramBot.js";
import {
  PORT,
  isProduction,
  METADATA_SYNC_SECRET,
  CLEAR_LISTINGS_SECRET,
  MARKETPLACE_WALLET_ADDRESS,
  ESCROW_INTAKE_SECRET,
  ENABLE_MANUAL_LISTING_FALLBACK,
  CARD_PAYMENT_TEST_MODE,
  CARD_PROVIDER_CLICK_ENABLED,
  CARD_PROVIDER_PAYME_ENABLED,
  AUTO_TON_VERIFY,
} from "./config.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { connectMongo, disconnectMongo, isMongoConnected } from "./db/connect.js";
import { Gift } from "./models/Gift.js";
import { Order } from "./models/Order.js";
import { findMatchingIncomingPayment, validateMarketplaceWallet } from "./services/tonPayments.js";
import {
  assertDebugProvidersAllowed,
  getProvidersDebugResponse,
} from "./services/providerDebug.js";
import {
  createGiftFromBody,
  giftToApiResponse,
  listGiftsForApi,
  listUndervaluedForApi,
  seedGiftsFromJsonIfEmpty,
} from "./services/giftApi.js";
import { refreshGiftByListingId, syncStaleGiftMetadata } from "./services/metadataRefresh.js";
import {
  createEscrowListingFromOwnedGift,
  setEscrowListingPrice,
  syncBusinessGifts,
  verifyGiftHeldByBusinessAccount,
} from "./services/telegramGiftEscrow.js";
import { searchAggregator } from "./services/giftAggregator.js";
dotenv.config();

const app = express();
const rateCache = { data: null, updatedAtMs: 0 };
const RATE_TTL_MS = 10 * 60 * 1000;
const CARD_PROVIDERS = new Set(["click", "payme"]);

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(createCorsMiddleware());
app.use(express.json({ limit: "512kb" }));

/** Batch/single metadata refresh: require secret in production; dev allows open calls when unset. */
function assertMetadataJobAllowed(req, res) {
  if (METADATA_SYNC_SECRET) {
    const h = String(req.headers["x-metadata-sync-secret"] ?? "").trim();
    const auth = String(req.headers.authorization ?? "").trim();
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (h === METADATA_SYNC_SECRET || bearer === METADATA_SYNC_SECRET) return true;
    res.status(401).json({ error: "Invalid or missing metadata sync credentials." });
    return false;
  }
  if (isProduction) {
    res.status(503).json({
      error: "Set METADATA_SYNC_SECRET to enable metadata refresh endpoints in production.",
    });
    return false;
  }
  return true;
}

async function getTonUzsRateData() {
  if (rateCache.data && Date.now() - rateCache.updatedAtMs < RATE_TTL_MS) {
    return rateCache.data;
  }

  try {
    const [tonRes, uzsRes] = await Promise.all([
      axios.get("https://api.coingecko.com/api/v3/simple/price", {
        timeout: 10_000,
        params: { ids: "the-open-network", vs_currencies: "usd" },
      }),
      axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 10_000 }),
    ]);

    const tonUsd = Number(tonRes.data?.["the-open-network"]?.usd);
    const usdUzs = Number(uzsRes.data?.rates?.UZS);
    if (!Number.isFinite(tonUsd) || tonUsd <= 0 || !Number.isFinite(usdUzs) || usdUzs <= 0) {
      throw new Error("Invalid rate provider response.");
    }

    const data = {
      tonUsd,
      usdUzs,
      tonUzs: Math.round(tonUsd * usdUzs),
      updatedAt: new Date().toISOString(),
    };
    rateCache.data = data;
    rateCache.updatedAtMs = Date.now();
    return data;
  } catch (e) {
    if (rateCache.data) return { ...rateCache.data, stale: true };
    throw e;
  }
}

app.get("/health", (_req, res) => {
  const mongoReady = isMongoConnected();
  const storage = isProduction
    ? { mongo: mongoReady }
    : { mongo: mongoReady };

  res.json({
    ok: true,
    service: "quanton-market-api",
    time: new Date().toISOString(),
    uptime: process.uptime(),
    env: isProduction ? "production" : "development",
    storage,
  });
});

app.get("/debug/providers", async (req, res, next) => {
  try {
    if (!assertDebugProvidersAllowed(req, res)) return;
    const runProbe = String(req.query.probe ?? "").trim() === "1";
    res.set("Cache-Control", "no-store");
    res.json(await getProvidersDebugResponse({ runProbe }));
  } catch (e) {
    next(e);
  }
});

function telegramUpdateType(update) {
  if (!update || typeof update !== "object") return "invalid";
  return Object.keys(update).find((k) => k !== "update_id") || "unknown";
}

app.get("/telegram/webhook-info", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "no-store");
    res.json(await getTelegramWebhookInfo());
  } catch (e) {
    next(e);
  }
});

app.post("/telegram/webhook", (req, res) => {
  const update = req.body;
  const updateType = telegramUpdateType(update);
  const message = update?.message || update?.business_message || update?.edited_message || update?.edited_business_message;
  const callbackData = update?.callback_query?.data;
  console.log("[telegram] webhook update received", {
    updateId: update?.update_id,
    updateType,
    messageText: typeof message?.text === "string" ? message.text.slice(0, 300) : "",
    callbackData: typeof callbackData === "string" ? callbackData.slice(0, 300) : "",
  });
  res.sendStatus(200);

  try {
    const ok = setImmediate(() => {
      const processed = handleTelegramWebhookUpdate(update);
      if (!processed) {
        console.error("[telegram] webhook update processing failed", {
          updateId: update?.update_id,
          updateType,
        });
      }
    });
    void ok;
  } catch (e) {
    console.error("[telegram] webhook endpoint scheduling error:", e?.message || e);
  }
});

app.get("/gifts", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=45, stale-while-revalidate=300");
    res.json(await listGiftsForApi());
  } catch (e) {
    next(e);
  }
});

app.get("/gifts/undervalued", async (_req, res, next) => {
  try {
    res.set("Cache-Control", "public, max-age=45, stale-while-revalidate=300");
    res.json(await listUndervaluedForApi());
  } catch (e) {
    next(e);
  }
});

app.get("/rates/ton-uzs", async (_req, res, next) => {
  try {
    const data = await getTonUzsRateData();
    res.set("Cache-Control", "public, max-age=300");
    res.json(data);
  } catch (e) {
    next(e);
  }
});

app.post("/alerts/test", async (req, res, next) => {
  try {
    const enriched = await listGiftsForApi();

    if (!enriched.length) {
      return res.status(400).json({
        error: "No listings on file. Add a listing before sending a test alert.",
      });
    }

    const bestGift = [...enriched].sort((a, b) => b.aiScore - a.aiScore)[0];

    const message = `🚨 <b>Quanton Market — desk alert</b>\n\n🎁 ${bestGift.name}\n💎 Ask: ${bestGift.priceTon} TON\n📊 Floor: ${bestGift.floorTon} TON\n🤖 Model score: ${bestGift.aiScore}/100\n📈 vs floor: ${bestGift.undervaluedPercent}%\n⚡ Signal: ${bestGift.signal}`;

    await sendAdminAlert(message);

    res.json({ ok: true, sent: true, gift: bestGift });
  } catch (e) {
    next(e);
  }
});

app.post("/gifts", async (req, res, next) => {
  try {
    if (!ENABLE_MANUAL_LISTING_FALLBACK) {
      return res.status(410).json({ error: "Manual listing is disabled. Send the Telegram gift to the Quanton bot for escrow listing." });
    }
    const suffix = crypto.randomBytes(3).toString("hex");
    const result = await createGiftFromBody(req.body, suffix);
    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    res.status(201).json(giftToApiResponse(result.gift));
  } catch (e) {
    next(e);
  }
});

app.get("/aggregator/search", async (req, res, next) => {
  try {
    const result = await searchAggregator({
      q: req.query.q,
      collection: req.query.collection,
      model: req.query.model,
      symbol: req.query.symbol,
      backdrop: req.query.backdrop,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      sort: req.query.sort,
      limit: req.query.limit,
    });
    res.set("Cache-Control", "public, max-age=20, stale-while-revalidate=60");
    res.json(result);
  } catch (e) {
    next(e);
  }
});

function assertEscrowIntakeAllowed(req, res) {
  if (ESCROW_INTAKE_SECRET) {
    const h = String(req.headers["x-escrow-intake-secret"] ?? "").trim();
    const auth = String(req.headers.authorization ?? "").trim();
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (h === ESCROW_INTAKE_SECRET || bearer === ESCROW_INTAKE_SECRET) return true;
    res.status(401).json({ error: "Invalid or missing escrow intake credentials." });
    return false;
  }
  if (isProduction) {
    res.status(503).json({ error: "Set ESCROW_INTAKE_SECRET to enable escrow intake in production." });
    return false;
  }
  return true;
}

app.post("/escrow/intake/dev", async (req, res, next) => {
  try {
    if (!assertEscrowIntakeAllowed(req, res)) return;
    const result = await createEscrowListingFromOwnedGift(req.body);
    if (result.error) return res.status(result.error.status).json(result.error.body);
    res.status(201).json({ ok: true, gift: giftToApiResponse(result.gift), escrow: result.escrow, verification: result.verification });
  } catch (e) {
    next(e);
  }
});

app.post("/escrow/:listingId/price", async (req, res, next) => {
  try {
    const result = await setEscrowListingPrice({
      listingId: req.params.listingId,
      sellerTelegramId: req.body?.sellerTelegramId,
      priceTon: req.body?.priceTon,
    });
    if (result.error) return res.status(result.error.status).json(result.error.body);
    res.json({ ok: true, gift: giftToApiResponse(result.gift), escrow: result.escrow });
  } catch (e) {
    next(e);
  }
});

app.post("/escrow/:listingId/verify", async (req, res, next) => {
  try {
    const gift = await Gift.findOne({ listingId: String(req.params.listingId || "").trim() });
    if (!gift) return res.status(404).json({ error: "Listing not found." });
    const verification = await verifyGiftHeldByBusinessAccount({ ownedGiftId: gift.ownedGiftId });
    if (!verification.ok) return res.status(verification.status || 400).json({ error: verification.error });
    if (gift.escrowStatus === "pending_verification") {
      gift.escrowStatus = gift.priceTon > 0 ? "listed" : "escrowed";
      gift.status = gift.priceTon > 0 ? "approved" : "pending";
      await gift.save();
    }
    res.json({ ok: true, gift: giftToApiResponse(gift), verification });
  } catch (e) {
    next(e);
  }
});

app.get("/escrow/my-listings", async (req, res, next) => {
  try {
    const sellerTelegramId = String(req.query.sellerTelegramId ?? "").trim();
    if (!sellerTelegramId) return res.status(400).json({ error: "sellerTelegramId is required." });
    const gifts = await Gift.find({ escrowOwnerTelegramId: sellerTelegramId }).sort({ createdAt: -1 });
    res.json(gifts.map((g) => giftToApiResponse(g)));
  } catch (e) {
    next(e);
  }
});

app.post("/escrow/sync-business-gifts", async (req, res, next) => {
  try {
    if (!assertEscrowIntakeAllowed(req, res)) return;
    res.json(await syncBusinessGifts());
  } catch (e) {
    next(e);
  }
});

app.post("/gifts/:listingId/metadata/refresh", async (req, res, next) => {
  try {
    if (!assertMetadataJobAllowed(req, res)) return;
    const listingId = String(req.params.listingId ?? "").trim();
    if (!listingId) {
      return res.status(400).json({ error: "listingId is required." });
    }
    const result = await refreshGiftByListingId(listingId);
    if (result.error) {
      return res.status(result.error.status).json(result.error.body);
    }
    res.json(giftToApiResponse(result.gift));
  } catch (e) {
    next(e);
  }
});

function publicOrder(order) {
  const plain = order && typeof order.toObject === "function" ? order.toObject() : order;
  return {
    orderId: plain.orderId,
    buyerTelegramId: plain.buyerTelegramId || "",
    buyerUsername: plain.buyerUsername || "",
    sellerTelegramId: plain.sellerTelegramId || "",
    sellerUsername: plain.sellerUsername || "",
    sellerPayoutAddress: plain.sellerPayoutAddress || "",
    sellerPayoutAddressReceivedAt: plain.sellerPayoutAddressReceivedAt instanceof Date ? plain.sellerPayoutAddressReceivedAt.toISOString() : plain.sellerPayoutAddressReceivedAt,
    buyerWalletAddress: plain.buyerWalletAddress || "",
    listingIds: plain.listingIds || [],
    totalTon: plain.totalTon,
    totalUzs: plain.totalUzs || 0,
    tonUzsRate: plain.tonUzsRate || 0,
    paymentMethod: plain.paymentMethod || "ton",
    cardProvider: plain.cardProvider || "",
    paymentUrl: plain.paymentUrl || "",
    cardPaymentStatus: plain.cardPaymentStatus || "none",
    paymentReviewStatus: plain.paymentReviewStatus || "none",
    paymentClaimedAt:
      plain.paymentClaimedAt instanceof Date ? plain.paymentClaimedAt.toISOString() : plain.paymentClaimedAt || null,
    walletAppInfo: plain.walletAppInfo || "",
    marketplaceWalletAddress: plain.marketplaceWalletAddress || "",
    status: plain.status,
    txHash: plain.txHash || "",
    payload: plain.payload,
    transferStatus: plain.transferStatus || "none",
    payoutStatus: plain.payoutStatus || "not_ready",
    transferResults: plain.transferResults || [],
    createdAt: plain.createdAt instanceof Date ? plain.createdAt.toISOString() : plain.createdAt,
    paidAt: plain.paidAt instanceof Date ? plain.paidAt.toISOString() : plain.paidAt,
    completedAt: plain.completedAt instanceof Date ? plain.completedAt.toISOString() : plain.completedAt,
  };
}

function normalizeListingIds(v) {
  const arr = Array.isArray(v) ? v : [];
  return [...new Set(arr.map((x) => String(x ?? "").trim()).filter(Boolean))];
}

function isCheckoutAvailable(gift) {
  const status = String(gift?.status || "").toLowerCase();
  const source = String(gift?.listingSource || "manual_url");
  if (source === "manual_admin_verified") {
    return status === "listed" && gift?.verificationStatus === "admin_verified" && Number(gift?.priceTon) > 0;
  }
  if (status !== "approved") return false;
  if (source === "manual_url") return true;
  return source === "escrow" && gift?.escrowStatus === "listed";
}

function reserveQueryForListings(listingIds) {
  return {
    listingId: { $in: listingIds },
    $or: [
      { listingSource: "manual_url", status: "approved" },
      {
        listingSource: "manual_admin_verified",
        status: { $in: ["listed", "approved"] },
        verificationStatus: "admin_verified",
      },
      { listingSource: "escrow", status: "approved", escrowStatus: "listed" },
    ],
  };
}

function resolveBuyerFromRequest(req) {
  const body = req.body || {};
  let buyerTelegramId = String(body.buyerTelegramId ?? "").trim();
  let buyerUsername = String(body.buyerUsername ?? "").replace(/^@/, "").trim();
  const tg = body.telegramUser || body.buyer || {};
  if (!buyerTelegramId && tg?.id) buyerTelegramId = String(tg.id).trim();
  if (!buyerUsername && tg?.username) buyerUsername = String(tg.username).replace(/^@/, "").trim();
  if (!buyerTelegramId) {
    console.warn("[orders] buyerTelegramId missing", {
      hasTelegramUser: Boolean(tg?.id),
      buyerWalletAddress: String(body.buyerWalletAddress ?? "").trim() || "",
    });
  }
  return { buyerTelegramId, buyerUsername };
}

function cardProviderEnabled(provider) {
  if (provider === "click") return CARD_PROVIDER_CLICK_ENABLED;
  if (provider === "payme") return CARD_PROVIDER_PAYME_ENABLED;
  return false;
}

function assertCardTestAllowed(req, res) {
  // SECURITY: fake card payment completion is allowed only in explicit test mode
  // or outside production. Never enable these endpoints for real production money flow.
  if (CARD_PAYMENT_TEST_MODE || !isProduction) return true;
  res.status(403).json({ error: "Card payment test mode is disabled." });
  return false;
}

async function completePaidOrder(order, payment = {}) {
  return handleManualEscrowAfterPayment(order, payment);
}

async function releaseReservedListingsForOrder(order) {
  const listingIds = order?.listingIds || [];
  if (!listingIds.length) return;
  await Gift.updateMany(
    { listingId: { $in: listingIds }, listingSource: "manual_url", status: "reserved", escrowStatus: "reserved" },
    { $set: { status: "approved", escrowStatus: "none" } }
  );
  await Gift.updateMany(
    {
      listingId: { $in: listingIds },
      listingSource: "manual_admin_verified",
      status: "reserved",
      escrowStatus: "reserved",
    },
    { $set: { status: "listed", escrowStatus: "none" } }
  );
  await Gift.updateMany(
    { listingId: { $in: listingIds }, listingSource: "escrow", status: "reserved", escrowStatus: "reserved" },
    { $set: { status: "approved", escrowStatus: "listed" } }
  );
}

app.post("/orders/create", async (req, res, next) => {
  try {
    const paymentMethod = String(req.body?.paymentMethod || "ton").trim().toLowerCase();
    const cardProvider = String(req.body?.cardProvider || "").trim().toLowerCase();
    let tonWallet = null;
    if (paymentMethod === "ton") {
      tonWallet = validateMarketplaceWallet();
      if (tonWallet.error) {
        return res.status(503).json({
          error: tonWallet.error,
          code: tonWallet.code || "INVALID_MARKETPLACE_WALLET_ADDRESS",
        });
      }
    }
    if (paymentMethod === "card") {
      if (!CARD_PROVIDERS.has(cardProvider)) {
        return res.status(400).json({ error: "Unsupported card provider." });
      }
      if (!cardProviderEnabled(cardProvider)) {
        return res.status(503).json({ error: "Provider not configured." });
      }
      if (isProduction && !CARD_PAYMENT_TEST_MODE) {
        return res.status(503).json({ error: "Provider not configured." });
      }
    } else if (paymentMethod !== "ton") {
      return res.status(400).json({ error: "Unsupported payment method." });
    }

    const listingIds = normalizeListingIds(req.body?.listingIds);
    if (!listingIds.length) {
      return res.status(400).json({ error: "At least one listing id is required." });
    }

    const gifts = await Gift.find({ listingId: { $in: listingIds } });
    if (gifts.length !== listingIds.length) {
      return res.status(400).json({ error: "One or more listings were not found." });
    }

    const unavailable = gifts.find((g) => !isCheckoutAvailable(g));
    if (unavailable) {
      return res.status(409).json({ error: `${unavailable.name} is not available for escrow checkout.` });
    }

    const totalTon = Math.round(gifts.reduce((sum, g) => sum + (Number(g.priceTon) || 0), 0) * 1e9) / 1e9;
    if (!Number.isFinite(totalTon) || totalTon <= 0) {
      return res.status(400).json({ error: "Order total must be greater than 0 TON." });
    }

    const orderId = `qton_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
    const payload = `Quanton order ${orderId}`;
    let totalUzs = 0;
    let tonUzsRate = 0;
    let paymentUrl = "";
    if (paymentMethod === "card") {
      const rate = await getTonUzsRateData();
      tonUzsRate = Number(rate.tonUzs) || 0;
      totalUzs = Math.round(totalTon * tonUzsRate);
      paymentUrl = `/payment-test/${encodeURIComponent(orderId)}?provider=${encodeURIComponent(cardProvider)}`;
    }
    const reserveFilter = reserveQueryForListings(listingIds);
    console.log("[orders] reserve listings query", {
      listingIds,
      filter: JSON.stringify(reserveFilter),
    });
    let reserve;
    try {
      reserve = await Gift.updateMany(reserveFilter, { $set: { escrowStatus: "reserved", status: "reserved" } });
    } catch (reserveErr) {
      console.error("[orders] reserve listings failed", {
        listingIds,
        filter: JSON.stringify(reserveFilter),
        error: reserveErr?.message || String(reserveErr),
      });
      throw reserveErr;
    }
    console.log("[orders] reserve listings result", {
      listingIds,
      matchedCount: reserve.matchedCount,
      modifiedCount: reserve.modifiedCount,
      expected: listingIds.length,
    });
    if (reserve.modifiedCount !== listingIds.length) {
      return res.status(409).json({ error: "One or more listings were reserved by another buyer. Please refresh and try again." });
    }

    const { buyerTelegramId, buyerUsername } = resolveBuyerFromRequest(req);
    const primaryGift = gifts[0];
    const tonMarketplaceWallet =
      paymentMethod === "ton" ? String(tonWallet?.friendlyAddress || "").trim() : "";
    const order = await Order.create({
      orderId,
      buyerTelegramId,
      buyerUsername,
      sellerTelegramId: primaryGift?.sellerTelegramId || primaryGift?.escrowOwnerTelegramId || "",
      sellerUsername: primaryGift?.sellerUsername || "",
      buyerWalletAddress: String(req.body?.buyerWalletAddress ?? "").trim(),
      marketplaceWalletAddress: tonMarketplaceWallet,
      listingIds,
      totalTon,
      totalUzs,
      tonUzsRate,
      paymentMethod,
      cardProvider: paymentMethod === "card" ? cardProvider : "",
      paymentUrl,
      cardPaymentStatus: paymentMethod === "card" ? "pending" : "none",
      status: "pending_payment",
      transferStatus: "not_started",
      payoutStatus: "not_ready",
      sellerPayoutAddress: "",
      sellerPayoutAddressReceivedAt: null,
      payload,
    });

    const body = {
      ...publicOrder(order),
      comment: payload,
    };
    if (paymentMethod === "ton") {
      const marketplaceWalletAddress = String(tonWallet?.friendlyAddress || "").trim();
      if (!marketplaceWalletAddress) {
        return res.status(503).json({
          error: "Marketplace wallet address is not available for TON checkout.",
          code: "MARKETPLACE_WALLET_ADDRESS_MISSING",
        });
      }
      body.marketplaceWalletAddress = marketplaceWalletAddress;
      body.payload = payload;
      body.orderId = order.orderId;
      body.totalTon = order.totalTon;
      console.log("[orders] create ton order response", {
        orderId: order.orderId,
        marketplaceWalletAddress,
        totalTon: order.totalTon,
        payload,
      });
    }
    res.status(201).json(body);
  } catch (e) {
    next(e);
  }
});

app.post("/orders/:orderId/submit-payment", async (req, res, next) => {
  try {
    const orderId = String(req.params.orderId ?? "").trim();
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required." });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (order.paymentMethod !== "ton") {
      return res.status(400).json({ error: "Only TON orders support payment submission.", order: publicOrder(order) });
    }
    if (order.status === "paid") {
      return res.json({ ok: true, order: publicOrder(order), message: "Order is already paid." });
    }
    if (order.status === "payment_rejected") {
      return res.status(409).json({ error: "Payment was rejected for this order.", order: publicOrder(order) });
    }
    if (order.status !== "pending_payment") {
      return res.status(409).json({ error: `Order is ${order.status}.`, order: publicOrder(order) });
    }
    if (order.paymentReviewStatus === "waiting_admin_confirmation") {
      return res.json({
        ok: true,
        order: publicOrder(order),
        message: "Payment already submitted. Waiting for admin confirmation.",
      });
    }

    const buyerIdentity = resolveBuyerFromRequest(req);
    if (buyerIdentity.buyerTelegramId) {
      order.buyerTelegramId = order.buyerTelegramId || buyerIdentity.buyerTelegramId;
      order.buyerUsername = order.buyerUsername || buyerIdentity.buyerUsername;
    }
    if (req.body?.buyerWalletAddress) {
      order.buyerWalletAddress = String(req.body.buyerWalletAddress).trim();
    }
    const txHash = String(req.body?.txHash ?? "").trim();
    if (txHash) order.txHash = txHash;
    order.walletAppInfo = String(req.body?.walletAppInfo ?? "").trim();
    order.paymentReviewStatus = "waiting_admin_confirmation";
    order.paymentClaimedAt = new Date();
    if (!order.marketplaceWalletAddress) {
      const wallet = validateMarketplaceWallet();
      if (wallet.friendlyAddress) order.marketplaceWalletAddress = wallet.friendlyAddress;
    }
    await order.save();

    const gifts = await Gift.find({ listingId: { $in: order.listingIds } });
    await notifyAdminPaymentClaim(order, gifts);

    res.json({
      ok: true,
      order: publicOrder(order),
      message: "Payment submitted. Admin will confirm shortly.",
      autoTonVerify: AUTO_TON_VERIFY,
    });
  } catch (e) {
    next(e);
  }
});

app.post("/orders/verify-payment", async (req, res, next) => {
  try {
    if (!AUTO_TON_VERIFY) {
      return res.status(503).json({
        error: "Automatic TON verification is disabled. Submit payment and wait for admin confirmation.",
        code: "AUTO_TON_VERIFY_DISABLED",
      });
    }

    const orderId = String(req.body?.orderId ?? "").trim();
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required." });
    }

    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (order.status === "paid") {
      return res.json({ ok: true, order: publicOrder(order) });
    }
    if (order.status !== "pending_payment") {
      return res.status(409).json({ error: `Order is ${order.status}.`, order: publicOrder(order) });
    }

    let orderDirty = false;
    if (req.body?.buyerWalletAddress && !order.buyerWalletAddress) {
      order.buyerWalletAddress = String(req.body.buyerWalletAddress).trim();
      orderDirty = true;
    }
    const buyerIdentity = resolveBuyerFromRequest(req);
    if (buyerIdentity.buyerTelegramId && !order.buyerTelegramId) {
      order.buyerTelegramId = buyerIdentity.buyerTelegramId;
      order.buyerUsername = buyerIdentity.buyerUsername || order.buyerUsername;
      orderDirty = true;
    }
    if (orderDirty) await order.save();

    const payment = await findMatchingIncomingPayment(order);
    if (payment.error) {
      const status =
        payment.code === "INVALID_MARKETPLACE_WALLET_ADDRESS" ||
        payment.code === "TON_API_KEY_MISSING" ||
        payment.code === "TON_API_UNAUTHORIZED"
          ? 503
          : 402;
      return res.status(status).json({
        error: payment.error,
        code: payment.code || "",
        order: publicOrder(order),
      });
    }

    const used = await Order.findOne({ txHash: payment.txHash, orderId: { $ne: order.orderId } });
    if (used) {
      order.status = "failed";
      await order.save();
      return res.status(409).json({ error: "Transaction was already used for another order.", order: publicOrder(order) });
    }

    const completed = await completePaidOrder(order, payment);
    if (completed.error) {
      return res.status(409).json({ error: completed.error, order: publicOrder(order) });
    }

    res.json({ ok: true, order: publicOrder(completed.order), payment, transferResults: completed.transferResults });
  } catch (e) {
    next(e);
  }
});

app.get("/payments/card/providers", (_req, res) => {
  const providerPayload = (provider) => ({
    provider,
    enabled: cardProviderEnabled(provider) && (CARD_PAYMENT_TEST_MODE || !isProduction),
    testMode: CARD_PAYMENT_TEST_MODE || !isProduction,
    disabledReason: cardProviderEnabled(provider) && (CARD_PAYMENT_TEST_MODE || !isProduction) ? "" : "Provider not configured",
  });
  res.json({
    ok: true,
    providers: [providerPayload("click"), providerPayload("payme")],
  });
});

app.get("/payments/card/:orderId/status", async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: String(req.params.orderId ?? "").trim() });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (order.paymentMethod !== "card") {
      return res.status(400).json({ error: "Order is not a card payment.", order: publicOrder(order) });
    }
    res.json({ ok: true, order: publicOrder(order) });
  } catch (e) {
    next(e);
  }
});

app.post("/payments/test/:orderId/success", async (req, res, next) => {
  try {
    if (!assertCardTestAllowed(req, res)) return;
    const order = await Order.findOne({ orderId: String(req.params.orderId ?? "").trim() });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (order.paymentMethod !== "card") {
      return res.status(400).json({ error: "Order is not a card payment.", order: publicOrder(order) });
    }
    if (order.status === "paid") {
      return res.json({ ok: true, order: publicOrder(order) });
    }
    if (order.status !== "pending_payment") {
      return res.status(409).json({ error: `Order is ${order.status}.`, order: publicOrder(order) });
    }
    const txHash = `test_${order.cardProvider}_${order.orderId}`;
    const completed = await completePaidOrder(order, { txHash, provider: order.cardProvider, test: true });
    if (completed.error) {
      return res.status(409).json({ error: completed.error, order: publicOrder(order) });
    }
    res.json({ ok: true, order: publicOrder(completed.order), transferResults: completed.transferResults });
  } catch (e) {
    next(e);
  }
});

app.post("/payments/test/:orderId/fail", async (req, res, next) => {
  try {
    if (!assertCardTestAllowed(req, res)) return;
    const order = await Order.findOne({ orderId: String(req.params.orderId ?? "").trim() });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (order.paymentMethod !== "card") {
      return res.status(400).json({ error: "Order is not a card payment.", order: publicOrder(order) });
    }
    if (order.status === "paid") {
      return res.status(409).json({ error: "Paid orders cannot be failed.", order: publicOrder(order) });
    }
    order.status = "failed";
    order.cardPaymentStatus = "failed";
    await order.save();
    await releaseReservedListingsForOrder(order);
    res.json({ ok: true, order: publicOrder(order) });
  } catch (e) {
    next(e);
  }
});

app.post("/admin/orders/:orderId/replay-post-payment", async (req, res, next) => {
  try {
    if (!assertMetadataJobAllowed(req, res)) return;
    const orderId = String(req.params.orderId ?? "").trim();
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required." });
    }
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }
    const result = await handleManualEscrowAfterPayment(order, { replay: true });
    if (result.error) {
      return res.status(409).json({ error: result.error, order: publicOrder(order) });
    }
    res.json({
      ok: true,
      replay: true,
      order: publicOrder(result.order),
      transferResults: result.transferResults || [],
    });
  } catch (e) {
    next(e);
  }
});

app.get("/orders/:orderId", async (req, res, next) => {
  try {
    const order = await Order.findOne({ orderId: String(req.params.orderId ?? "").trim() });
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }
    res.json(publicOrder(order));
  } catch (e) {
    next(e);
  }
});

app.post("/gifts/metadata/sync-stale", async (req, res, next) => {
  try {
    if (!assertMetadataJobAllowed(req, res)) return;
    const maxAgeHours = Number(req.body?.maxAgeHours);
    const limit = Number(req.body?.limit);
    const out = await syncStaleGiftMetadata({
      maxAgeHours: Number.isFinite(maxAgeHours) ? maxAgeHours : undefined,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    res.json(out);
  } catch (e) {
    next(e);
  }
});

const CLEAR_LISTINGS_BODY_CONFIRM = "DELETE_ALL_MARKETPLACE_LISTINGS";

/**
 * Wipe all Gift documents (marketplace listings). Disabled unless CLEAR_LISTINGS_SECRET is set.
 * Requires header X-Clear-Listings-Secret or Authorization: Bearer <secret>.
 * In production, also requires body.allowProduction === true or CLEAR_LISTINGS_ALLOW_HTTP_IN_PRODUCTION=1.
 */
app.post("/admin/clear-listings", async (req, res, next) => {
  try {
    if (!CLEAR_LISTINGS_SECRET) {
      return res.status(503).json({
        error:
          "CLEAR_LISTINGS_SECRET is not set; this endpoint is disabled. Use scripts/clearListings.js instead.",
      });
    }
    const h = String(req.headers["x-clear-listings-secret"] ?? "").trim();
    const auth = String(req.headers.authorization ?? "").trim();
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (h !== CLEAR_LISTINGS_SECRET && bearer !== CLEAR_LISTINGS_SECRET) {
      return res.status(401).json({ error: "Invalid or missing clear-listings credentials." });
    }
    const confirm = String(req.body?.confirm ?? "").trim();
    if (confirm !== CLEAR_LISTINGS_BODY_CONFIRM) {
      return res.status(400).json({
        error: `Body must include { "confirm": "${CLEAR_LISTINGS_BODY_CONFIRM}" }.`,
      });
    }
    if (isProduction) {
      const bypass =
        req.body?.allowProduction === true ||
        String(process.env.CLEAR_LISTINGS_ALLOW_HTTP_IN_PRODUCTION ?? "").trim() === "1";
      if (!bypass) {
        return res.status(403).json({
          error:
            "Production: set body.allowProduction to true or set CLEAR_LISTINGS_ALLOW_HTTP_IN_PRODUCTION=1.",
        });
      }
    }

    const before = await Gift.countDocuments();
    const result = await Gift.deleteMany({});
    const after = await Gift.countDocuments();

    res.json({
      ok: true,
      collection: Gift.collection.name,
      before,
      deletedCount: result.deletedCount,
      after,
    });
  } catch (e) {
    next(e);
  }
});

app.use((err, _req, res, _next) => {
  console.error("[server]", err);
  res.status(500).json({ error: "Internal server error." });
});

initTelegramBot();

const host = "0.0.0.0";

async function start() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.error("[server] MONGODB_URI is required (MongoDB Atlas connection string).");
    process.exit(1);
  }

  await connectMongo(uri);
  await seedGiftsFromJsonIfEmpty();

  const server = app.listen(PORT, host, () => {
    console.log(`[server] Quanton Market API listening on http://${host}:${PORT}`);
    console.log("[server] Gifts storage: MongoDB Atlas");
  });

  async function shutdown(signal) {
    console.log(`[server] ${signal} received, closing...`);
    try {
      await stopTelegramBot();
    } catch {
      /* ignore */
    }
    try {
      await disconnectMongo();
    } catch {
      /* ignore */
    }
    server.close(() => {
      console.log("[server] HTTP server closed");
      process.exit(0);
    });
    setTimeout(() => {
      console.error("[server] Forced exit after timeout");
      process.exit(1);
    }, 15_000).unref();
  }

  ["SIGTERM", "SIGINT"].forEach((sig) => {
    process.on(sig, () => shutdown(sig));
  });
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
