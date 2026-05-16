/**
 * Extract a compact palette from a remote gift raster (canvas sampling).
 * Respects CORS; on failure callers should keep theme-only backgrounds.
 *
 * @typedef {{
 *   dominantColor: string;
 *   secondaryColor: string;
 *   accentColor: string;
 *   isDark: boolean;
 *   isLight: boolean;
 *   paletteSource: "image" | "fallback";
 * }} GiftImagePaletteResult
 */

/** @param {string} url */
function trimUrl(url) {
  return typeof url === "string" ? url.trim() : "";
}

/**
 * Stable cache key: drop tracking query params but keep signed CDN params if any.
 * @param {string} url
 */
export function paletteCacheKeyFromUrl(url) {
  const u = trimUrl(url);
  if (!u) return "";
  try {
    const parsed = new URL(u, typeof window !== "undefined" ? window.location.href : "https://local.invalid");
    parsed.searchParams.delete("hdcache");
    parsed.searchParams.delete("v");
    return parsed.href;
  } catch {
    const q = u.indexOf("?");
    return q >= 0 ? u.slice(0, q) : u;
  }
}

/** @param {string} hex  #rrggbb */
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  if (h.length !== 6) return { r: 128, g: 128, b: 128 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** @param {{ r: number; g: number; b: number }} rgb */
function rgbToHex(rgb) {
  const c = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(rgb.r)}${c(rgb.g)}${c(rgb.b)}`;
}

/** @param {{ r: number; g: number; b: number }} rgb */
function relativeLuminance(rgb) {
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(rgb.r);
  const G = lin(rgb.g);
  const B = lin(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** @param {{ r: number; g: number; b: number }} rgb */
function saturation(rgb) {
  const { r, g, b } = rgb;
  const mx = Math.max(r, g, b) / 255;
  const mn = Math.min(r, g, b) / 255;
  if (mx === 0) return 0;
  return (mx - mn) / mx;
}

/** @param {number} k */
function keyToRgb(k) {
  return { r: (k >> 16) & 255, g: (k >> 8) & 255, b: k & 255 };
}

/** @param {{ r: number; g: number; b: number }} a @param {{ r: number; g: number; b: number }} b */
function colorDistance(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** @param {string} src */
function loadImageCrossOrigin(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image-load"));
    img.src = src;
  });
}

const SAMPLE = 48;
const LS_PREFIX = "quanton_gift_palette_v1:";
/** @type {Map<string, Promise<GiftImagePaletteResult>>} */
const inflight = new Map();
/** @type {Map<string, GiftImagePaletteResult>} */
const memoryCache = new Map();

/** @param {string} key */
function hashKey(key) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = (h * 33) ^ key.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * @param {ImageBitmapSource} img
 * @returns {GiftImagePaletteResult}
 */
function analyzeImageElement(img) {
  const w = SAMPLE;
  const h = SAMPLE;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      dominantColor: "#808080",
      secondaryColor: "#606060",
      accentColor: "#a0a0a0",
      isDark: true,
      isLight: false,
      paletteSource: "fallback",
    };
  }
  ctx.drawImage(img, 0, 0, w, h);
  let data;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return {
      dominantColor: "#808080",
      secondaryColor: "#606060",
      accentColor: "#a0a0a0",
      isDark: true,
      isLight: false,
      paletteSource: "fallback",
    };
  }

  /** @type {Map<number, number>} */
  const buckets = new Map();
  const step = 2;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 14) continue;
      const rq = (r >> 3) << 3;
      const gq = (g >> 3) << 3;
      const bq = (b >> 3) << 3;
      const key = (rq << 16) | (gq << 8) | bq;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
  }

  const sorted = [...buckets.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return {
      dominantColor: "#505050",
      secondaryColor: "#404040",
      accentColor: "#707070",
      isDark: true,
      isLight: false,
      paletteSource: "fallback",
    };
  }

  const domRgb = keyToRgb(sorted[0][0]);
  let secRgb = domRgb;
  for (const [key] of sorted.slice(1, 32)) {
    const c = keyToRgb(key);
    if (colorDistance(domRgb, c) > 38) {
      secRgb = c;
      break;
    }
  }

  let bestAccent = domRgb;
  let bestSat = -1;
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * 4;
      const rr = data[i];
      const gg = data[i + 1];
      const bb = data[i + 2];
      const aa = data[i + 3];
      if (aa < 14) continue;
      const sat = saturation({ r: rr, g: gg, b: bb });
      if (sat > bestSat) {
        bestSat = sat;
        bestAccent = { r: rr, g: gg, b: bb };
      }
    }
  }
  if (bestSat < 0.08) bestAccent = secRgb;

  const lum = relativeLuminance(domRgb);
  return {
    dominantColor: rgbToHex(domRgb),
    secondaryColor: rgbToHex(secRgb),
    accentColor: rgbToHex(bestAccent),
    isDark: lum < 0.35,
    isLight: lum > 0.65,
    paletteSource: "image",
  };
}

/**
 * Async: load imageUrl, sample canvas, return palette or fallback.
 * Cached in memory + localStorage (successful image parses only).
 * @param {string} imageUrl
 * @returns {Promise<GiftImagePaletteResult>}
 */
export async function extractGiftImagePalette(imageUrl) {
  const full = trimUrl(imageUrl);
  if (!full) {
    return {
      dominantColor: "#606060",
      secondaryColor: "#505050",
      accentColor: "#707070",
      isDark: true,
      isLight: false,
      paletteSource: "fallback",
    };
  }

  const key = paletteCacheKeyFromUrl(full);
  const hitMem = memoryCache.get(key);
  if (hitMem) return hitMem;

  const infl = inflight.get(key);
  if (infl) return infl;

  const task = (async () => {
    try {
      const lsRaw = typeof localStorage !== "undefined" ? localStorage.getItem(LS_PREFIX + hashKey(key)) : null;
      if (lsRaw) {
        const parsed = JSON.parse(lsRaw);
        if (parsed?.paletteSource === "image" && parsed.dominantColor) {
          memoryCache.set(key, parsed);
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }

    let result;
    try {
      const img = await loadImageCrossOrigin(full);
      result = analyzeImageElement(img);
    } catch {
      result = {
        dominantColor: "#606060",
        secondaryColor: "#505050",
        accentColor: "#707070",
        isDark: true,
        isLight: false,
        paletteSource: "fallback",
      };
    }

    memoryCache.set(key, result);

    if (result.paletteSource === "image") {
      try {
        localStorage.setItem(LS_PREFIX + hashKey(key), JSON.stringify(result));
      } catch {
        /* ignore quota */
      }
    }

    return result;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

/**
 * @param {string} hex
 * @param {number} a 0..1
 */
export function hexToRgba(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Parse rgb/rgba/hex roughly; fallback gray.
 * @param {string} raw
 * @returns {{ r: number; g: number; b: number; a: number }}
 */
export function parseCssColorToRgb(raw) {
  const s = trimUrl(raw);
  if (!s) return { r: 120, g: 140, b: 180, a: 0.2 };
  if (s.startsWith("#")) {
    const rgb = hexToRgb(s);
    return { ...rgb, a: 1 };
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (m) {
    return {
      r: Number(m[1]) || 0,
      g: Number(m[2]) || 0,
      b: Number(m[3]) || 0,
      a: m[4] != null ? Number(m[4]) : 1,
    };
  }
  return { r: 120, g: 140, b: 180, a: 0.2 };
}

/** @param {{ r: number; g: number; b: number; a: number }} c */
function rgbaToCss(c) {
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a})`;
}

/**
 * @param {string} themeCss
 * @param {string} imageHex
 * @param {number} imageWeight 0..1 portion of image color
 */
export function mixThemeWithImageColor(themeCss, imageHex, imageWeight) {
  const t = parseCssColorToRgb(themeCss);
  const i = hexToRgb(imageHex);
  const w = Math.max(0, Math.min(1, imageWeight));
  const out = {
    r: t.r * (1 - w) + i.r * w,
    g: t.g * (1 - w) + i.g * w,
    b: t.b * (1 - w) + i.b * w,
    a: t.a,
  };
  return rgbaToCss(out);
}
