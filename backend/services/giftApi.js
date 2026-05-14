import fs from "fs";
import { calculateAiScore } from "./aiScore.js";
import { computeRealFloorTon, computeFloorIsLive, finalizeResolvedFloorMetadata } from "./floorProvider.js";
import { Gift } from "../models/Gift.js";
import { User } from "../models/User.js";
import { GIFTS_FILE_PATH, isProduction } from "../config.js";
import { resolveGiftMetadata, applyResolvedMetadataToGiftDocument } from "./metadataProvider.js";
import { scheduleGiftImageUpscale, syncUpscaleMetadataFields } from "./imageUpscaler.js";

/** Map a stored gift document to the public API shape (includes live AI fields). */
export function giftToApiResponse(doc) {
  const plain =
    doc && typeof doc.toObject === "function"
      ? doc.toObject()
      : { ...doc };

  const base = {
    id: plain.listingId,
    name: plain.name,
    collection: plain.collection,
    image: plain.image,
    imageHiRes: plain.imageHiRes || plain.image,
    imageThumb: plain.imageThumb || "",
    imageFit: plain.imageFit === "cover" ? "cover" : "contain",
    priceTon: plain.priceTon,
    floorTon: plain.floorTon,
    rarity: plain.rarity,
    sales24h: plain.sales24h ?? 0,
    volumeGrowth: plain.volumeGrowth ?? 0,
    liquidity: plain.liquidity,
    risk: plain.risk,
    status: plain.status,
    telegramUser: plain.telegramUserSnapshot ?? null,
    createdAt:
      plain.createdAt instanceof Date
        ? plain.createdAt.toISOString()
        : plain.createdAt ?? new Date().toISOString(),
  };

  if (plain.giftLink) base.giftLink = plain.giftLink;
  if (plain.sellerNote) base.sellerNote = plain.sellerNote;
  if (Array.isArray(plain.traits) && plain.traits.length) base.traits = plain.traits;
  if (plain.metadataSource) base.metadataSource = plain.metadataSource;
  if (plain.animationUrl) base.animationUrl = plain.animationUrl;
  if (plain.giftAssetName) base.giftAssetName = plain.giftAssetName;
  if (plain.animationPosterUrl) base.animationPosterUrl = plain.animationPosterUrl;
  if (plain.imageOriginal) base.imageOriginal = plain.imageOriginal;
  base.imageUpscaled = Boolean(plain.imageUpscaled);
  if (plain.imageUpscaleProvider) base.imageUpscaleProvider = plain.imageUpscaleProvider;
  if (plain.imageUpscaledAt instanceof Date) {
    base.imageUpscaledAt = plain.imageUpscaledAt.toISOString();
  } else if (plain.imageUpscaledAt) {
    base.imageUpscaledAt = new Date(plain.imageUpscaledAt).toISOString();
  }
  base.imageUpscaleStatus = plain.imageUpscaleStatus || "none";
  if (plain.metadataSyncedAt instanceof Date) {
    base.metadataSyncedAt = plain.metadataSyncedAt.toISOString();
  } else if (plain.metadataSyncedAt) {
    base.metadataSyncedAt = new Date(plain.metadataSyncedAt).toISOString();
  }
  if (plain.cachedMetadata && typeof plain.cachedMetadata === "object") {
    base.cachedMetadata = plain.cachedMetadata;
  }
  if (plain.ownerInfo && typeof plain.ownerInfo === "object") {
    base.ownerInfo = plain.ownerInfo;
  }

  const th = String(plain.imageThumb || "").trim();
  const hi = String(plain.imageHiRes || plain.image || "").trim();
  if (!plain.imageUpscaled && th && hi && th !== hi) {
    base.imageSrcSet = `${th} 1x, ${hi} 2x`;
  }

  const ru = plain.resolvedFloorUpdatedAt;
  if (ru instanceof Date) {
    base.floorUpdatedAt = ru.toISOString();
  } else if (ru) {
    base.floorUpdatedAt = new Date(ru).toISOString();
  }

  base.realFloorTon = computeRealFloorTon(plain);
  base.floorSource = String(plain.resolvedFloorSource || "");
  base.floorIsLive = computeFloorIsLive(plain);

  const scoreInput = {
    ...base,
    resolvedFloorTon: plain.resolvedFloorTon ?? 0,
    resolvedFloorSource: plain.resolvedFloorSource ?? "",
    resolvedFloorUpdatedAt: plain.resolvedFloorUpdatedAt ?? null,
  };

  return { ...base, ...calculateAiScore(scoreInput) };
}

export async function listGiftsForApi() {
  const docs = await Gift.find().sort({ createdAt: -1 }).lean();
  return docs.map((d) => giftToApiResponse(d));
}

export async function listUndervaluedForApi() {
  const all = await listGiftsForApi();
  return all
    .filter((g) => g.undervaluedPercent >= 15)
    .sort((a, b) => b.aiScore - a.aiScore);
}

/**
 * Upsert Telegram user from Mini App payload.
 * @param {Record<string, unknown> | null | undefined} telegramUser
 */
