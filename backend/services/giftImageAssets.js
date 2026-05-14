/**
 * Collectible-grade raster selection + Telegram CDN URL hints.
 * Used by metadataProvider so the API can expose thumb vs hi-res for grid vs detail.
 */

const PIC_KEY_WEIGHT = {
  original: 110,
  source: 108,
  xlarge: 100,
  xl: 98,
  large: 90,
  l: 88,
  full: 86,
  default: 80,
  medium: 62,
  m: 60,
  small: 42,
  s: 40,
  thumb: 28,
  thumbnail: 26,
  xs: 22,
  mini: 18,
};

/**
 * @param {unknown} v
 * @returns {string}
 */
function asHttpUrl(v) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s || !/^https?:\/\//i.test(s)) return "";
  return s;
}

/**
 * @param {unknown} pics
 * @returns {{ url: string; score: number; key: string }[]}
 */
export function flattenGiftAssetPics(pics) {
  const out = [];
  if (!pics) return out;

  if (Array.isArray(pics)) {
    for (let i = 0; i < pics.length; i++) {
      const row = pics[i];
      const url = asHttpUrl(row?.url ?? row?.src ?? row?.href ?? row);
      if (!url) continue;
      const w = Number(row?.width ?? row?.w);
      const score = (Number.isFinite(w) && w > 0 ? Math.min(120, w / 8) : 50) + (pics.length - i) * 0.01;
      out.push({ url, score, key: String(row?.type ?? row?.size ?? i) });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  if (typeof pics === "object") {
    for (const [key, raw] of Object.entries(pics)) {
      const url = asHttpUrl(
        typeof raw === "string" ? raw : raw?.url ?? raw?.src ?? raw?.href ?? raw?.path
      );
      if (!url) continue;
      const lw = key.toLowerCase();
      const base = PIC_KEY_WEIGHT[lw] ?? 35;
      const w = Number(raw?.width ?? raw?.w);
      const score = base + (Number.isFinite(w) && w > 0 ? Math.min(25, w / 128) : 0);
      out.push({ url, score, key });
    }
    out.sort((a, b) => b.score - a.score);
  }
  return out;
}

/**
 * Pick best / thumb / poster from Gift Asset payload.
 * @param {Record<string, unknown>} payload
 */
export function pickGiftAssetRasterLayers(payload) {
  const pics = flattenGiftAssetPics(payload?.media?.pics);
  const mediaPreview = asHttpUrl(payload?.media_preview);
  const poster =
    asHttpUrl(payload?.media?.poster) ||
    asHttpUrl(payload?.media?.preview) ||
    asHttpUrl(payload?.media?.first_frame) ||
    asHttpUrl(payload?.media?.webp_preview) ||
    "";

  let hi = pics[0]?.url || mediaPreview;
  let thumb = pics.length > 1 ? pics[pics.length - 1]?.url : "";

  if (!thumb && pics[0]?.url) thumb = pics[0].url;
  if (!hi && mediaPreview) hi = mediaPreview;

  if (thumb && hi && thumb === hi && pics.length >= 2) {
    thumb = pics[pics.length - 1].url;
  }

  return {
    hiRes: hi,
    thumb: thumb || hi,
    animationPoster: poster || hi || thumb,
  };
}

/**
 * Best-effort larger Telegram / TON CDN raster when OG only exposes a small preview.
 * Conservative: only mutates known query/path patterns.
 * @param {string} rawUrl
 * @returns {string}
 */
export function upgradeTelegramRasterUrl(rawUrl) {
  const u = String(rawUrl || "").trim();
  if (!u || !/^https?:\/\//i.test(u)) return u;

  let url;
  try {
    url = new URL(u);
  } catch {
    return u;
  }

  const host = url.hostname.toLowerCase();
  const isTelegramCdn =
    host.includes("telegram-cdn.org") ||
    host.includes("telegram.org") ||
    host.includes("cdn4.telegram") ||
    host.endsWith("telesco.pe");

  if (!isTelegramCdn) return u;

  const params = url.searchParams;
  const sizeKeys = ["w", "width", "sz"];
  for (const k of sizeKeys) {
    if (!params.has(k)) continue;
    const n = Number(params.get(k));
    if (Number.isFinite(n) && n > 0 && n < 1024) {
      params.set(k, String(Math.min(2048, Math.max(n, 1024))));
    }
  }
  if (params.has("thumbnail")) params.delete("thumbnail");

  return url.toString();
}

/**
 * @param {string} ogImage
 * @returns {{ hiRes: string; thumb: string }}
 */
export function openGraphRasterVariants(ogImage) {
  const base = String(ogImage || "").trim();
  if (!base) return { hiRes: "", thumb: "" };
  const hiRes = upgradeTelegramRasterUrl(base);
  return { hiRes, thumb: hiRes };
}
