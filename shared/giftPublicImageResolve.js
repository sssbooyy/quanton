/**
 * Resolve static raster URLs from Gift Asset–style public payloads (Trial-safe: no User-Data).
 *
 * **Model image layer** (main poster): `resolveMainGiftRasterImage` / `getMainGiftRasterCandidates` — public →
 * constructed `/models/` URL → root → media. Never accepts `/symbols/`, `/backdrops/`, `/patterns/`, or `/icons/`
 * (`isThemeOrSymbolAssetRasterUrl`). `/models/` URLs are reserved for that layer only.
 *
 * Symbol/backdrop CDN rasters are resolved separately (see `giftCollectibleLayers.js`).
 */

/** Path segments excluded from the main model raster pipeline (Portals-style separation). */
export const MAIN_RASTER_EXCLUDED_PATH_SEGMENTS = ["/symbols/", "/backdrops/", "/patterns/", "/icons/"];

const GIFT_ASSET_DATA_BASE = "https://giftasset.gifts/api/v1/data";

/**
 * @param {unknown} url
 * @returns {string}
 */
function lowerTrimUrl(url) {
  return typeof url === "string" ? url.trim().toLowerCase() : "";
}

/**
 * Gift Asset symbol trait raster (`…/symbols/{name}.png`).
 * @param {unknown} url
 * @returns {boolean}
 */
export function isSymbolAssetRasterUrl(url) {
  const u = lowerTrimUrl(url);
  return Boolean(u && u.includes("/symbols/"));
}

/**
 * Gift Asset backdrop trait raster (`…/backdrops/{name}.png`).
 * @param {unknown} url
 * @returns {boolean}
 */
export function isBackdropAssetRasterUrl(url) {
  const u = lowerTrimUrl(url);
  return Boolean(u && u.includes("/backdrops/"));
}

/**
 * @param {unknown} url
 * @returns {boolean}
 */
export function isPatternOrIconAssetRasterUrl(url) {
  const u = lowerTrimUrl(url);
  return Boolean(u && (u.includes("/patterns/") || u.includes("/icons/")));
}

/**
 * True when URL must not be used as the main collectible static image (model layer).
 * @param {unknown} url
 * @returns {boolean}
 */
export function isThemeOrSymbolAssetRasterUrl(url) {
  return isSymbolAssetRasterUrl(url) || isBackdropAssetRasterUrl(url) || isPatternOrIconAssetRasterUrl(url);
}

/**
 * Lowercase, strip spaces and punctuation; keep letters and digits only (Gift Asset collection/model slugs).
 * @param {unknown} input
 * @returns {string}
 */
