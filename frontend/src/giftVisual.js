import {
  resolveMainGiftRasterImage,
  listGiftPublicKeys,
  isThemeOrSymbolAssetRasterUrl,
  getMainGiftRasterCandidatesForDisplay,
} from "@shared/giftPublicImageResolve.js";
import {
  extractBackdropLabelFromGift,
  extractSymbolLabelFromGift,
  resolveCollectibleHeroPresentation,
  resolveBackdropTraitSolid,
  resolveSymbolPattern,
  symbolRasterPatternStyleForHex,
  traitSolidPatternOpacityForHex,
} from "@shared/giftHeroResolve.js";
import { resolveGiftCollectibleVisualLayers } from "@shared/giftCollectibleLayers.js";
import { GIFT_PATTERN_SYMBOL_IDS } from "./giftPatternLayer.js";

export { getMainGiftRasterCandidates, getMainGiftRasterCandidatesForDisplay } from "@shared/giftPublicImageResolve.js";

/** @param {unknown} u */
function trimUrl(u) {
  return typeof u === "string" ? u.trim() : "";
}

/** First trimmed URL acceptable as main collectible raster (not symbol/backdrop CDN assets). */
function pickMainRasterUrl(...candidates) {
  for (const c of candidates) {
    const s = trimUrl(c);
    if (s && !isThemeOrSymbolAssetRasterUrl(s)) return s;
  }
  return "";
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
 * @param {{ failedUrls?: string[]; activeIndex?: number; activeSource?: string }} [runtime]
 */
export function giftImageFieldsForDebug(gift, runtime = {}) {
  const displayC = getMainGiftRasterCandidatesForDisplay(gift);
  const main = resolveMainGiftRasterImage(gift);
  const layers = resolveGiftCollectibleVisualLayers(gift);
  const legacyChosen = pickMainRasterUrl(
    gift.imageHiRes,
    gift.image,
    gift.animationPosterUrl,
    gift.imageThumb
  );
  const resolvedImageUrl = main.url || legacyChosen;
  const imageFromPublic = main.source === "gift_asset_public";
  const activeIdx =
    typeof runtime.activeIndex === "number" ? runtime.activeIndex : displayC.length ? 0 : -1;
  const activeSrc =
    runtime.activeSource ||
    (activeIdx >= 0 && displayC[activeIdx] ? displayC[activeIdx].source : displayC[0]?.source || "none");

  const backdropLabel = extractBackdropLabelFromGift(gift) || String(gift.backdrop || "").trim();
  const pres = resolveCollectibleHeroPresentation(gift);
  const solid = resolveBackdropTraitSolid(pres.backdropTheme, backdropLabel);

  const symbolUrl = layers.symbolPatternUrl;
  const symTrait = resolveSymbolPattern(extractSymbolLabelFromGift(gift));
  const traitSvgId = symTrait?.id && GIFT_PATTERN_SYMBOL_IDS.has(symTrait.id) ? symTrait.id : "";
  const apiSp =
    gift.symbolPattern && typeof gift.symbolPattern === "object" && gift.symbolPattern.enabled
      ? String(gift.symbolPattern.id || "")
      : "";
  const apiSvgId = apiSp && GIFT_PATTERN_SYMBOL_IDS.has(apiSp) ? apiSp : "";
  const symbolPatternRendered = Boolean(symbolUrl || traitSvgId || apiSvgId);

  let symbolPatternOpacity = /** @type {number | null} */ (null);
  let symbolPatternBlendMode = "";
  if (symbolPatternRendered) {
    if (symbolUrl) {
      const st = symbolRasterPatternStyleForHex(layers.backdropColor, {
        isCardSurface: false,
        reducedMotion: false,
      });
      symbolPatternOpacity = st.opacity;
      symbolPatternBlendMode = st.mixBlendMode;
    } else {
      const st = traitSolidPatternOpacityForHex(solid.hex, { isCardSurface: false, reducedMotion: false });
      symbolPatternOpacity = st.opacity;
      symbolPatternBlendMode = st.mixBlendMode;
    }
  }

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
    constructedModelImageUrl: main.constructedModelImageUrl || "",
    imageSourceField: main.field || (legacyChosen ? "legacy(top-level)" : ""),
    imageResolutionSource: main.url ? main.source : legacyChosen ? "legacy" : "none",
    imageFromPublicField: imageFromPublic,
    imageCheckedFields: main.checkedFields.join(" → ") || "—",
    giftPublicKeys: listGiftPublicKeys(gift).join(", ") || "—",
    imageRejectedReason: main.imageRejectedReason || "",
    rejectedImageUrl: main.rejectedImageUrl || "",
    rejectedField: main.rejectedField || "",
    imageCandidates: displayC.map((c) => `${c.source}:${c.field}`).join(" → ") || "—",
    imageCandidateUrls: displayC.map((c) => c.url).join("\n") || "—",
    failedImageUrls: runtime.failedUrls?.length ? runtime.failedUrls.join(", ") : "—",
    activeImageCandidateIndex: activeIdx,
    activeImageSource: activeSrc,
    chosenImageUrl: legacyChosen,
    imageSrcSet: trimUrl(gift.imageSrcSet),
    imageUpscaled: Boolean(gift.imageUpscaled),
    imageUpscaleStatus: String(gift.imageUpscaleStatus || ""),
    backdropLabel,
    backdropLabelUsedForColor: solid.backdropLabelUsedForColor,
    backdropSolidColor: solid.hex,
    backdropColor: layers.backdropColor,
    backdropColorSource: solid.backdropColorMatchPath,
    symbolPatternUrl: layers.symbolPatternUrl,
    symbolPatternScatter: Boolean(layers.symbolPatternUrl),
    symbolPatternRendered,
    symbolPatternOpacity,
    symbolPatternBlendMode,
    modelImageUrl: layers.modelImageUrl,
    modelAnimationUrl: layers.modelAnimationUrl,
  };
}

