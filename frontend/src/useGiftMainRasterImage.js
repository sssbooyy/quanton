import { useCallback, useEffect, useMemo, useState } from "react";
import { getMainGiftRasterCandidates, isThemeOrSymbolAssetRasterUrl } from "@shared/giftPublicImageResolve.js";

function trimUrl(u) {
  return typeof u === "string" ? u.trim() : "";
}

/** Normalize URL for failure matching (strip cache-buster query). */
function rasterFailureKey(url) {
  const u = trimUrl(url);
  if (!u) return "";
  const q = u.indexOf("?");
  return q >= 0 ? u.slice(0, q) : u;
}

/**
 * Candidate list with upscale-pending `imageOriginal` first when present.
 * @param {Record<string, unknown>} gift
 */
export function getMainGiftRasterCandidatesForDisplay(gift) {
  if (gift.imageUpscaleStatus === "pending") {
    const o = trimUrl(gift.imageOriginal);
    if (o && !isThemeOrSymbolAssetRasterUrl(o)) {
      const rest = getMainGiftRasterCandidates(gift);
      const seen = new Set([o]);
      /** @type {{ url: string; field: string; source: string }[]} */
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
 * Runtime fallback when ordered URLs 404 (e.g. constructed /models/*.png missing).
 * @param {Record<string, unknown>} gift
 */
export function useGiftMainRasterImage(gift) {
  const candidates = useMemo(
    () => getMainGiftRasterCandidatesForDisplay(gift),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      gift?.id,
      gift?.listingId,
      gift?.collection,
      gift?.model,
      gift?.imageHiRes,
      gift?.image,
      gift?.imageThumb,
      gift?.animationPosterUrl,
      gift?.imageOriginal,
      gift?.imageUpscaleStatus,
      gift?.public,
      gift?.cachedMetadata,
      gift?.media,
    ]
  );

  const candKey = useMemo(() => candidates.map((c) => c.url).join("|"), [candidates]);

  const [failedUrls, setFailedUrls] = useState(() => new Set());

  useEffect(() => {
    setFailedUrls(new Set());
  }, [gift?.id, gift?.listingId, candKey]);

  const markFailed = useCallback((rawUrl) => {
    const k = rasterFailureKey(rawUrl);
    if (!k) return;
    setFailedUrls((prev) => {
      const next = new Set(prev);
      next.add(k);
      return next;
    });
  }, []);

  const active = useMemo(() => {
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!failedUrls.has(rasterFailureKey(c.url))) {
        return {
          index: i,
          url: c.url,
          field: c.field,
          source: c.source,
        };
      }
    }
    return { index: -1, url: "", field: "", source: "placeholder" };
  }, [candidates, failedUrls]);

  return {
    ...active,
    candidates,
    failedUrls: Array.from(failedUrls),
    markFailed,
  };
}
