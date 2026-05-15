/**
 * Resolve static raster URLs from Gift Asset–style public payloads (Trial-safe: no User-Data).
 * Checks gift.public, gift.cachedMetadata.public, gift.media, gift.cachedMetadata.media, then root fields.
 *
 * Symbol/backdrop/pattern/icon CDN paths must not be used as the main collectible poster (see isThemeOrSymbolAssetRasterUrl).
 */

/** Path segments that indicate theme/decoration assets, not the gift poster. */
export const MAIN_RASTER_EXCLUDED_PATH_SEGMENTS = ["/symbols/", "/backdrops/", "/patterns/", "/icons/"];

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
 * }} PublicImageResolution
 */

/**
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {PublicImageResolution}
 */
export function resolveGiftAssetPublicImage(gift) {
  /** @type {string[]} */
  const checkedFields = [];
  let rejectedImageUrl = "";
  let rejectedField = "";

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
    };
  };

  const pub = getGiftPublicBucket(gift);
  if (pub) {
    for (const k of PUBLIC_IMAGE_KEYS) {
      const hit = tryField(`public.${k}`, pub[k]);
      if (hit) return hit;
    }
  }

  for (const k of ROOT_IMAGE_KEYS) {
    const hit = tryField(k, gift?.[k]);
    if (hit) return hit;
  }

  const media = getGiftMediaBucket(gift);
  if (media) {
    for (const k of MEDIA_IMAGE_KEYS) {
      const hit = tryField(`media.${k}`, media[k]);
      if (hit) return hit;
    }
  }

  for (const k of LEGACY_FALLBACK_KEYS) {
    const hit = tryField(k, gift?.[k]);
    if (hit) return hit;
  }

  return {
    url: "",
    field: "",
    source: "none",
    checkedFields,
    imageRejectedReason: rejectedImageUrl ? "symbol-or-theme-asset" : "",
    rejectedImageUrl,
    rejectedField,
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
