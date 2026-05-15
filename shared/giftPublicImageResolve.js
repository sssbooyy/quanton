/**
 * Resolve static raster URLs from Gift Asset–style public payloads (Trial-safe: no User-Data).
 *
 * Main collectible image: see `resolveMainGiftRasterImage` (public → constructed /models/ URL → root/media/legacy).
 * Symbol/backdrop/pattern/icon CDN paths must not be used as the main poster (see isThemeOrSymbolAssetRasterUrl).
 */

/** Path segments that indicate theme/decoration assets, not the gift poster. */
export const MAIN_RASTER_EXCLUDED_PATH_SEGMENTS = ["/symbols/", "/backdrops/", "/patterns/", "/icons/"];

const GIFT_ASSET_DATA_BASE = "https://giftasset.gifts/api/v1/data";

/**
 * @param {unknown} url
 * @returns {boolean}
 */
export function isThemeOrSymbolAssetRasterUrl(url) {
  const u = typeof url === "string" ? url.trim().toLowerCase() : "";
  if (!u) return false;
  return MAIN_RASTER_EXCLUDED_PATH_SEGMENTS.some((seg) => u.includes(seg));
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
 * Priority: (a) public bucket non-theme URLs → (b) constructed /models/ URL → (c) root/media/legacy non-theme.
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {MainRasterResolution}
 */
export function resolveMainGiftRasterImage(gift) {
  /** @type {string[]} */
  const checkedFields = [];
  let rejectedImageUrl = "";
  let rejectedField = "";

  const constructedModelImageUrl = buildGiftAssetModelUrl(gift?.collection, gift?.model);

  /**
   * @param {string} field
   * @param {string} url
   */
  const rejectTheme = (field, url) => {
    if (!rejectedImageUrl) {
      rejectedImageUrl = url;
      rejectedField = field;
    }
  };

  // (a) Gift Assist / public explicit image fields only
  const pub = getGiftPublicBucket(gift);
  if (pub) {
    for (const k of PUBLIC_IMAGE_KEYS) {
      const field = `public.${k}`;
      checkedFields.push(field);
      const url = pickUrl(pub[k]);
      if (!url) continue;
      if (isThemeOrSymbolAssetRasterUrl(url)) {
        rejectTheme(field, url);
        continue;
      }
      return finalizeMainRasterHit({
        url,
        field,
        source: "gift_asset_public",
        checkedFields: [...checkedFields],
        rejectedImageUrl,
        rejectedField,
        constructedModelImageUrl,
      });
    }
  }

  // (b) Constructed Gift Asset model URL (same pattern as Stellar Rocket knowledge.png)
  if (constructedModelImageUrl) {
    checkedFields.push("constructed.modelUrl");
    return finalizeMainRasterHit({
      url: constructedModelImageUrl,
      field: "constructed.modelUrl",
      source: "gift_asset_model_url",
      checkedFields: [...checkedFields],
      rejectedImageUrl,
      rejectedField,
      constructedModelImageUrl,
    });
  }

  // (c) Root, media, legacy — never theme/symbol paths
  for (const k of ROOT_IMAGE_KEYS) {
    const field = k;
    checkedFields.push(field);
    const url = pickUrl(gift?.[k]);
    if (!url) continue;
    if (isThemeOrSymbolAssetRasterUrl(url)) {
      rejectTheme(field, url);
      continue;
    }
    return finalizeMainRasterHit({
      url,
      field,
      source: "gift_root",
      checkedFields: [...checkedFields],
      rejectedImageUrl,
      rejectedField,
      constructedModelImageUrl,
    });
  }

  const media = getGiftMediaBucket(gift);
  if (media) {
    for (const k of MEDIA_IMAGE_KEYS) {
      const field = `media.${k}`;
      checkedFields.push(field);
      const url = pickUrl(media[k]);
      if (!url) continue;
      if (isThemeOrSymbolAssetRasterUrl(url)) {
        rejectTheme(field, url);
        continue;
      }
      return finalizeMainRasterHit({
        url,
        field,
        source: "gift_asset_media",
        checkedFields: [...checkedFields],
        rejectedImageUrl,
        rejectedField,
        constructedModelImageUrl,
      });
    }
  }

  for (const k of LEGACY_FALLBACK_KEYS) {
    const field = k;
    checkedFields.push(field);
    const url = pickUrl(gift?.[k]);
    if (!url) continue;
    if (isThemeOrSymbolAssetRasterUrl(url)) {
      rejectTheme(field, url);
      continue;
    }
    return finalizeMainRasterHit({
      url,
      field,
      source: "gift_root",
      checkedFields: [...checkedFields],
      rejectedImageUrl,
      rejectedField,
      constructedModelImageUrl,
    });
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