/**
 * Best static raster for detail / hero stack: unified main gift pipeline (public → model URL → root).
 * @param {Record<string, unknown>} gift
 */
export function bestStaticRasterUrl(gift) {
  return trimUrl(getMainGiftRasterCandidatesForDisplay(gift)[0]?.url || "");
}

/**
 * Grid card: **imageThumb** for grid; hi-res only via srcSet when not upscaled.
 * @deprecated Prefer `useGiftMainRasterImage` in React so card and detail share one candidate chain (avoids src/srcSet mismatch).
 * @param {Record<string, unknown>} gift
 */
export function cardImageSources(gift) {
  const hi = trimUrl(getMainGiftRasterCandidatesForDisplay(gift)[0]?.url || "");
  const thumb = pickMainRasterUrl(gift.imageThumb);
  const poster = pickMainRasterUrl(gift.animationPosterUrl);
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
 * @deprecated Prefer `useGiftMainRasterImage` in React; kept for non-UI callers if any.
 * @param {Record<string, unknown>} gift
 */
export function cardRasterSources(gift) {
  const core = cardImageSources(gift);
  const pending = gift.imageUpscaleStatus === "pending" && Boolean(pickMainRasterUrl(gift.imageOriginal));
  const base = {
    ...core,
    ogOnly: pending || core.ogOnly,
    pending,
  };
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
  return detailStaticRaster(gift);
}

/**
 * Poster / hero stack for Lottie/video.
 * @param {Record<string, unknown>} gift
 */
export function stackedPosterUrl(gift) {
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
 * DEV: when Gift Asset public fields yield no raster URL, log the walk for Trial debugging.
 * @param {Record<string, unknown>} gift
 * @param {string} context
 */
export function logGiftPublicImageMiss(gift, context = "gift") {
  if (!import.meta.env.DEV) return;
  const r = resolveMainGiftRasterImage(gift);
  if (r.url) return;
  const id = gift?.id ?? gift?.listingId ?? "?";
  console.debug(`[gift-public-image] miss:${context}`, id, {
    checkedFields: r.checkedFields,
    constructedModelImageUrl: r.constructedModelImageUrl || "",
    giftPublicKeys: listGiftPublicKeys(gift),
    imageRejectedReason: r.imageRejectedReason || "",
    rejectedImageUrl: r.rejectedImageUrl || "",
    rejectedField: r.rejectedField || "",
  });
}

/**
 * @param {string} context
 * @param {Record<string, unknown>} gift
 * @param {{ src: string; srcSet?: string; heroPoster?: string }} chosen
 */
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
