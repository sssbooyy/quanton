/** @param {unknown} u */
function trimUrl(u) {
  return typeof u === "string" ? u.trim() : "";
}

/**
 * Grid card: prefer API thumbnail, optional density srcSet.
 * @param {Record<string, unknown>} gift
 */
export function cardImageSources(gift) {
  const thumb = trimUrl(gift.imageThumb);
  const hi = trimUrl(gift.imageHiRes) || trimUrl(gift.image);
  const src = thumb || hi;
  const srcSet =
    trimUrl(gift.imageSrcSet) ||
    (thumb && hi && thumb !== hi ? `${thumb} 1x, ${hi} 2x` : undefined);
  return { src, srcSet, hiRes: hi || src };
}

/**
 * While backend upscale is pending, show the original OpenGraph raster (no frontend upscale).
 * @param {Record<string, unknown>} gift
 */
export function cardRasterSources(gift) {
  if (gift.imageUpscaleStatus === "pending" && trimUrl(gift.imageOriginal)) {
    const o = trimUrl(gift.imageOriginal);
    const hi = trimUrl(gift.imageHiRes) || trimUrl(gift.image) || o;
    return { src: o, srcSet: undefined, hiRes: hi, pending: true };
  }
  return { ...cardImageSources(gift), pending: false };
}

/**
 * Detail static raster (full quality).
 * @param {Record<string, unknown>} gift
 */
export function detailStaticRaster(gift) {
  return trimUrl(gift.imageHiRes) || trimUrl(gift.image);
}

/**
 * Detail hero raster while upscale job runs: keep OG visible until hi-res is swapped server-side.
 * @param {Record<string, unknown>} gift
 */
export function detailRasterWhileUpscale(gift) {
  if (gift.imageUpscaleStatus === "pending" && trimUrl(gift.imageOriginal)) {
    return trimUrl(gift.imageOriginal);
  }
  return detailStaticRaster(gift);
}

/**
 * Poster hierarchy: animation poster → hi-res → legacy image → thumb.
 * When upscale is pending, prefer `imageOriginal` under animations.
 * @param {Record<string, unknown>} gift
 */
export function stackedPosterUrl(gift) {
  if (gift.imageUpscaleStatus === "pending" && trimUrl(gift.imageOriginal)) {
    const o = trimUrl(gift.imageOriginal);
    return (
      trimUrl(gift.animationPosterUrl) || o || trimUrl(gift.imageHiRes) || trimUrl(gift.image) || trimUrl(gift.imageThumb)
    );
  }
  return (
    trimUrl(gift.animationPosterUrl) ||
    trimUrl(gift.imageHiRes) ||
    trimUrl(gift.image) ||
    trimUrl(gift.imageThumb)
  );
}

/**
 * @param {Record<string, unknown>} gift
 * @returns {"contain" | "cover"}
 */
export function giftMediaFit(gift) {
  return gift.imageFit === "cover" ? "cover" : "contain";
}
