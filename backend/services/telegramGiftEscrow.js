import crypto from "crypto";
import { Gift } from "../models/Gift.js";
import { TELEGRAM_BUSINESS_CONNECTION_ID } from "../config.js";
import { finalizeResolvedFloorMetadata } from "./floorProvider.js";
import { resolveGiftMetadata, applyResolvedMetadataToGiftDocument } from "./metadataProvider.js";
import { scheduleGiftImageUpscale, syncUpscaleMetadataFields } from "./imageUpscaler.js";

function str(v) {
  return String(v ?? "").trim();
}

function parsePositiveTon(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function publicEscrowState(gift) {
  return {
    listingId: gift.listingId,
    escrowStatus: gift.escrowStatus,
    transferStatus: gift.transferStatus,
    payoutStatus: gift.payoutStatus,
    ownedGiftId: gift.ownedGiftId,
    receivedGiftId: gift.receivedGiftId,
    priceTon: gift.priceTon,
    status: gift.status,
  };
}

export async function verifyGiftHeldByBusinessAccount({ ownedGiftId }) {
  const id = str(ownedGiftId);
  if (!id) return { ok: false, error: "ownedGiftId is required." };

  const existing = await Gift.findOne({ ownedGiftId: id });
  if (existing) {
    return { ok: false, status: 409, error: "This Telegram gift is already in escrow/listed." };
  }

  // Real implementation will call getBusinessAccountGifts(business_connection_id)
  // and ensure the owned gift is held by the Quanton business account.
  return {
    ok: true,
    verified: Boolean(TELEGRAM_BUSINESS_CONNECTION_ID),
    mode: TELEGRAM_BUSINESS_CONNECTION_ID ? "business_api_ready" : "dev_placeholder",
  };
}

export async function syncBusinessGifts() {
  return {
    ok: false,
    mode: TELEGRAM_BUSINESS_CONNECTION_ID ? "business_api_ready" : "dev_placeholder",
    message: "Business gift sync is scaffolded. Wire getBusinessAccountGifts once business permissions are available.",
  };
}

export async function createEscrowListingFromOwnedGift(body = {}) {
  const ownedGiftId = str(body.ownedGiftId);
  const sellerTelegramId = str(body.sellerTelegramId || body.escrowOwnerTelegramId);
  const receivedGiftId = str(body.receivedGiftId);
  const priceTon = parsePositiveTon(body.priceTon);

  if (!ownedGiftId) {
    return { error: { status: 400, body: { error: "ownedGiftId is required." } } };
  }
  if (!sellerTelegramId) {
    return { error: { status: 400, body: { error: "sellerTelegramId is required." } } };
  }

  const verification = await verifyGiftHeldByBusinessAccount({ ownedGiftId });
  if (!verification.ok) {
    return { error: { status: verification.status || 400, body: { error: verification.error } } };
  }

  const giftLink = str(body.giftLink || body.giftAssetName || ownedGiftId);
  let resolved = null;
  if (giftLink) {
    const attempt = await resolveGiftMetadata(giftLink);
    if (attempt.ok) {
      resolved = attempt;
      await finalizeResolvedFloorMetadata(resolved, {});
    }
  }

  const fallbackName = str(body.name) || `Escrow Gift ${ownedGiftId}`;
  const fallbackImage = str(body.imageHiRes || body.image) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Crect width='512' height='512' fill='%23111520'/%3E%3C/svg%3E";

  const gift = new Gift({
    listingId: `escrow_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
    giftLink,
    giftAssetName: str(body.giftAssetName),
    sellerNote: str(body.sellerNote),
    name: resolved?.name || fallbackName,
    collection: resolved?.collection || str(body.collection) || "Telegram Gifts",
    model: resolved?.model || str(body.model),
    symbol: resolved?.symbol || str(body.symbol),
    backdrop: resolved?.backdrop || str(body.backdrop),
    image: resolved?.imageHiRes || resolved?.image || fallbackImage,
    imageHiRes: resolved?.imageHiRes || resolved?.image || fallbackImage,
    imageThumb: resolved?.imageThumb || "",
    animationPosterUrl: resolved?.animationPosterUrl || resolved?.imageHiRes || resolved?.image || fallbackImage,
    imageFit: resolved?.imageFit === "cover" ? "cover" : "contain",
    animationUrl: resolved?.animationUrl || "",
    mediaSource: resolved?.mediaSource || "telegram-escrow",
    mediaMatchLevel: resolved?.mediaMatchLevel || "",
    priceTon,
    listingSource: "escrow",
    floorTon: Number(resolved?.floorTon ?? body.floorTon) || priceTon || 0,
    rarity: Number(resolved?.rarity ?? body.rarity) || 1,
    status: priceTon > 0 ? "approved" : "pending",
    escrowStatus: priceTon > 0 ? "listed" : "escrowed",
    transferStatus: "not_ready",
    payoutStatus: "none",
    escrowOwnerTelegramId: sellerTelegramId,
    ownedGiftId,
    receivedGiftId,
    transferCooldown: body.transferCooldown || null,
    traits: Array.isArray(resolved?.traits) ? resolved.traits : [],
    metadataSource: resolved?.metadataSource || "telegram-escrow",
    cachedMetadata: {
      ...(resolved?.cachedMetadata && typeof resolved.cachedMetadata === "object" ? resolved.cachedMetadata : {}),
      escrow: {
        ownedGiftId,
        receivedGiftId,
        verificationMode: verification.mode,
        raw: body,
      },
    },
  });

  if (resolved) {
    applyResolvedMetadataToGiftDocument(gift, resolved);
    syncUpscaleMetadataFields(gift, resolved);
  }

  gift.priceTon = priceTon;
  gift.status = priceTon > 0 ? "approved" : "pending";
  gift.escrowStatus = priceTon > 0 ? "listed" : "escrowed";
  gift.transferStatus = "not_ready";
  gift.escrowOwnerTelegramId = sellerTelegramId;
  gift.ownedGiftId = ownedGiftId;
  gift.receivedGiftId = receivedGiftId;
  gift.transferCooldown = body.transferCooldown || null;

  await gift.save();
  if (gift.imageUpscaleStatus === "pending") {
    scheduleGiftImageUpscale(gift.listingId);
  }

  return { gift, escrow: publicEscrowState(gift), verification };
}

export async function setEscrowListingPrice({ listingId, sellerTelegramId, priceTon }) {
  const price = parsePositiveTon(priceTon);
  if (!price) return { error: { status: 400, body: { error: "Price in TON must be greater than 0." } } };

  const q = { listingId: str(listingId), escrowStatus: { $in: ["escrowed", "pending_verification"] } };
  if (sellerTelegramId) q.escrowOwnerTelegramId = str(sellerTelegramId);

  const gift = await Gift.findOne(q);
  if (!gift) return { error: { status: 404, body: { error: "Escrow listing not found or already priced." } } };

  gift.priceTon = price;
  gift.status = "approved";
  gift.escrowStatus = "listed";
  gift.transferStatus = "not_ready";
  await gift.save();
  return { gift, escrow: publicEscrowState(gift) };
}

export async function transferEscrowGiftToBuyer({ gift, buyerTelegramId, orderId }) {
  if (!gift?.ownedGiftId) {
    return { ok: false, error: "Listing does not have an ownedGiftId." };
  }
  if (!buyerTelegramId) {
    return { ok: false, error: "buyerTelegramId is required for Telegram gift transfer." };
  }

  gift.transferAttempts = (Number(gift.transferAttempts) || 0) + 1;

  if (!TELEGRAM_BUSINESS_CONNECTION_ID) {
    gift.transferStatus = "failed";
    gift.transferError = "Telegram Business connection is not configured; transfer queued for manual retry.";
    await gift.save();
    return {
      ok: false,
      retryable: true,
      placeholder: true,
      orderId,
      ownedGiftId: gift.ownedGiftId,
      error: gift.transferError,
    };
  }

  // Real implementation will call Bot API transferGift:
  // { business_connection_id, owned_gift_id, new_owner_chat_id }
  gift.transferStatus = "failed";
  gift.transferError = "Real transferGift call is scaffolded but not enabled in this build.";
  await gift.save();
  return { ok: false, retryable: true, orderId, ownedGiftId: gift.ownedGiftId, error: gift.transferError };
}
