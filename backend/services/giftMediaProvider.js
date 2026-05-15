/**
 * Portals-style gift media resolution (local registry → public providers → Telegram CDN → OG).
 * Never uses Gift Asset User-Data routes.
 */

import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import { GIFT_ASSET_API_KEY, GIFT_ASSET_BASE_URL } from "../config.js";
import {
  normalizeCollectionFloorKeyFromLabel,
  collectionDisplayNameFromGiftAssetName,
} from "./floorNormalization.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GIFT_ASSETS_REGISTRY_PATH = path.join(__dirname, "../data/gift-assets.json");

/** @type {Record<string, object> | null} */
let registryByKey = null;

/**
 * @param {string} p
 * @returns {string}
 */
export function toPublicAssetUrl(p) {
  const s = String(p ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) return s;
  return s.startsWith("/") ? s : `/${s}`;
}

/**
 * @param {string} slug e.g. PerfumeBottle-1293
 * @returns {string}
 */
export function toFragmentGiftSlug(slug) {
  const m = String(slug || "").trim().match(/^([A-Za-z][A-Za-z0-9]*)-(\d+)$/);
  if (!m) return String(slug || "").trim().toLowerCase();
  return `${m[1].toLowerCase()}-${m[2]}`;
}

/**
 * @param {string} s
 * @returns {string}
 */
