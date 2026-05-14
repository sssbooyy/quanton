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
 * Detail static raster (full quality).
 * @param {Record<string, unknown>} gift
 */
export function detailStaticRaster(gift) {
  return trimUrl(gift.imageHiRes) || trimUrl(gift.image);
}

/**
 * Poster hierarchy: animation poster → thumb → hi-res → legacy image.
 * @param {Record<string, unknown>} gift
 */
export function stackedPosterUrl(gift) {
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
