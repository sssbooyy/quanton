/**
 * Portals-style collectible visuals: backdrop (trait color), symbol (pattern asset), model (static raster), animation (motion).
 *
 * URL routing: `/symbols/` → symbol layer only; `/models/` → model static layer only; `/backdrops/` → backdrop assets only;
 * model pipeline rejects symbol/backdrop/pattern/icon URLs (`isThemeOrSymbolAssetRasterUrl`).
 */

import {
  buildGiftAssetSymbolUrl,
  getGiftPublicBucket,
  getGiftMediaBucket,
  getMainGiftRasterCandidatesForDisplay,
  isSymbolAssetRasterUrl,
  isThemeOrSymbolAssetRasterUrl,
} from "./giftPublicImageResolve.js";
import {
  extractBackdropLabelFromGift,
  getBackdropTraitSolidColor,
  resolveCollectibleHeroPresentation,
} from "./giftHeroResolve.js";

/**
 * @param {unknown} v
 * @returns {string}
 */
function pickUrlish(v) {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v && typeof v === "object" && typeof v.url === "string" && v.url.trim()) return v.url.trim();
  return "";
}

/**
 * @param {Record<string, unknown> | null | undefined} obj
 * @returns {string[]}
 */
function collectHttpUrlsFromRecord(obj) {
  if (!obj || typeof obj !== "object") return [];
  /** @type {string[]} */
  const out = [];
  for (const v of Object.values(obj)) {
    const u = pickUrlish(v);
    if (u && /^https?:\/\//i.test(u)) out.push(u);
  }
  return out;
}

/**
 * **Backdrop layer** — solid trait color from backdrop/background only (no model/symbol URLs).
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {{ backdropColor: string; backdropLabel: string; backdropTheme: unknown }}
 */
export function resolveBackdropPaintLayer(gift) {
  if (!gift || typeof gift !== "object") {
    return { backdropColor: "#06080f", backdropLabel: "", backdropTheme: null };
  }
  const backdropLabel = extractBackdropLabelFromGift(gift) || String(gift.backdrop || "").trim();
  const pres = resolveCollectibleHeroPresentation(gift);
  const backdropColor = getBackdropTraitSolidColor(
    pres.backdropTheme,
    backdropLabel,
    String(gift.collection ?? "").trim(),
  );
  return { backdropColor, backdropLabel, backdropTheme: pres.backdropTheme };
}

/**
 * **Symbol layer** — Gift Asset symbol raster for debug / future raster pattern; never the main model poster.
 * Procedural `GiftPatternLayer` uses trait id; this URL is the canonical `/symbols/` asset when present.
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {string}
 */
export function resolveSymbolPatternUrl(gift) {
  if (!gift || typeof gift !== "object") return "";

  for (const u of collectHttpUrlsFromRecord(getGiftPublicBucket(gift))) {
    if (isSymbolAssetRasterUrl(u)) return u;
  }
  for (const u of collectHttpUrlsFromRecord(getGiftMediaBucket(gift))) {
    if (isSymbolAssetRasterUrl(u)) return u;
  }

  const cm = gift.cachedMetadata;
  if (cm && typeof cm === "object") {
    const pub = cm.public;
    if (pub && typeof pub === "object") {
      for (const u of collectHttpUrlsFromRecord(pub)) {
        if (isSymbolAssetRasterUrl(u)) return u;
      }
    }
    const media = cm.media;
    if (media && typeof media === "object") {
      for (const u of collectHttpUrlsFromRecord(media)) {
        if (isSymbolAssetRasterUrl(u)) return u;
      }
    }
  }

  return buildGiftAssetSymbolUrl(gift.collection, gift.symbol);
}

/**
 * **Model image layer** — first static main raster (never `/symbols/` or `/backdrops/`).
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {string}
 */
export function resolveModelImageLayerUrl(gift) {
  if (!gift || typeof gift !== "object") return "";
  const list = getMainGiftRasterCandidatesForDisplay(gift);
  return list[0]?.url || "";
}

/**
 * **Animation layer** — motion URL only; rejects symbol/backdrop/pattern/icon and static `/models/*.png` rasters.
 * @param {unknown} raw
 * @returns {string}
 */
export function resolveCollectibleAnimationUrl(raw) {
  const u = typeof raw === "string" ? raw.trim() : "";
  if (!u || !/^https?:\/\//i.test(u)) return "";
  if (isThemeOrSymbolAssetRasterUrl(u)) return "";
  const lower = u.toLowerCase();
  if (lower.includes("/models/") && /\.(png|webp|jpe?g)(\?|$)/i.test(lower)) return "";
  return u;
}

/**
 * All four Portals-style layers for UI + `?imageDebug=1`.
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {{
 *   backdropColor: string;
 *   symbolPatternUrl: string;
 *   modelImageUrl: string;
 *   modelAnimationUrl: string;
 * }}
 */
export function resolveGiftCollectibleVisualLayers(gift) {
  const { backdropColor } = resolveBackdropPaintLayer(gift);
  const symbolPatternUrl = resolveSymbolPatternUrl(gift);
  const modelImageUrl = resolveModelImageLayerUrl(gift);
  const modelAnimationUrl = gift && typeof gift === "object" ? resolveCollectibleAnimationUrl(gift.animationUrl) : "";

  return {
    backdropColor,
    symbolPatternUrl,
    modelImageUrl,
    modelAnimationUrl,
  };
}
