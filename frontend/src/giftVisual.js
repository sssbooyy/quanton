import {
  resolveGiftAssetPublicImage,
  listGiftPublicKeys,
} from "@shared/giftPublicImageResolve.js";

/** @param {unknown} u */
function trimUrl(u) {
  return typeof u === "string" ? u.trim() : "";
}

/** @param {string} u */
export function isRenderableMediaUrl(u) {
  const s = trimUrl(u);
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (/^data:image\//i.test(s)) return true;
  if (s.startsWith("/")) return true;
  return false;
}

/** @deprecated alias */
export function isRenderableImageUrl(u) {
  return isRenderableMediaUrl(u);
}

/** Successful upscale terminal states (legacy `complete` + new `done`). */
export const UPSCALE_FINISHED_STATUSES = new Set(["complete", "done"]);

/**
 * @param {unknown} status
 * @returns {boolean}
 */
export function isUpscaleFinished(status) {
  return UPSCALE_FINISHED_STATUSES.has(String(status || "").trim());
}

/**
 * `?imageDebug=1` or `localStorage.setItem("quantonImageDebug","1")`
 * @returns {boolean}
 */
export function isImageDebugEnabled() {
  try {
    if (typeof window === "undefined") return false;
    if (window.localStorage?.getItem("quantonImageDebug") === "1") return true;
    return new URLSearchParams(window.location.search).get("imageDebug") === "1";
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, unknown>} gift
 */
export function isOpenGraphMediaFallback(gift) {
  return String(gift?.mediaSource || "").trim() === "opengraph";
}

/**
 * Bust CDN/browser cache after server swaps in a new Replicate URL.
 * @param {string} url
 * @param {Record<string, unknown>} gift
 */
export function cacheBustMediaUrl(url, gift) {
  const u = trimUrl(url);
  if (!u || !gift?.imageUpscaled) return u;
  const raw = gift.imageUpscaledAt;
  const t = typeof raw === "string" ? Date.parse(raw) : raw instanceof Date ? raw.getTime() : 0;
  if (!t || Number.isNaN(t)) return u;
  const sep = u.includes("?") ? "&" : "?";
  return `${u}${sep}hdcache=${t}`;
}

/**
 * Raw API fields (for dev logging / debug overlay).
 * @param {Record<string, unknown>} gift
 */
export function giftImageFieldsForDebug(gift) {
  const resolution = resolveGiftAssetPublicImage(gift);
  const legacyChosen =
    trimUrl(gift.imageHiRes) ||
    trimUrl(gift.image) ||
    trimUrl(gift.animationPosterUrl) ||
    trimUrl(gift.imageThumb);
  const resolvedImageUrl = resolution.url || legacyChosen;
  const imageFromPublic = Boolean(
    resolution.field &&
      (resolution.source === "gift_asset_public" || resolution.field.startsWith("public."))
  );
  return {
    collection: String(gift.collection || ""),
    model: String(gift.model || ""),
    symbol: String(gift.symbol || ""),
    backdrop: String(gift.backdrop || ""),
    imageHiRes: trimUrl(gift.imageHiRes),
    image: trimUrl(gift.image),
    imageThumb: trimUrl(gift.imageThumb),
    imageOriginal: trimUrl(gift.imageOriginal),
    animationPosterUrl: trimUrl(gift.animationPosterUrl),
    animationUrl: trimUrl(gift.animationUrl),
    mediaSource: String(gift.mediaSource || ""),
    mediaMatchLevel: String(gift.mediaMatchLevel || ""),
    backdropThemeKey: String(gift.backdropTheme?.key || ""),
    symbolPatternId:
      gift.symbolPattern && typeof gift.symbolPattern === "object" && gift.symbolPattern.enabled
        ? String(gift.symbolPattern.id || "")
        : "",
    heroBackgroundSnippet: String(gift.heroBackground?.gradient || "").slice(0, 140),
    resolvedImageUrl,
    imageSourceField: resolution.field || (legacyChosen ? "legacy(top-level)" : ""),
    imageResolutionSource: resolution.url ? resolution.source : legacyChosen ? "legacy" : "none",
    imageFromPublicField: imageFromPublic,
    imageCheckedFields: resolution.checkedFields.join(" → ") || "—",
    giftPublicKeys: listGiftPublicKeys(gift).join(", ") || "—",
    chosenImageUrl: legacyChosen,
    imageSrcSet: trimUrl(gift.imageSrcSet),
    imageUpscaled: Boolean(gift.imageUpscaled),
    imageUpscaleStatus: String(gift.imageUpscaleStatus || ""),
  };
}

/**
 * Best static raster for detail: Gift Asset public fields, then top-level/media fallbacks.
 * @param {Record<string, unknown>} gift
 */
export function bestStaticRasterUrl(gift) {
  const r = resolveGiftAssetPublicImage(gift);
  return (
    r.url ||
    trimUrl(gift.imageHiRes) ||
    trimUrl(gift.image) ||
    trimUrl(gift.animationPosterUrl) ||
    trimUrl(gift.imageThumb)
  );
}

/**
 * Grid card: **imageThumb** for grid; hi-res only via srcSet when not upscaled.
 * @param {Record<string, unknown>} gift
 */
export function cardImageSources(gift) {
  const r = resolveGiftAssetPublicImage(gift);
  const hi = trimUrl(gift.imageHiRes) || trimUrl(gift.image) || r.url;
  const thumb = trimUrl(gift.imageThumb);
  const poster = trimUrl(gift.animationPosterUrl);
  const ogOnly = isOpenGraphMediaFallback(gift);

  let src = thumb || hi || poster;
  if (ogOnly && src) {
    src = thumb || hi || poster;
  } else {
    src = thumb && hi ? thumb : hi || thumb || poster;
  }

  const apiSet = trimUrl(gift.imageSrcSet);
  let srcSet = apiSet || undefined;
  if (!gift.imageUpscaled && thumb && hi && thumb !== hi && !ogOnly) {
    srcSet = srcSet || `${thumb} 1x, ${hi} 2x`;
  }

  return { src, srcSet, hiRes: hi || src, ogOnly };
}

/**
 * While backend upscale is pending, show the original OpenGraph / source raster.
 * @param {Record<string, unknown>} gift
 */
export function cardRasterSources(gift) {
  if (gift.imageUpscaleStatus === "pending" && trimUrl(gift.imageOriginal)) {
    const o = trimUrl(gift.imageOriginal);
    const r = resolveGiftAssetPublicImage(gift);
    const hi = trimUrl(gift.imageHiRes) || trimUrl(gift.image) || r.url || o;
    return {
      src: o,
      srcSet: undefined,
      hiRes: hi,
      pending: true,
      ogOnly: true,
    };
  }
  const base = { ...cardImageSources(gift), pending: false };
  return {
    ...base,
    src: cacheBustMediaUrl(base.src, gift),
    srcSet: gift.imageUpscaled ? undefined : base.srcSet,
  };
}

/**
 * Detail static raster (full quality): hi-res chain only.
 * @param {Record<string, unknown>} gift
 */
export function detailStaticRaster(gift) {
  return bestStaticRasterUrl(gift);
}

/**
 * Detail hero raster while upscale job runs.
 * @param {Record<string, unknown>} gift
 */
export function detailRasterWhileUpscale(gift) {
  if (gift.imageUpscaleStatus === "pending" && trimUrl(gift.imageOriginal)) {
    return trimUrl(gift.imageOriginal);
  }
  return detailStaticRaster(gift);
}

/**
 * Poster / hero stack for Lottie/video.
 * @param {Record<string, unknown>} gift
 */
export function stackedPosterUrl(gift) {
  if (gift.imageUpscaleStatus === "pending" && trimUrl(gift.imageOriginal)) {
    return trimUrl(gift.imageOriginal) || bestStaticRasterUrl(gift);
  }
  return bestStaticRasterUrl(gift);
}

/**
 * Resolved poster URL for `GiftAnimatedHero` (cache-busted when upscaled).
 * @param {Record<string, unknown>} gift
 */
export function detailHeroPosterUrl(gift) {
  const stack = stackedPosterUrl(gift);
  if (isRenderableMediaUrl(stack)) return cacheBustMediaUrl(stack, gift);
  const hero = detailRasterWhileUpscale(gift);
  return cacheBustMediaUrl(hero, gift);
}

/**
 * @param {Record<string, unknown>} gift
 * @returns {"contain" | "cover"}
 */
export function giftMediaFit(gift) {
  if (isOpenGraphMediaFallback(gift)) return "cover";
  return gift.imageFit === "cover" ? "cover" : "contain";
}

/**
 * @param {string} context
 * @param {Record<string, unknown>} gift
 * @param {{ src: string; srcSet?: string; heroPoster?: string }} chosen
 */
/**
 * DEV: when Gift Asset public fields yield no raster URL, log the walk for Trial debugging.
 * @param {Record<string, unknown>} gift
 * @param {string} context
 */
export function logGiftPublicImageMiss(gift, context = "gift") {
  if (!import.meta.env.DEV) return;
  const r = resolveGiftAssetPublicImage(gift);
  if (r.url) return;
  const id = gift?.id ?? gift?.listingId ?? "?";
  console.debug(`[gift-public-image] miss:${context}`, id, {
    checkedFields: r.checkedFields,
    giftPublicKeys: listGiftPublicKeys(gift),
  });
}

export function logGiftImageChoice(context, gift, chosen) {
  if (!import.meta.env.DEV) return;
  logGiftPublicImageMiss(gift, context);
  const id = gift?.id ?? gift?.listingId ?? "?";
  console.debug(`[gift-image] ${context}`, id, {
    ...giftImageFieldsForDebug(gift),
    renderedCardSrc: chosen.src || "",
    renderedCardSrcSet: chosen.srcSet || "",
    renderedHeroPoster: chosen.heroPoster || "",
  });
}
