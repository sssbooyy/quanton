/** @param {unknown} u */
function trimUrl(u) {
  return typeof u === "string" ? u.trim() : "";
}

/** @param {string} u */
function isRenderableHttpOrDataUrl(u) {
  const s = trimUrl(u);
  return /^https?:\/\//i.test(s) || /^data:image\//i.test(s);
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
  return {
    imageHiRes: trimUrl(gift.imageHiRes),
    image: trimUrl(gift.image),
    imageThumb: trimUrl(gift.imageThumb),
    imageOriginal: trimUrl(gift.imageOriginal),
    animationPosterUrl: trimUrl(gift.animationPosterUrl),
    imageSrcSet: trimUrl(gift.imageSrcSet),
    imageUpscaled: Boolean(gift.imageUpscaled),
    imageUpscaleStatus: String(gift.imageUpscaleStatus || ""),
  };
}

/**
 * Best static raster: **imageHiRes** first, then image, thumb, animation poster (never OG before hi when hi exists).
 * @param {Record<string, unknown>} gift
 */
export function bestStaticRasterUrl(gift) {
  return (
    trimUrl(gift.imageHiRes) ||
    trimUrl(gift.image) ||
    trimUrl(gift.imageThumb) ||
    trimUrl(gift.animationPosterUrl)
  );
}

/**
 * Grid card: always prefer **imageHiRes** over thumb / poster so upscaled Replicate output is not shadowed by OG thumb.
 * When `imageUpscaled`, do not emit thumb@1x / hi@2x srcSet (stale thumb would win on 1x DPR).
 * @param {Record<string, unknown>} gift
 */
export function cardImageSources(gift) {
  const hi = trimUrl(gift.imageHiRes) || trimUrl(gift.image);
  const thumb = trimUrl(gift.imageThumb);
  const poster = trimUrl(gift.animationPosterUrl);
  const src = hi || thumb || poster;
  const apiSet = trimUrl(gift.imageSrcSet);
  let srcSet = apiSet || undefined;
  if (!gift.imageUpscaled && thumb && hi && thumb !== hi) {
    srcSet = srcSet || `${thumb} 1x, ${hi} 2x`;
  }
  return { src, srcSet, hiRes: hi || src };
}

/**
 * While backend upscale is pending, show the original OpenGraph / source raster until Mongo swaps in hi-res.
 * @param {Record<string, unknown>} gift
 */
export function cardRasterSources(gift) {
  if (gift.imageUpscaleStatus === "pending" && trimUrl(gift.imageOriginal)) {
    const o = trimUrl(gift.imageOriginal);
    const hi = trimUrl(gift.imageHiRes) || trimUrl(gift.image) || o;
    const raw = { src: o, srcSet: undefined, hiRes: hi, pending: true };
    return {
      ...raw,
      src: cacheBustMediaUrl(raw.src, gift),
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
 * Detail static raster (full quality): hi-res chain only (no animation poster before hi).
 * @param {Record<string, unknown>} gift
 */
export function detailStaticRaster(gift) {
  return bestStaticRasterUrl(gift);
}

/**
 * Detail hero raster while upscale job runs: keep OG visible until server marks finished.
 * @param {Record<string, unknown>} gift
 */
export function detailRasterWhileUpscale(gift) {
  if (gift.imageUpscaleStatus === "pending" && trimUrl(gift.imageOriginal)) {
    return trimUrl(gift.imageOriginal);
  }
  return detailStaticRaster(gift);
}

/**
 * Poster / hero stack: **imageHiRes** before animationPosterUrl so Lottie/video posters show the upscaled raster.
 * @param {Record<string, unknown>} gift
 */
export function stackedPosterUrl(gift) {
  if (gift.imageUpscaleStatus === "pending" && trimUrl(gift.imageOriginal)) {
    const o = trimUrl(gift.imageOriginal);
    return (
      o ||
      trimUrl(gift.imageHiRes) ||
      trimUrl(gift.image) ||
      trimUrl(gift.animationPosterUrl) ||
      trimUrl(gift.imageThumb)
    );
  }
  return (
    trimUrl(gift.imageHiRes) ||
    trimUrl(gift.image) ||
    trimUrl(gift.animationPosterUrl) ||
    trimUrl(gift.imageThumb)
  );
}

/**
 * Resolved poster URL for `GiftAnimatedHero` (cache-busted when upscaled).
 * @param {Record<string, unknown>} gift
 */
export function detailHeroPosterUrl(gift) {
  const stack = stackedPosterUrl(gift);
  if (isRenderableHttpOrDataUrl(stack)) return cacheBustMediaUrl(stack, gift);
  const hero = detailRasterWhileUpscale(gift);
  return cacheBustMediaUrl(hero, gift);
}

/**
 * @param {Record<string, unknown>} gift
 * @returns {"contain" | "cover"}
 */
export function giftMediaFit(gift) {
  return gift.imageFit === "cover" ? "cover" : "contain";
}

/**
 * @param {string} context
 * @param {Record<string, unknown>} gift
 * @param {{ src: string; srcSet?: string; heroPoster?: string }} chosen
 */
export function logGiftImageChoice(context, gift, chosen) {
  if (!import.meta.env.DEV) return;
  const id = gift?.id ?? gift?.listingId ?? "?";
  console.debug(`[gift-image] ${context}`, id, {
    ...giftImageFieldsForDebug(gift),
    renderedCardSrc: chosen.src || "",
    renderedCardSrcSet: chosen.srcSet || "",
    renderedHeroPoster: chosen.heroPoster || "",
  });
}