export function toRegistryKebabKey(s) {
  return String(s ?? "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/**
 * @param {string} nftSlug
 * @param {string} [collection]
 * @returns {string[]}
 */
export function buildRegistryLookupKeys(nftSlug, collection = "") {
  const keys = [];
  const seen = new Set();
  const add = (k) => {
    const n = String(k ?? "").trim().toLowerCase();
    if (!n || seen.has(n)) return;
    seen.add(n);
    keys.push(n);
  };

  const slug = String(nftSlug || "").trim();
  if (slug) {
    const m = slug.match(/^([A-Za-z][A-Za-z0-9]*)-\d+$/);
    if (m) {
      add(toRegistryKebabKey(m[1]));
      add(normalizeCollectionFloorKeyFromLabel(m[1]));
    }
    add(toRegistryKebabKey(slug));
  }

  const coll = String(collection || "").trim();
  if (coll) {
    add(toRegistryKebabKey(coll));
    add(normalizeCollectionFloorKeyFromLabel(coll));
  }

  const fromName = collectionDisplayNameFromGiftAssetName(slug);
  if (fromName) {
    add(toRegistryKebabKey(fromName));
    add(normalizeCollectionFloorKeyFromLabel(fromName));
  }

  return keys;
}

function loadRegistry() {
  if (registryByKey) return registryByKey;
  registryByKey = {};
  try {
    if (!fs.existsSync(GIFT_ASSETS_REGISTRY_PATH)) return registryByKey;
    const raw = JSON.parse(fs.readFileSync(GIFT_ASSETS_REGISTRY_PATH, "utf-8"));
    if (raw && typeof raw === "object") registryByKey = raw;
  } catch (e) {
    console.warn("[giftMedia] registry load failed:", e?.message || e);
    registryByKey = {};
  }
  return registryByKey;
}

/**
 * @param {string[]} keys
 * @returns {object | null}
 */
export function matchLocalAssetRegistry(keys) {
  const reg = loadRegistry();
  for (const k of keys) {
    const row = reg[k];
    if (!row || typeof row !== "object") continue;
    const imageHiRes = toPublicAssetUrl(row.imageHiRes || row.image || "");
    if (!imageHiRes) continue;
    const imageThumb = toPublicAssetUrl(row.imageThumb || imageHiRes);
    return {
      image: imageHiRes,
      imageHiRes,
      imageThumb: imageThumb || imageHiRes,
      animationUrl: toPublicAssetUrl(row.animationUrl || ""),
      animationPosterUrl: toPublicAssetUrl(row.animationPosterUrl || imageHiRes),
      imageFit: row.imageFit === "cover" ? "cover" : "contain",
      mediaSource: "local_asset",
    };
  }
  return null;
}

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function urlExists(url) {
  const u = String(url || "").trim();
  if (!u || !/^https?:\/\//i.test(u)) return false;
  try {
    const res = await axios.head(u, {
      timeout: 6_000,
      maxRedirects: 3,
      validateStatus: (s) => s >= 200 && s < 400,
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    try {
      const res = await axios.get(u, {
        timeout: 8_000,
        maxRedirects: 3,
        responseType: "arraybuffer",
        maxContentLength: 12_000,
        validateStatus: (s) => s >= 200 && s < 400,
      });
      return res.status >= 200 && res.status < 400;
    } catch {
      return false;
    }
  }
}

/**
 * Gift Asset public collection original raster (`/api/v1/data/original/…`).
 * @param {string} collectionLabel
 */
async function tryGiftAssetPublicOriginal(collectionLabel) {
  if (!GIFT_ASSET_API_KEY) return null;
  const compact = normalizeCollectionFloorKeyFromLabel(collectionLabel);
  if (!compact) return null;
  const base = GIFT_ASSET_BASE_URL.replace(/\/+$/, "");
  const candidates = [`${compact}.png`, `${compact}.webp`, `${compact}.jpg`];
  for (const file of candidates) {
    const url = `${base}/api/v1/data/original/${file}`;
    if (await urlExists(url)) {
      return {
        image: url,
        imageHiRes: url,
        imageThumb: url,
        animationUrl: "",
        animationPosterUrl: url,
        imageFit: "contain",
        mediaSource: "gift_asset",
      };
    }
  }
  return null;
}

/**
 * Fragment / Telegram collectible CDN (per-gift rasters + lottie).
 * @param {string} nftSlug
 */
export async function discoverTelegramCollectibleMedia(nftSlug) {
  const frag = toFragmentGiftSlug(nftSlug);
  if (!frag) return null;

  const base = `https://nft.fragment.com/gift/${frag}`;
  const large = `${base}.large.jpg`;
  const medium = `${base}.medium.jpg`;
  const small = `${base}.small.jpg`;
  const lottie = `${base}.lottie.json`;

  const [hasLarge, hasMedium, hasLottie] = await Promise.all([
    urlExists(large),
    urlExists(medium),
    urlExists(lottie),
  ]);

  if (!hasLarge && !hasMedium) return null;

  const imageHiRes = hasLarge ? large : medium;
  const imageThumb = hasMedium ? medium : hasLarge ? large : small;

  return {
    image: imageHiRes,
    imageHiRes,
    imageThumb: imageThumb || imageHiRes,
    animationUrl: hasLottie ? lottie : "",
    animationPosterUrl: imageHiRes,
    imageFit: "contain",
    mediaSource: "telegram_cdn",
  };
}

/**
 * @param {string} ogImage
 */
function openGraphMediaFallback(ogImage) {
  const raw = String(ogImage || "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) return null;
  return {
    image: raw,
    imageHiRes: raw,
    imageThumb: raw,
    animationUrl: "",
    animationPosterUrl: raw,
    imageFit: "cover",
    mediaSource: "opengraph",
    openGraphOnly: true,
  };
}

/**
 * Merge AI-upscaled output onto an existing media row.
 * @param {object} base
 * @param {string} upscaledUrl
 */
export function applyAiUpscaledMedia(base, upscaledUrl) {
  const url = String(upscaledUrl || "").trim();
  if (!url) return base;
  return {
    ...base,
    image: url,
    imageHiRes: url,
    imageThumb: "",
    animationPosterUrl: url,
    mediaSource: "ai_upscaled",
    openGraphOnly: false,
  };
}

/**
 * @param {{
 *   nftSlug?: string;
 *   giftAssetName?: string;
 *   collection?: string;
 *   giftLink?: string;
 *   ogImage?: string;
 *   name?: string;
 * }} ctx
 * @returns {Promise<{
 *   image: string;
 *   imageHiRes: string;
 *   imageThumb: string;
 *   animationUrl: string;
 *   animationPosterUrl: string;
 *   imageFit: "contain" | "cover";
 *   mediaSource: string;
 *   openGraphOnly?: boolean;
 * } | null>}
 */
export async function resolveGiftMedia(ctx = {}) {
  const nftSlug = String(ctx.nftSlug || ctx.giftAssetName || "").trim();
  const collection =
    String(ctx.collection || "").trim() ||
    collectionDisplayNameFromGiftAssetName(nftSlug) ||
    "";

  const keys = buildRegistryLookupKeys(nftSlug, collection);

  const local = matchLocalAssetRegistry(keys);
  if (local) return local;

  if (collection) {
    const ga = await tryGiftAssetPublicOriginal(collection);
    if (ga) return ga;
    const alt = collectionDisplayNameFromGiftAssetName(nftSlug);
    if (alt && alt !== collection) {
      const ga2 = await tryGiftAssetPublicOriginal(alt);
      if (ga2) return ga2;
    }
  }

  if (nftSlug) {
    const tg = await discoverTelegramCollectibleMedia(nftSlug);
    if (tg) return tg;
  }

  return openGraphMediaFallback(ctx.ogImage);
}

/**
 * Whether Replicate upscale should run (OG-only / missing hi-res).
 * @param {string} mediaSource
 * @param {string} [imageHiRes]
 */
export function shouldScheduleAiUpscale(mediaSource, imageHiRes) {
  const src = String(mediaSource || "").trim();
  if (src === "opengraph") return Boolean(String(imageHiRes || "").trim().startsWith("http"));
  if (src === "ai_upscaled") return false;
  if (["local_asset", "gift_asset", "telegram_cdn"].includes(src)) return false;
  return false;
}