export function normalizeGiftAssetSlug(input) {
  if (input == null) return "";
  return String(input)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Canonical Gift Asset model raster URL for a collection + model name.
 * @param {unknown} collection
 * @param {unknown} model
 * @returns {string} HTTPS URL or "" if either slug is empty after normalization.
 */
export function buildGiftAssetModelUrl(collection, model) {
  const c = normalizeGiftAssetSlug(collection);
  const m = normalizeGiftAssetSlug(model);
  if (!c || !m) return "";
  return `${GIFT_ASSET_DATA_BASE}/${c}/models/${m}.png`;
}

/**
 * Canonical Gift Asset **symbol** raster (symbol layer / debug only; not the main model poster).
 * @param {unknown} collection
 * @param {unknown} symbol
 * @returns {string}
 */
export function buildGiftAssetSymbolUrl(collection, symbol) {
  const c = normalizeGiftAssetSlug(collection);
  const s = normalizeGiftAssetSlug(symbol);
  if (!c || !s) return "";
  return `${GIFT_ASSET_DATA_BASE}/${c}/symbols/${s}.png`;
}

/**
 * Canonical Gift Asset **backdrop** raster (backdrop layer if a raster is needed; trait-solid uses color).
 * @param {unknown} collection
 * @param {unknown} backdrop
 * @returns {string}
 */
export function buildGiftAssetBackdropUrl(collection, backdrop) {
  const c = normalizeGiftAssetSlug(collection);
  const b = normalizeGiftAssetSlug(backdrop);
  if (!c || !b) return "";
  return `${GIFT_ASSET_DATA_BASE}/${c}/backdrops/${b}.png`;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function pickUrl(v) {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v && typeof v === "object" && typeof v.url === "string" && v.url.trim()) return v.url.trim();
  return "";
}

/**
 * @param {Record<string, unknown> | null | undefined} gift
 */
export function getGiftPublicBucket(gift) {
  if (!gift || typeof gift !== "object") return null;
  const p = gift.public;
  if (p && typeof p === "object") return /** @type {Record<string, unknown>} */ (p);
  const cm = gift.cachedMetadata;
  if (cm && typeof cm === "object" && cm.public && typeof cm.public === "object") {
    return /** @type {Record<string, unknown>} */ (cm.public);
  }
  return null;
}

/**
 * @param {Record<string, unknown> | null | undefined} gift
 */
export function getGiftMediaBucket(gift) {
  if (!gift || typeof gift !== "object") return null;
  const m = gift.media;
  if (m && typeof m === "object") return /** @type {Record<string, unknown>} */ (m);
  const cm = gift.cachedMetadata;
  if (cm && typeof cm === "object" && cm.media && typeof cm.media === "object") {
    return /** @type {Record<string, unknown>} */ (cm.media);
  }
  return null;
}

const PUBLIC_IMAGE_KEYS = ["image", "imageUrl", "preview", "previewUrl", "thumbnail", "thumbnailUrl"];

const ROOT_IMAGE_KEYS = [
  "imageHiRes",
  "image",
  "imageUrl",
  "preview",
  "previewUrl",
  "thumbnail",
  "thumbnailUrl",
];

const MEDIA_IMAGE_KEYS = ["image", "preview", "thumbnail"];

const LEGACY_FALLBACK_KEYS = ["animationPosterUrl", "imageThumb"];

/**
 * Root raster keys for the main poster pipeline (after public + constructed model).
 * `animationPosterUrl` / `imageThumb` before other root URL fields, then media.
 */
const MAIN_GIFT_ROOT_RASTER_ORDER = [
  "imageHiRes",
  "image",
  "animationPosterUrl",
  "imageThumb",
  "imageUrl",
  "preview",
  "previewUrl",
  "thumbnail",
  "thumbnailUrl",
];

/**
 * Single ordered walk for `getMainGiftRasterCandidates` / `resolveMainGiftRasterImage`.
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {Generator<{ field: string; url: string; source: string }>}
 */
function* iterateMainGiftRasterResolutionOrder(gift) {
  const pub = getGiftPublicBucket(gift);
  if (pub) {
    for (const k of PUBLIC_IMAGE_KEYS) {
      const field = `public.${k}`;
      yield { field, url: pickUrl(pub[k]), source: "gift_asset_public" };
    }
  }
  const modelUrl = buildGiftAssetModelUrl(gift?.collection, gift?.model);
  if (modelUrl) {
    yield { field: "constructed.modelUrl", url: modelUrl, source: "gift_asset_model_url" };
  }
  for (const k of MAIN_GIFT_ROOT_RASTER_ORDER) {
    yield { field: k, url: pickUrl(gift?.[k]), source: "gift_root" };
  }
  const media = getGiftMediaBucket(gift);
  if (media) {
    for (const k of MEDIA_IMAGE_KEYS) {
      yield { field: `media.${k}`, url: pickUrl(media[k]), source: "gift_asset_media" };
    }
  }
}

/**
 * @typedef {{
 *   url: string;
 *   field: string;
 *   source: string;
 *   checkedFields: string[];
 *   imageRejectedReason: string;
 *   rejectedImageUrl: string;
 *   rejectedField: string;
 *   constructedModelImageUrl: string;
 * }} MainRasterResolution
 */

/**
 * @param {{
 *   url: string;
 *   field: string;
 *   source: string;
 *   checkedFields: string[];
 *   rejectedImageUrl: string;
 *   rejectedField: string;
 *   constructedModelImageUrl: string;
 * }} p
 * @returns {MainRasterResolution}
 */
function finalizeMainRasterHit(p) {
  const reason = p.rejectedImageUrl ? "symbol-or-theme-asset" : "";
  return {
    url: p.url,
    field: p.field,
    source: p.source,
    checkedFields: p.checkedFields,
    imageRejectedReason: reason,
    rejectedImageUrl: p.rejectedImageUrl,
    rejectedField: p.rejectedField,
    constructedModelImageUrl: p.constructedModelImageUrl,
  };
}

/**
 * @typedef {{ url: string; field: string; source: string }} MainRasterCandidate
 */

/**
 * Ordered unique main-raster candidates: public → constructed model URL → root → media.
 * Skips theme/symbol URLs (`/symbols/`, `/backdrops/`, `/patterns/`, `/icons/`).
 * Used for runtime `onError` fallback when /models/*.png 404s.
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {MainRasterCandidate[]}
 */
export function getMainGiftRasterCandidates(gift) {
  /** @type {MainRasterCandidate[]} */
  const list = [];
  const seen = new Set();

  for (const step of iterateMainGiftRasterResolutionOrder(gift)) {
    const u = typeof step.url === "string" ? step.url.trim() : "";
    if (!u || isThemeOrSymbolAssetRasterUrl(u)) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    list.push({ url: u, field: step.field, source: step.source });
  }
  return list;
}

/**
 * Model-layer candidates with upscale-pending `imageOriginal` hoisted first (shared ordering for UI + layer debug).
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {MainRasterCandidate[]}
 */
export function getMainGiftRasterCandidatesForDisplay(gift) {
  if (!gift || typeof gift !== "object") {
    return getMainGiftRasterCandidates(gift);
  }
  if (gift.imageUpscaleStatus === "pending") {
    const o = typeof gift.imageOriginal === "string" ? gift.imageOriginal.trim() : "";
    if (o && !isThemeOrSymbolAssetRasterUrl(o)) {
      const rest = getMainGiftRasterCandidates(gift);
      const seen = new Set([o]);
      /** @type {MainRasterCandidate[]} */
      const out = [{ url: o, field: "imageOriginal", source: "gift_original_pending" }];
      for (const c of rest) {
        if (!seen.has(c.url)) {
          seen.add(c.url);
          out.push(c);
        }
      }
      return out;
    }
  }
  return getMainGiftRasterCandidates(gift);
}

/**
 * Chosen main raster is `getMainGiftRasterCandidatesForDisplay(gift)[0]` (aligned with card/detail + layer model URL).
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {MainRasterResolution}
 */
export function resolveMainGiftRasterImage(gift) {
  const constructedModelImageUrl = buildGiftAssetModelUrl(gift?.collection, gift?.model);
  const candidates = getMainGiftRasterCandidatesForDisplay(gift);

  if (candidates.length > 0) {
    const first = candidates[0];
    /** @type {string[]} */
    const checkedFields = [];
    let rejectedImageUrl = "";
    let rejectedField = "";

    for (const step of iterateMainGiftRasterResolutionOrder(gift)) {
      checkedFields.push(step.field);
      const url = typeof step.url === "string" ? step.url.trim() : "";
      if (!url) continue;
      if (isThemeOrSymbolAssetRasterUrl(url)) {
        if (!rejectedImageUrl) {
          rejectedImageUrl = url;
          rejectedField = step.field;
        }
        continue;
      }
      if (step.field === first.field && url === first.url) {
        return finalizeMainRasterHit({
          url: first.url,
          field: first.field,
          source: first.source,
          checkedFields,
          rejectedImageUrl,
          rejectedField,
          constructedModelImageUrl,
        });
      }
    }

    return finalizeMainRasterHit({
      url: first.url,
      field: first.field,
      source: first.source,
      checkedFields,
      rejectedImageUrl,
      rejectedField,
      constructedModelImageUrl,
    });
  }

  /** @type {string[]} */
  const checkedFields = [];
  let rejectedImageUrl = "";
  let rejectedField = "";
  for (const step of iterateMainGiftRasterResolutionOrder(gift)) {
    checkedFields.push(step.field);
    const url = typeof step.url === "string" ? step.url.trim() : "";
    if (url && isThemeOrSymbolAssetRasterUrl(url)) {
      if (!rejectedImageUrl) {
        rejectedImageUrl = url;
        rejectedField = step.field;
      }
    }
  }

  return {
    url: "",
    field: "",
    source: "none",
    checkedFields,
    imageRejectedReason: rejectedImageUrl ? "symbol-or-theme-asset" : "",
    rejectedImageUrl,
    rejectedField,
    constructedModelImageUrl,
  };
}

/**
 * @typedef {{
 *   url: string;
 *   field: string;
 *   source: string;
 *   checkedFields: string[];
 *   imageRejectedReason: string;
 *   rejectedImageUrl: string;
 *   rejectedField: string;
 * }} PublicImageResolution
 */

/**
 * Single-pass walk: public → root → media → legacy (no constructed model URL). Prefer `resolveMainGiftRasterImage` for UI/API.
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {PublicImageResolution & { constructedModelImageUrl: string }}
 */
export function resolveGiftAssetPublicImage(gift) {
  /** @type {string[]} */
  const checkedFields = [];
  let rejectedImageUrl = "";
  let rejectedField = "";
  const constructedModelImageUrl = buildGiftAssetModelUrl(gift?.collection, gift?.model);

  /**
   * @param {string} field
   * @param {unknown} raw
   * @returns {PublicImageResolution | null}
   */
  const tryField = (field, raw) => {
    checkedFields.push(field);
    const url = pickUrl(raw);
    if (!url) return null;
    if (isThemeOrSymbolAssetRasterUrl(url)) {
      if (!rejectedImageUrl) {
        rejectedImageUrl = url;
        rejectedField = field;
      }
      return null;
    }
    let source = "gift_root";
    if (field.startsWith("public.")) source = "gift_asset_public";
    else if (field.startsWith("media.")) source = "gift_asset_media";
    return {
      url,
      field,
      source,
      checkedFields: [...checkedFields],
      imageRejectedReason: rejectedImageUrl ? "symbol-or-theme-asset" : "",
      rejectedImageUrl,
      rejectedField,
      constructedModelImageUrl,
    };
  };

  const pub = getGiftPublicBucket(gift);
  if (pub) {
    for (const k of PUBLIC_IMAGE_KEYS) {
      const hit = tryField(`public.${k}`, pub[k]);
      if (hit) return { ...hit, constructedModelImageUrl };
    }
  }

  for (const k of ROOT_IMAGE_KEYS) {
    const hit = tryField(k, gift?.[k]);
    if (hit) return { ...hit, constructedModelImageUrl };
  }

  const media = getGiftMediaBucket(gift);
  if (media) {
    for (const k of MEDIA_IMAGE_KEYS) {
      const hit = tryField(`media.${k}`, media[k]);
      if (hit) return { ...hit, constructedModelImageUrl };
    }
  }

  for (const k of LEGACY_FALLBACK_KEYS) {
    const hit = tryField(k, gift?.[k]);
    if (hit) return { ...hit, constructedModelImageUrl };
  }

  return {
    url: "",
    field: "",
    source: "none",
    checkedFields,
    imageRejectedReason: rejectedImageUrl ? "symbol-or-theme-asset" : "",
    rejectedImageUrl,
    rejectedField,
    constructedModelImageUrl,
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {string[]}
 */
export function listGiftPublicKeys(gift) {
  const b = getGiftPublicBucket(gift);
  if (!b) return [];
  return Object.keys(b);
}
