import fs from "fs";
import { calculateAiScore } from "./aiScore.js";
import { Gift } from "../models/Gift.js";
import { User } from "../models/User.js";
import { GIFTS_FILE_PATH } from "../config.js";
import { resolveGiftMetadata } from "./resolveGiftMetadata.js";

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

  return { ...base, ...calculateAiScore(base) };
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

  const userDoc = await upsertTelegramUser(telegramUser);

  const traits = Array.isArray(resolved.traits) ? resolved.traits : [];

  const gift = await Gift.create({
    listingId: `gift_${Date.now()}${listingIdSuffix ? `_${listingIdSuffix}` : ""}`,
    giftLink: giftLinkTrim,
    sellerNote: sellerNoteTrim,
    name: resolved.name,
    collection: resolved.collection,
    image: resolved.image,
    priceTon: priceNum,
    floorTon: resolved.floorTon,
    rarity: resolved.rarity,
    sales24h: 0,
    volumeGrowth: 0,
    liquidity: "Unknown",
    risk: "Unknown",
    status: "pending",
    traits,
    metadataSource: resolved.source,
    telegramUserId: userDoc?._id ?? null,
    telegramUserSnapshot: telegramUser ?? null,
  });

  return { gift };
}

/** One-time import from `gifts.json` when the collection is empty (local + Render bootstrap). */
export async function seedGiftsFromJsonIfEmpty() {
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
        sellerNote: "",
        name: String(row.name),
        collection: String(row.collection ?? "Telegram Gifts"),
        image: imageStr,
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
