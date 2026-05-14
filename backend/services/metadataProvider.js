/**
 * Telegram Gifts metadata provider layer.
 *
 * Primary: Gift Asset API (https://github.com/GIFT-ASSET/gift_asset_api)
 * Fallbacks: local dev catalog (gifts.json), OpenGraph for t.me/nft when API unavailable.
 *
 * Architecture hooks (future):
 * - Live marketplace feed: poll Gift Asset price lists + sales streams.
 * - Rarity analytics: aggregate rarity_index / attributes from cached payloads.
 * - Sniper alerts: compare ask vs multi-provider floors from `providers`.
 * - TON wallet verification: tie `telegramUser` + on-chain proofs (separate service).
 */

import fs from "fs";
import axios from "axios";
import { fileURLToPath } from "url";
import path from "path";
import { GIFTS_FILE_PATH, GIFT_ASSET_API_KEY } from "../config.js";
import { fetchOpenGraphMeta } from "./openGraphResolve.js";
import { fetchGiftAssetByName } from "./giftAssetClient.js";
import {
  openGraphRasterVariants,
  pickGiftAssetRasterLayers,
} from "./giftImageAssets.js";
import {
  extractBestCollectionFloorTon,
  extractLegacyMarketFloorTon,
} from "./floorProvider.js";
import {
  normalizeCollectionFloorKeyFromGiftAssetName,
  normalizeCollectionFloorKeyFromLabel,
} from "./floorNormalization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let catalogById = null;

function loadCatalogMap() {
  if (catalogById) return catalogById;
  catalogById = new Map();
  const pathsToTry = [GIFTS_FILE_PATH, path.join(__dirname, "../data/gifts.json")];
  for (const p of pathsToTry) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
      if (!Array.isArray(raw)) continue;
      for (const row of raw) {
        if (!row?.id) continue;
        catalogById.set(String(row.id).toLowerCase(), row);
      }
      if (catalogById.size) break;
    } catch {
      /* ignore */
    }
  }
  return catalogById;
}

/**
 * @param {string} giftLink
 * @returns {string[]}
 */
function extractCandidateIds(giftLink) {
  const s = String(giftLink || "").trim();
  if (!s) return [];
  const out = new Set();
  out.add(s);
  out.add(s.toLowerCase());

  const starter = s.match(/gift_starter_\d+/i);
  if (starter) {
    out.add(starter[0]);
    out.add(starter[0].toLowerCase());
  }

  const slashId = s.match(/\/(gift_starter_\d+)\b/i);
  if (slashId) {
    out.add(slashId[1]);
    out.add(slashId[1].toLowerCase());
  }

  const digits = s.match(/\b(\d{3,})\b/);
  if (digits) out.add(digits[1]);

  return [...out];
}

/**
 * @param {string} raw user paste
 * @returns {string | null} canonical https URL when parseable
 */