async function upsertTelegramUser(telegramUser) {
  if (!telegramUser || typeof telegramUser !== "object") return null;
  const id = telegramUser.id;
  if (id === undefined || id === null) return null;
  const telegramId = String(id).trim();
  if (!telegramId) return null;

  const doc = await User.findOneAndUpdate(
    { telegramId },
    {
      $set: {
        firstName: typeof telegramUser.first_name === "string" ? telegramUser.first_name : "",
        lastName: typeof telegramUser.last_name === "string" ? telegramUser.last_name : "",
        username: typeof telegramUser.username === "string" ? telegramUser.username : "",
        languageCode:
          typeof telegramUser.language_code === "string" ? telegramUser.language_code : "",
        isPremium: Boolean(telegramUser.is_premium),
        photoUrl: typeof telegramUser.photo_url === "string" ? telegramUser.photo_url : "",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc;
}

export async function createGiftFromBody(body, listingIdSuffix = "") {
  if (!body || typeof body !== "object") {
    return {
      error: { status: 400, body: { error: "Gift link or gift ID is required." } },
    };
  }

  const { giftLink, priceTon, sellerNote, telegramUser } = body;

  const giftLinkTrim = typeof giftLink === "string" ? giftLink.trim() : "";
  const sellerNoteTrim = typeof sellerNote === "string" ? sellerNote.trim() : "";
  const priceNum = Number(priceTon);

  if (!giftLinkTrim) {
    return {
      error: { status: 400, body: { error: "Gift link or gift ID is required." } },
    };
  }
  if (!Number.isFinite(priceNum) || priceNum <= 0) {
    return {
      error: {
        status: 400,
        body: { error: "Price in TON must be a number greater than 0." },
      },
    };
  }

  const resolved = await resolveGiftMetadata(giftLinkTrim);
  if (!resolved.ok) {
    return {
      error: { status: 400, body: { error: resolved.error || "Could not resolve gift metadata." } },
    };
  }

  await finalizeResolvedFloorMetadata(resolved, {});
  const resolvedName = String(resolved.name ?? "").trim();
  const resolvedImage = String(resolved.imageHiRes || resolved.image || "").trim();
  if (!resolvedName || !resolvedImage) {
    return {
      error: {
        status: 422,
        body: {
          error: "Could not resolve gift metadata (missing title or image).",
        },
      },
    };
  }

  const userDoc = await upsertTelegramUser(telegramUser);

  const gift = new Gift({
    listingId: `gift_${Date.now()}${listingIdSuffix ? `_${listingIdSuffix}` : ""}`,
    giftLink: giftLinkTrim,
    sellerNote: sellerNoteTrim,
    priceTon: priceNum,
    status: "pending",
    telegramUserId: userDoc?._id ?? null,
    telegramUserSnapshot: telegramUser ?? null,
  });

  applyResolvedMetadataToGiftDocument(gift, resolved);
  syncUpscaleMetadataFields(gift, resolved);
  await gift.save();

  if (gift.imageUpscaleStatus === "pending") {
    scheduleGiftImageUpscale(gift.listingId);
  }

  return { gift };
}

/**
 * Import demo rows from `gifts.json` into MongoDB when the collection is empty.
 * Disabled in production (`NODE_ENV === "production"`) so Render/Atlas stays user-only.
 * Resolver still reads the same JSON file from disk for `gift_starter_*` metadata.
 */
export async function seedGiftsFromJsonIfEmpty() {
  if (isProduction) {
    console.log("[mongo] skipping automatic demo gift seed (production)");
    return { seeded: 0 };
  }

  const count = await Gift.countDocuments();
  if (count > 0) return { seeded: 0 };

  const seedPath = GIFTS_FILE_PATH;
  if (!fs.existsSync(seedPath)) {
    console.warn("[mongo] seed skipped — no file at", seedPath);
    return { seeded: 0 };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(seedPath, "utf-8"));
  } catch (e) {
    console.warn("[mongo] seed skipped — invalid JSON:", e?.message || e);
    return { seeded: 0 };
  }

  if (!Array.isArray(raw) || raw.length === 0) return { seeded: 0 };

  let seeded = 0;
  for (const row of raw) {
    if (!row?.id || !row?.name) continue;
    const imageStr = String(row.image ?? "").trim();
    if (!imageStr) continue;
    try {
      await Gift.create({
        listingId: String(row.id),
        giftLink: "",
        giftAssetName: "",
        sellerNote: "",
        name: String(row.name),
        collection: String(row.collection ?? "Telegram Gifts"),
        image: imageStr,
        imageHiRes: imageStr,
        imageThumb: "",
        animationPosterUrl: imageStr,
        imageFit: "contain",
        imageOriginal: "",
        imageUpscaled: false,
        imageUpscaleProvider: "",
        imageUpscaledAt: null,
        imageUpscaleStatus: "none",
        animationUrl: "",
        priceTon: Number(row.priceTon) || 0,
        floorTon: Number(row.floorTon) || 0,
        rarity: Number(row.rarity) || 1,
        sales24h: Number(row.sales24h) || 0,
        volumeGrowth: Number(row.volumeGrowth) || 0,
        liquidity: String(row.liquidity ?? "Unknown"),
        risk: String(row.risk ?? "Unknown"),
        status: String(row.status ?? "pending"),
        traits: [],
        metadataSource: "seed-catalog",
        cachedMetadata: null,
        metadataSyncedAt: null,
        collectionFloorKey: "",
        resolvedFloorTon: 0,
        resolvedFloorSource: "",
        resolvedFloorUpdatedAt: null,
        ownerInfo: null,
        telegramUserId: null,
        telegramUserSnapshot: row.telegramUser ?? null,
        createdAt: row.createdAt ? new Date(row.createdAt) : undefined,
      });
      seeded += 1;
    } catch (e) {
      console.warn("[mongo] seed row skipped:", row?.id, e?.message || e);
    }
  }

  if (seeded) console.log(`[mongo] seeded ${seeded} gifts from`, seedPath);
  return { seeded };
}