export function normalizeTelegramPageUrl(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  try {
    if (/^https?:\/\//i.test(t)) {
      return new URL(t).href;
    }
  } catch {
    return null;
  }
  if (/^(t\.me|telegram\.me)\//i.test(t)) {
    try {
      return new URL(`https://${t}`).href;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {string} absUrl
 * @returns {string | null} NFT path segment after /nft/
 */
export function extractTelegramNftSlugFromUrl(absUrl) {
  try {
    const u = new URL(absUrl);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "t.me" && host !== "telegram.me") return null;
    const m = u.pathname.match(/^\/nft\/([^/?#]+)/i);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function humanizeCompactIdentifier(s) {
  if (!s) return "";
  return s.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").trim();
}

function collectionAndDisplayNameFromNftSlug(nftSlug) {
  const slug = String(nftSlug || "").trim();
  if (!slug) {
    return { collection: "Telegram NFT", displayName: "Telegram NFT" };
  }
  const parts = slug.split("-");
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last) && parts.length > 1) {
    const collPart = parts.slice(0, -1).join("");
    const collection = humanizeCompactIdentifier(collPart) || "Telegram NFT";
    const displayName = `${collection} #${last}`;
    return { collection, displayName };
  }
  const collection = humanizeCompactIdentifier(slug) || "Telegram NFT";
  return { collection, displayName: collection };
}

/** e.g. CollectionName-12345 — Gift Asset `name` query param */
const GIFT_ASSET_NAME_RE = /^[A-Za-z][A-Za-z0-9]*-\d+$/;

/**
 * @param {string} raw
 * @returns {string | null}
 */
export function extractGiftAssetName(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const page = normalizeTelegramPageUrl(t);
  if (page) {
    const slug = extractTelegramNftSlugFromUrl(page);
    if (slug && GIFT_ASSET_NAME_RE.test(slug)) return slug;
  }
  if (GIFT_ASSET_NAME_RE.test(t)) return t;
  return null;
}

function aggregateSales24h(providers) {
  if (!providers || typeof providers !== "object") return 0;
  let sum = 0;
  for (const p of Object.values(providers)) {
    const n = Number(p?.sales_stat?.sales_24h);
    if (Number.isFinite(n)) sum += n;
  }
  return Math.round(sum);
}

function liquidityFromSales24h(sales24h) {
  if (sales24h >= 200) return "High";
  if (sales24h >= 40) return "Medium";
  if (sales24h > 0) return "Low";
  return "Unknown";
}

function riskFromRarityIndex(ri) {
  if (!Number.isFinite(ri)) return "Unknown";
  if (ri < 0.00005) return "Low";
  if (ri < 0.0005) return "Medium";
  return "High";
}

function rarityFromPayload(payload) {
  const ri = Number(payload.rarity_index);
  if (Number.isFinite(ri) && ri > 0) {
    const v = Math.round(Math.min(100, Math.max(1, -Math.log10(ri + 1e-18) * 5.5)));
    return v;
  }
  const total = Number(payload.total_amount);
  if (Number.isFinite(total) && total > 0) {
    return Math.min(100, Math.max(1, Math.round(100 - Math.log10(total + 1) * 12)));
  }
  return 55;
}

function floorTonFromPayload(payload) {
  const mf = payload.market_floor;
  if (mf && typeof mf === "object") {
    const avg = Number(mf.avg);
    if (Number.isFinite(avg) && avg > 0) return avg;
    const mn = Number(mf.min);
    if (Number.isFinite(mn) && mn > 0) return mn;
  }
  return 0;
}

function buildTraitsFromGiftAsset(payload) {
  const traits = [];
  const attrs = payload.attributes;
  if (attrs && typeof attrs === "object") {
    for (const type of ["SYMBOL", "MODEL", "BACKDROP"]) {
      const a = attrs[type];
      if (a && typeof a === "object") {
        traits.push({
          key: type,
          value: String(a.name ?? ""),
          media: typeof a.media === "string" ? a.media : "",
        });
      }
    }
  }
  traits.push({ key: "telegram_gift_name", value: String(payload.telegram_gift_name ?? "") });
  traits.push({ key: "gift_asset_id", value: String(payload.id ?? "") });
  if (payload.telegram_nft_url) {
    traits.push({ key: "telegram_nft_url", value: String(payload.telegram_nft_url) });
  }
  return traits;
}

function trimCachePayload(payload) {
  try {
    const providersSlim =
      payload.providers && typeof payload.providers === "object"
        ? Object.fromEntries(
            Object.entries(payload.providers).map(([k, v]) => [
              k,
              {
                collection_floor: v?.collection_floor,
                model_floor: v?.model_floor,
                sales_24h: v?.sales_stat?.sales_24h,
              },
            ])
          )
        : undefined;
    const slim = {
      id: payload.id,
      telegram_gift_name: payload.telegram_gift_name,
      telegram_gift_title: payload.telegram_gift_title,
      telegram_nft_url: payload.telegram_nft_url,
      last_updated_at: payload.last_updated_at,
      rarity_index: payload.rarity_index,
      total_amount: payload.total_amount,
      market_floor: payload.market_floor,
      media: payload.media,
      attributes_array: payload.attributes_array,
      providers: providersSlim,
    };
    let s = JSON.stringify(slim);
    if (s.length > 48_000) {
      delete slim.providers;
      s = JSON.stringify(slim);
    }
    return s.length > 48_000 ? { core: slim, truncated: true } : slim;
  } catch {
    return null;
  }
}

/**
 * Map Gift Asset API document → resolver result used by Mongo + GET /gifts.
 * @param {object} payload
 * @param {string} giftAssetName
 */
export function mapGiftAssetPayloadToResult(payload, giftAssetName) {
  const layers = pickGiftAssetRasterLayers(payload);
  const hiRes = String(layers.hiRes || "").trim();
  const thumbRaw = String(layers.thumb || "").trim();
  const thumb = thumbRaw && thumbRaw !== hiRes ? thumbRaw : "";
  const animationPoster = String(layers.animationPoster || "").trim() || hiRes || thumbRaw;
  const animation = String(payload.media?.lottie_anim || "").trim();
  const rawName = String(payload.telegram_gift_name || giftAssetName || "");
  const { collection: derivedCollection, displayName } = collectionAndDisplayNameFromNftSlug(rawName);
  const name =
    String(payload.telegram_gift_title || "").trim() || displayName || giftAssetName;
  const collection = derivedCollection;

  const floorLegacy = floorTonFromPayload(payload);
  const floorBest = extractBestCollectionFloorTon(payload);
  const floorAlt = extractLegacyMarketFloorTon(payload);
  const floorTon =
    floorBest > 0 ? floorBest : floorAlt > 0 ? floorAlt : floorLegacy > 0 ? floorLegacy : 0;

  const image = hiRes || thumbRaw;

  return {
    ok: true,
    name: name || giftAssetName,
    collection,
    image,
    imageHiRes: hiRes || image,
    imageThumb: thumb,
    animation,
    animationPoster,
    mediaFit: "contain",
    rarity,
    floorTon: floorTon > 0 ? floorTon : 0,
    sales24h,
    volumeGrowth: 0,
    liquidity,
    risk,
    traits: buildTraitsFromGiftAsset(payload),
    source: "gift-asset",
    giftAssetName,
    ownerInfo: null,
    cachePayload: trimCachePayload(payload),
    collectionFloorKey:
      normalizeCollectionFloorKeyFromGiftAssetName(giftAssetName) ||
      normalizeCollectionFloorKeyFromLabel(collection),
    __giftAssetPayload: payload,
  };
}

/**
 * Resolve pasted link / id → listing metadata (single entry point for POST /gifts).
 *
 * @param {string} giftLink
 * @returns {Promise<
 *   | (Record<string, unknown> & { ok: true })
 *   | { ok: false; error: string }
 * >}
 */
export async function resolveGiftMetadata(giftLink) {
  const raw = String(giftLink ?? "").trim();
  if (!raw) {
    return { ok: false, error: "Gift link or gift ID is required." };
  }

  const giftAssetName = extractGiftAssetName(raw);

  /** Prefer Gift Asset CDN rasters over local catalog / OG whenever the slug + key allow it. */
  if (giftAssetName && GIFT_ASSET_API_KEY) {
    const payload = await fetchGiftAssetByName(giftAssetName);
    if (payload) {
      const mapped = mapGiftAssetPayloadToResult(payload, giftAssetName);
      if (mapped.image) return mapped;
    }
  }

  const catalog = loadCatalogMap();
  const candidates = extractCandidateIds(raw);
  for (const key of candidates) {
    const row = catalog.get(key.toLowerCase());
    if (row?.name && row?.image) {
      const rarity = Number(row.rarity);
      const floorTon = Number(row.floorTon);
      const baseImg = String(row.image).trim();
      const rowHi = String(row.imageHiRes ?? row.image_hires ?? "").trim() || baseImg;
      const rowTh = String(row.imageThumb ?? row.image_thumb ?? "").trim();
      const thumb = rowTh && rowTh !== rowHi ? rowTh : "";
      return {
        ok: true,
        name: String(row.name),
        collection: String(row.collection ?? "Telegram Gifts"),
        image: rowHi,
        imageHiRes: rowHi,
        imageThumb: thumb,
        animation: String(row.animationUrl ?? row.animation ?? "").trim(),
        animationPoster: String(row.animationPoster ?? row.animation_poster ?? "").trim() || rowHi,
        mediaFit: String(row.imageFit ?? row.media_fit ?? "contain").toLowerCase() === "cover" ? "cover" : "contain",
        rarity: Number.isFinite(rarity) && rarity >= 1 && rarity <= 100 ? Math.round(rarity) : 50,
        floorTon: Number.isFinite(floorTon) && floorTon > 0 ? floorTon : 100,
        sales24h: Number(row.sales24h) || 0,
        volumeGrowth: Number(row.volumeGrowth) || 0,
        liquidity: String(row.liquidity ?? "Unknown"),
        risk: String(row.risk ?? "Unknown"),
        traits: [
          { key: "catalogId", value: String(row.id) },
          { key: "resolver", value: "gifts-json-catalog" },
        ],
        source: "catalog-json",
        giftAssetName: "",
        ownerInfo: null,
        cachePayload: null,
        collectionFloorKey: normalizeCollectionFloorKeyFromLabel(String(row.collection ?? "Telegram Gifts")),
        __giftAssetPayload: null,
      };
    }
  }

  const pageUrl = normalizeTelegramPageUrl(raw);
  const nftSlug = pageUrl ? extractTelegramNftSlugFromUrl(pageUrl) : null;

  if (pageUrl && nftSlug) {
    const { collection: slugCollection, displayName } = collectionAndDisplayNameFromNftSlug(nftSlug);
    const og = await fetchOpenGraphMeta(pageUrl);

    if (og && og.image) {
      const name = (og.title || displayName).trim() || displayName;
      const ogRaw = String(og.image || "").trim();
      const variants = openGraphRasterVariants(ogRaw);
      const hi = String(variants.hiRes || "").trim() || ogRaw;
      const th = String(variants.thumb || "").trim();
      const thumb = th && th !== hi ? th : "";
      const site = (og.siteName && og.siteName.trim()) || "";
      const collection =
        site && site.toLowerCase() !== "telegram" ? site : slugCollection || "Telegram NFT";

      return {
        ok: true,
        name,
        collection,
        image: hi,
        imageHiRes: hi,
        imageThumb: thumb,
        animation: "",
        animationPoster: hi,
        mediaFit: "cover",
        rarity: 58,
        floorTon: 0,
        sales24h: 0,
        volumeGrowth: 0,
        liquidity: "Unknown",
        risk: "Unknown",
        traits: [
          { key: "giftLink", value: pageUrl },
          { key: "nftSlug", value: nftSlug },
          { key: "resolver", value: "opengraph" },
          ...(og.title ? [{ key: "og:title", value: og.title }] : []),
          ...(og.image ? [{ key: "og:image", value: og.image }] : []),
        ],
        source: "opengraph",
        giftAssetName: GIFT_ASSET_NAME_RE.test(nftSlug) ? nftSlug : "",
        ownerInfo: null,
        cachePayload: {
          opengraph: { title: og.title, image: og.image, imageUpgraded: hi, siteName: og.siteName },
        },
        collectionFloorKey:
          normalizeCollectionFloorKeyFromGiftAssetName(nftSlug) ||
          normalizeCollectionFloorKeyFromLabel(collection),
        __giftAssetPayload: null,
      };
    }

    if (!GIFT_ASSET_API_KEY && GIFT_ASSET_NAME_RE.test(nftSlug)) {
      return {
        ok: false,
        error:
          "Set GIFT_ASSET_API_KEY to resolve Telegram gift metadata, or ensure the NFT preview page exposes OpenGraph images.",
      };
    }

    return {
      ok: false,
      error:
        "Could not resolve gift metadata. Configure GIFT_ASSET_API_KEY (Gift Asset API) or paste a valid t.me/nft link with a public preview.",
    };
  }

  if (giftAssetName && !GIFT_ASSET_API_KEY) {
    return {
      ok: false,
      error:
        "Gift Asset API key is not configured. Set GIFT_ASSET_API_KEY to resolve this gift ID, or paste a full https://t.me/nft/… link.",
    };
  }

  return {
    ok: false,
    error:
      "Unsupported gift link. Use a Telegram NFT URL (https://t.me/nft/Collection-Number), a Gift Asset name (e.g. EasterEgg-1), or a known dev catalog id.",
  };
}

/**
 * Apply resolver output onto a Mongoose Gift document (create + refresh).
 * @param {import("mongoose").Document} doc
 * @param {Record<string, unknown> & { ok: true }} resolved
 */
export function applyResolvedMetadataToGiftDocument(doc, resolved) {
  doc.name = resolved.name;
  doc.collection = resolved.collection;
  const hi = String(resolved.imageHiRes || resolved.image || "").trim();
  const th = String(resolved.imageThumb || "").trim();
  const thumb = th && th !== hi ? th : "";
  doc.image = hi || String(resolved.image || "").trim();
  doc.imageHiRes = hi || doc.image;
  doc.imageThumb = thumb;
  doc.animationPosterUrl = String(resolved.animationPoster || "").trim();
  doc.imageFit = resolved.mediaFit === "cover" ? "cover" : "contain";
  doc.animationUrl = resolved.animation || "";
  doc.floorTon = resolved.floorTon;
  doc.collectionFloorKey = String(resolved.collectionFloorKey || "").trim();
  const rf = Number(resolved.resolvedFloorTon);
  doc.resolvedFloorTon = Number.isFinite(rf) && rf >= 0 ? rf : 0;
  doc.resolvedFloorSource = String(resolved.resolvedFloorSource || "").trim();
  const ru = resolved.resolvedFloorUpdatedAt;
  doc.resolvedFloorUpdatedAt =
    ru instanceof Date ? ru : ru ? new Date(ru) : null;
  doc.rarity = resolved.rarity;
  doc.sales24h = resolved.sales24h ?? 0;
  doc.volumeGrowth = resolved.volumeGrowth ?? 0;
  doc.liquidity = resolved.liquidity ?? "Unknown";
  doc.risk = resolved.risk ?? "Unknown";
  doc.traits = Array.isArray(resolved.traits) ? resolved.traits : [];
  doc.metadataSource = resolved.source;
  if (resolved.giftAssetName) doc.giftAssetName = resolved.giftAssetName;
  doc.cachedMetadata = resolved.cachePayload ?? null;
  doc.metadataSyncedAt = new Date();
  if (resolved.ownerInfo !== undefined) doc.ownerInfo = resolved.ownerInfo;
}

export { fetchGiftAssetByName };
