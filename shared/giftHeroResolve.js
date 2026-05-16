/**
 * Shared Telegram collectible hero theming (backdrop + symbol pattern metadata).
 * Used by backend API and frontend presentation.
 */

import raw from "./giftHeroThemes.json" with { type: "json" };

/** @typedef {{ label: string; background: string; overlay: string; symbolColor: string; glowColor: string; glowColorSoft: string; vignette: string }} BackdropThemeShape */

const NEUTRAL_KEY = "neutral";

/** @type {{ neutral: BackdropThemeShape, backdrops: Record<string, BackdropThemeShape> }} */
const pack = raw;

/**
 * @param {unknown} s
 * @returns {string}
 */
export function normalizeTraitKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * @param {string} full
 * @param {string} sub
 */
function keyContains(full, sub) {
  return full === sub || full.includes(sub) || sub.includes(full);
}

/**
 * Infer a theme key from free-text backdrop labels (Fragment-style names).
 * @param {string} label
 * @returns {string | null}
 */
export function inferBackdropKeyFromLabel(label) {
  const k = normalizeTraitKey(label);
  if (!k) return null;

  if (pack.backdrops[k]) return k;

  const rules = [
    [/onyx|obsidian|ebony|coal|charcoal|graphite/, "onyx-black"],
    [/midnight|navy|deep-?ocean/, "midnight-blue"],
    [/royal.?blue|sapphire/, "royal-blue"],
    [/deep.?blue|ocean|azure(?!mar)/, "deep-blue"],
    [/violet|indigo|amethyst/, "violet"],
    [/purple|plum|grape|lilac(?!\w)/, "purple"],
    [/lavender|mauve|periwinkle/, "lavender"],
    [/candy.?pink|hot.?pink|magenta|fuchsia/, "candy-pink"],
    [/coral|salmon/, "coral"],
    [/rose.?gold|rosegold|blush/, "rose-gold"],
    [/champagne|ivory.?cream/, "champagne"],
    [/golden|amber(?!\w)|honey/, "golden"],
    [/emerald|jade(?!ite)/, "emerald"],
    [/forest|pine|hunter.?green/, "forest-green"],
    [/mint(?!ed)|seafoam|aqua(?!\w)/, "mint"],
    [/aquamarine|teal(?!ight)/, "aquamarine"],
    [/crimson|wine|burgundy/, "crimson"],
    [/ruby|blood.?red|scarlet/, "ruby-red"],
    [/sky.?blue|baby.?blue|light.?blue/, "sky-blue"],
    [/ice|frost|polar|arctic/, "ice-blue"],
    [/sunset|tangerine|peach.?orange/, "sunset-orange"],
    [/slate|steel|gunmetal/, "slate"],
    [/silver|pearl|platinum|mist/, "silver-mist"],
  ];

  for (const [re, key] of rules) {
    if (re.test(k)) return key;
  }

  const tokens = k.split("-").filter(Boolean);
  for (const t of tokens) {
    if (t === "black") return "onyx-black";
    if (t === "blue") return "deep-blue";
    if (t === "green") return "forest-green";
    if (t === "red") return "ruby-red";
    if (t === "pink") return "candy-pink";
    if (t === "gold") return "golden";
    if (t === "orange") return "sunset-orange";
    if (t === "yellow") return "golden";
    if (t === "white") return "silver-mist";
    if (t === "gray" || t === "grey") return "slate";
    if (t === "purple") return "purple";
    if (t === "cyan") return "aquamarine";
  }

  return null;
}

/**
 * @param {string} [backdropName]
 * @returns {{ key: string; theme: BackdropThemeShape; matched: boolean; inferred: boolean }}
 */
export function resolveBackdropTheme(backdropName) {
  const rawName = String(backdropName || "").trim();
  const nk = normalizeTraitKey(rawName);

  if (pack.backdrops[nk]) {
    return { key: nk, theme: pack.backdrops[nk], matched: true, inferred: false };
  }

  for (const [bk, theme] of Object.entries(pack.backdrops)) {
    const tk = normalizeTraitKey(theme.label || "");
    if (tk && (keyContains(nk, tk) || keyContains(tk, nk))) {
      return { key: bk, theme, matched: true, inferred: false };
    }
  }

  const inferredKey = inferBackdropKeyFromLabel(rawName);
  if (inferredKey && pack.backdrops[inferredKey]) {
    return {
      key: inferredKey,
      theme: pack.backdrops[inferredKey],
      matched: false,
      inferred: true,
    };
  }

  return {
    key: NEUTRAL_KEY,
    theme: pack.neutral,
    matched: false,
    inferred: false,
  };
}

/**
 * Normalize backdrop label for trait color matching (lowercase, no punctuation, collapsed spaces).
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeBackdropLabelForMatch(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {string} hex */
function parseHex6(hex) {
  const h = String(hex).replace("#", "").trim();
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/i.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** @param {{ r: number; g: number; b: number }} rgb */
function rgbToHex6(rgb) {
  const c = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(rgb.r)}${c(rgb.g)}${c(rgb.b)}`.toUpperCase();
}

/** @param {{ r: number; g: number; b: number }} rgb */
function relativeLuminanceRgb(rgb) {
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
function saturationRgb(rgb) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === 0) return 0;
  return (mx - mn) / mx;
}

/** @param {string} hex */
function relativeLuminanceHex(hex) {
  const rgb = parseHex6(hex);
  return rgb ? relativeLuminanceRgb(rgb) : 0;
}

/** @param {string} hex @param {number} minL */
function liftHexUntilLuminance(hex, minL = 0.28) {
  let rgb = parseHex6(hex);
  if (!rgb) return "#6A7380";
  let h = rgbToHex6(rgb);
  let t = 0;
  while (relativeLuminanceHex(h) < minL && t < 0.92) {
    t += 0.07;
    rgb = {
      r: rgb.r + (255 - rgb.r) * 0.12,
      g: rgb.g + (255 - rgb.g) * 0.12,
      b: rgb.b + (255 - rgb.b) * 0.12,
    };
    h = rgbToHex6(rgb);
  }
  return h;
}

/**
 * @param {{ background?: unknown } | null | undefined} backdropTheme
 * @returns {string[]}
 */
function extractGradientHexStops(backdropTheme) {
  const bg = String(backdropTheme?.background ?? "").trim();
  return [...bg.matchAll(/#[0-9a-fA-F]{6}\b/gi)].map((m) => m[0].toUpperCase());
}

/**
 * Unknown traits: prefer saturated mid gradient stop, never darkest; lift if too dark.
 * @param {{ background?: unknown } | null | undefined} backdropTheme
 * @returns {string}
 */
export function deriveBackdropTraitSolidFromTheme(backdropTheme) {
  const hexes = extractGradientHexStops(backdropTheme);
  if (hexes.length === 0) return liftHexUntilLuminance("#5A6570", 0.28);
  if (hexes.length === 1) return liftHexUntilLuminance(hexes[0], 0.28);

  let bestHex = hexes[0];
  let bestSat = -1;
  for (const h of hexes) {
    const rgb = parseHex6(h);
    if (!rgb) continue;
    const s = saturationRgb(rgb);
    if (s > bestSat) {
      bestSat = s;
      bestHex = h;
    }
  }
  const mid = hexes[Math.floor((hexes.length - 1) / 2)] || bestHex;
  const pick = bestSat >= 0.12 ? bestHex : mid;
  return liftHexUntilLuminance(pick, 0.28);
}

/** Telegram/Portals-style solid per known theme JSON key (brighter than darkest gradient stop). */
const THEME_KEY_TRAIT_SOLID = {
  "onyx-black": "#303637",
  "midnight-blue": "#394D8F",
  "deep-blue": "#4F8DFF",
  "royal-blue": "#4E7BEF",
  "sky-blue": "#6FA8FF",
  "ice-blue": "#7AB8FF",
  "purple": "#7B5CE6",
  "violet": "#8B6CE8",
  "candy-pink": "#F178B6",
  "rose-gold": "#E8B896",
  "golden": "#D8A84F",
  "emerald": "#37A66B",
  "forest-green": "#3FAF70",
  "crimson": "#D94A4A",
  "ruby-red": "#D94A4A",
  "sunset-orange": "#E58A3A",
  "coral": "#F09072",
  "mint": "#69CFA5",
  "slate": "#8A929A",
  "silver-mist": "#8A929A",
  "champagne": "#E8E4DC",
  "aquamarine": "#52D4C0",
  "lavender": "#9B7CFF",
  neutral: "#6A7380",
  /** Warm brown / copper (Telegram Chestnut); not in giftHeroThemes.json yet — key may come from API. */
  chestnut: "#A85B45",
  "chestnut-brown": "#A85B45",
};

/**
 * @param {string} blob normalized "label keywords" string
 * @returns {{ hex: string; matched: string } | null}
 */
function matchExplicitBackdropBlob(blob) {
  if (/\bonyx black\b/.test(blob) || /\bonyx\b/.test(blob)) return { hex: "#303637", matched: "onyx" };
  if (/\bnavy blue\b/.test(blob) || /\bnavy\b/.test(blob)) return { hex: "#394D8F", matched: "navy" };
  if (/\bcobalt blue\b/.test(blob) || /\bcobalt\b/.test(blob)) return { hex: "#5B73D6", matched: "cobalt" };
  if (/\bsapphire blue\b/.test(blob) || /\bsapphire\b/.test(blob)) return { hex: "#4E7BEF", matched: "sapphire" };
  if (/\bsky blue\b/.test(blob) || (/\bsky\b/.test(blob) && /\bblue\b/.test(blob))) return { hex: "#6FA8FF", matched: "sky blue" };
  if (/\bazure blue\b/.test(blob) || /\bazure\b/.test(blob)) return { hex: "#4F8DFF", matched: "azure" };
  if (/\bkhaki green\b/.test(blob) || /\bkhaki\b/.test(blob)) return { hex: "#8A9460", matched: "khaki" };
  if (/\blavender\b/.test(blob)) return { hex: "#9B7CFF", matched: "lavender" };
  if (/\bgrape\b/.test(blob) || /\bpurple\b/.test(blob) || /\bplum\b/.test(blob) || /\bviolet\b/.test(blob)) {
    return { hex: "#7B5CE6", matched: "purple" };
  }
  if (/\bcandy pink\b/.test(blob) || /\bmagenta\b/.test(blob) || /\bfuchsia\b/.test(blob) || /\bpink\b/.test(blob)) {
    return { hex: "#F178B6", matched: "pink" };
  }
  if (/\brose gold\b/.test(blob)) return { hex: "#E8B896", matched: "rose gold" };
  if (/\brose\b/.test(blob)) return { hex: "#E85B8F", matched: "rose" };
  if (/\bruby\b/.test(blob) || /\bscarlet\b/.test(blob) || /\bcrimson\b/.test(blob) || /\bburgundy\b/.test(blob)) {
    return { hex: "#D94A4A", matched: "red" };
  }
  if (/\bred\b/.test(blob) && !/\brose\b/.test(blob)) return { hex: "#D94A4A", matched: "red" };
  if (/\bmint\b/.test(blob) || /\bseafoam\b/.test(blob)) return { hex: "#69CFA5", matched: "mint" };
  if (/\bemerald\b/.test(blob) || /\bforest\b/.test(blob) || /\bjade\b/.test(blob)) return { hex: "#37A66B", matched: "emerald" };
  if (/\bgreen\b/.test(blob) && !/\bkhaki\b/.test(blob) && !/\bmint\b/.test(blob)) return { hex: "#37A66B", matched: "green" };
  if (/\bgold\b/.test(blob) || /\bgolden\b/.test(blob) || /\bamber\b/.test(blob) || /\bhoney\b/.test(blob)) {
    return { hex: "#D8A84F", matched: "gold" };
  }
  if (/\borange\b/.test(blob) || /\bsunset\b/.test(blob) || /\btangerine\b/.test(blob) || /\bpeach\b/.test(blob)) {
    return { hex: "#E58A3A", matched: "orange" };
  }
  if (
    /\bchestnut brown\b/.test(blob) ||
    /\bchestnut\b/.test(blob) ||
    /\bwooden\b/.test(blob) ||
    /\bwood\b/.test(blob) ||
    /\bbrown\b/.test(blob)
  ) {
    return { hex: "#A85B45", matched: "chestnut" };
  }
  if (/\bwhite\b/.test(blob) || /\bpearl\b/.test(blob) || /\bivory\b/.test(blob)) return { hex: "#DDE3EA", matched: "white" };
  if (/\bsilver\b/.test(blob) || /\bplatinum\b/.test(blob) || /\bgrey\b/.test(blob) || /\bgray\b/.test(blob) || /\bsteel\b/.test(blob) || /\bslate\b/.test(blob) || /\bmist\b/.test(blob)) {
    return { hex: "#8A929A", matched: "silver" };
  }

  return null;
}

/**
 * @typedef {{
 *   hex: string;
 *   source: "explicit" | "derived";
 *   labelNorm: string;
 *   themeKey: string;
 *   backdropLabelUsedForColor: string;
 *   backdropColorMatchPath: "gift_label" | "theme_key" | "theme_label" | "derived";
 * }} BackdropTraitSolidResult
 */

/**
 * Central resolver: Portals-style flat trait color.
 * Priority: (a) gift backdrop label, (b) theme key, (c) backdropTheme.label, (d) derived gradient.
 * @param {{ key?: unknown; label?: unknown; background?: unknown } | null | undefined} backdropTheme
 * @param {string | null | undefined} [backdropLabelFromGift] from {@link extractBackdropLabelFromGift} (includes cachedMetadata.backdropName)
 * @returns {BackdropTraitSolidResult}
 */
export function resolveBackdropTraitSolid(backdropTheme, backdropLabelFromGift) {
  const themeKey = String(backdropTheme?.key ?? "").trim().toLowerCase();
  const keyWords = themeKey.replace(/-/g, " ").trim();
  const nk = normalizeTraitKey(themeKey);

  const giftRaw = String(backdropLabelFromGift ?? "").trim();
  const giftNorm = normalizeBackdropLabelForMatch(giftRaw);

  const apiLabelRaw = String(backdropTheme?.label ?? "").trim();
  const apiNorm = normalizeBackdropLabelForMatch(backdropTheme?.label);

  // (a) Gift-extracted backdrop label (matches UI BACKGROUND / traits)
  if (giftNorm) {
    const ex = matchExplicitBackdropBlob(giftNorm);
    if (ex) {
      return {
        hex: ex.hex,
        source: "explicit",
        labelNorm: giftNorm,
        themeKey,
        backdropLabelUsedForColor: giftRaw,
        backdropColorMatchPath: "gift_label",
      };
    }
  }

  // (b) Theme key slug
  if (keyWords) {
    const exK = matchExplicitBackdropBlob(keyWords);
    if (exK) {
      return {
        hex: exK.hex,
        source: "explicit",
        labelNorm: `${giftNorm} ${keyWords}`.trim(),
        themeKey,
        backdropLabelUsedForColor: giftRaw || themeKey,
        backdropColorMatchPath: "theme_key",
      };
    }
  }
  if (nk.includes("chestnut")) {
    return {
      hex: "#A85B45",
      source: "explicit",
      labelNorm: `${giftNorm} ${keyWords}`.trim(),
      themeKey,
      backdropLabelUsedForColor: giftRaw || keyWords || themeKey,
      backdropColorMatchPath: "theme_key",
    };
  }
  if (nk && THEME_KEY_TRAIT_SOLID[nk]) {
    return {
      hex: THEME_KEY_TRAIT_SOLID[nk],
      source: "explicit",
      labelNorm: `${giftNorm} ${apiNorm} ${keyWords}`.trim(),
      themeKey,
      backdropLabelUsedForColor: giftRaw || apiLabelRaw || themeKey,
      backdropColorMatchPath: "theme_key",
    };
  }

  // (c) API snapshot backdropTheme.label
  if (apiNorm) {
    const exA = matchExplicitBackdropBlob(apiNorm);
    if (exA) {
      return {
        hex: exA.hex,
        source: "explicit",
        labelNorm: apiNorm,
        themeKey,
        backdropLabelUsedForColor: giftRaw || apiLabelRaw,
        backdropColorMatchPath: "theme_label",
      };
    }
  }

  // (d) Derived from theme gradient
  const derived = deriveBackdropTraitSolidFromTheme(backdropTheme);
  return {
    hex: derived,
    source: "derived",
    labelNorm: `${giftNorm} ${apiNorm} ${keyWords}`.trim(),
    themeKey,
    backdropLabelUsedForColor: giftRaw || apiLabelRaw || themeKey || "",
    backdropColorMatchPath: "derived",
  };
}

/**
 * @param {{ key?: unknown; label?: unknown; background?: unknown } | null | undefined} backdropTheme
 * @param {string | null | undefined} [backdropLabelFromGift]
 * @returns {string}
 */
export function getBackdropTraitSolidColor(backdropTheme, backdropLabelFromGift) {
  return resolveBackdropTraitSolid(backdropTheme, backdropLabelFromGift).hex;
}

/**
 * Symbol tiling opacity / blend for trait-solid profile heroes (luminance/saturation aware).
 * @param {string} hex
 * @param {{ isCardSurface: boolean; reducedMotion: boolean }} opts
 * @returns {{ opacity: number; mixBlendMode: string }}
 */
export function traitSolidPatternOpacityForHex(hex, opts) {
  const { isCardSurface, reducedMotion } = opts;
  const rgb = parseHex6(hex);
  if (!rgb) {
    return { opacity: isCardSurface ? 0.072 : 0.07, mixBlendMode: "soft-light" };
  }
  const L = relativeLuminanceRgb(rgb);
  const S = saturationRgb(rgb);
  const dark = L < 0.38;
  const light = L > 0.72;
  const colorful = !dark && !light && S > 0.22;

  let opacity;
  let mixBlendMode = "soft-light";

  if (light) {
    opacity = reducedMotion ? 0.05 : 0.055;
    mixBlendMode = "multiply";
  } else if (colorful) {
    opacity = isCardSurface ? (reducedMotion ? 0.042 : 0.058) : reducedMotion ? 0.045 : 0.065;
    mixBlendMode = isCardSurface ? "overlay" : "soft-light";
    opacity = Math.min(opacity, 0.07);
  } else {
    opacity = isCardSurface ? (reducedMotion ? 0.065 : 0.085) : reducedMotion ? 0.062 : 0.078;
    opacity = Math.min(Math.max(opacity, 0.06), 0.09);
  }

  return { opacity, mixBlendMode };
}

/**
 * Opacity / blend for **URL-tiled** symbol rasters (Gift Asset `/symbols/…`) on trait-solid backdrops.
 * Fixed wrap opacity; blend mode differs only by surface (card vs detail hero), not backdrop analysis.
 * @param {unknown} _hex unused (API stability)
 * @param {{ isCardSurface: boolean; reducedMotion?: boolean }} opts
 * @returns {{ opacity: number; mixBlendMode: string }}
 */
export function symbolRasterPatternStyleForHex(_hex, opts) {
  void _hex;
  const { isCardSurface } = opts;
  return {
    opacity: 0.5,
    mixBlendMode: isCardSurface ? "soft-light" : "overlay",
  };
}

/** @deprecated use {@link getBackdropTraitSolidColor} */
export function solidBackdropFillFromTheme(backdropTheme, backdropLabelFromGift) {
  return getBackdropTraitSolidColor(backdropTheme, backdropLabelFromGift);
}

/** Portals/Telegram Onyx Black solid (alias for explicit map). */
export const ONYX_BLACK_TRAIT_SOLID = "#303637";

/**
 * @deprecated Onyx uses {@link getBackdropTraitSolidColor}; kept for callers/tests.
 * @param {{ key?: unknown; label?: unknown } | null | undefined} backdropTheme
 * @returns {boolean}
 */
export function isOnyxBlackBackdropTheme(backdropTheme) {
  const key = String(backdropTheme?.key ?? "").trim().toLowerCase();
  const label = normalizeBackdropLabelForMatch(backdropTheme?.label);
  return key === "onyx-black" || /\bonyx black\b/.test(label) || (/\bonyx\b/.test(label) && /\bblack\b/.test(label));
}

/** Known Telegram / Fragment symbol slugs → tile id */
const SYMBOL_ALIASES = {
  ladybug: "ladybug",
  "lady-bug": "ladybug",
  cross: "cross",
  plus: "cross",
  star: "star",
  heart: "heart",
  crown: "crown",
  rocket: "rocket",
  diamond: "diamond",
  gem: "diamond",
  moon: "moon",
  crescent: "moon",
  sun: "sun",
  bolt: "lightning",
  lightning: "lightning",
  flower: "flower",
  bloom: "flower",
  skull: "skull",
  anchor: "anchor",
  infinity: "infinity",
  loop: "infinity",
  wave: "wave",
  shell: "shell",
  clover: "clover",
  shamrock: "clover",
  butterfly: "butterfly",
  leaf: "leaf",
  fire: "flame",
  flame: "flame",
  snow: "snowflake",
  snowflake: "snowflake",
  snowdrop: "snowflake",
  frost: "snowflake",
  music: "note",
  note: "note",
  peace: "peace",
  eye: "eye",
  key: "key",
  lock: "lock",
  gift: "gift",
  bow: "bow",
  ribbon: "bow",
  paw: "paw",
  "paw-print": "paw",
  "bear-paw": "paw",
  "dog-paw": "paw",
};

/**
 * @param {string} [symbolName]
 * @returns {{ id: string; label: string } | null}
 */
export function resolveSymbolPattern(symbolName) {
  const label = String(symbolName || "").trim();
  if (!label) return null;
  const nk = normalizeTraitKey(label);
  if (SYMBOL_ALIASES[nk]) {
    return { id: SYMBOL_ALIASES[nk], label };
  }
  for (const [alias, id] of Object.entries(SYMBOL_ALIASES)) {
    if (nk.includes(alias) || alias.includes(nk)) {
      return { id, label };
    }
  }
  const first = nk.split("-")[0];
  if (first && SYMBOL_ALIASES[first]) {
    return { id: SYMBOL_ALIASES[first], label };
  }
  return null;
}

/**
 * Backdrop label from API document / traits / nested attributes (Mini App + web).
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {string}
 */
export function extractBackdropLabelFromGift(gift) {
  if (!gift || typeof gift !== "object") return "";
  const g = gift;

  const cm = g.cachedMetadata;
  if (cm && typeof cm === "object" && typeof cm.backdropName === "string" && cm.backdropName.trim()) {
    return cm.backdropName.trim();
  }

  const top = String(g.backdrop ?? g.backdropName ?? g.background ?? "").trim();
  if (top) return top;

  const traits = Array.isArray(g.traits) ? g.traits : [];
  for (const t of traits) {
    if (!t || typeof t !== "object") continue;
    const key = String(t.key ?? "").trim();
    const kl = key.toLowerCase().replace(/\s+/g, "_");
    if (kl === "backdrop" || kl === "background" || key.toUpperCase() === "BACKDROP") {
      const v = String(t.value ?? "").trim();
      if (v) return v;
    }
  }

  const attrs = g.attributes;
  if (attrs && typeof attrs === "object") {
    const a = /** @type {Record<string, unknown>} */ (attrs);
    const B = a.BACKDROP ?? a.backdrop ?? a.Background ?? a.background;
    if (typeof B === "string" && B.trim()) return B.trim();
    if (B && typeof B === "object" && typeof B.name === "string" && B.name.trim()) return B.name.trim();
  }

  const meta = g.metadata;
  if (meta && typeof meta === "object" && Array.isArray(meta.attributes)) {
    for (const row of meta.attributes) {
      if (!row || typeof row !== "object") continue;
      const trait = String(row.trait_type ?? row.key ?? "")
        .toLowerCase()
        .replace(/\s+/g, "_");
      if (trait.includes("backdrop") || trait.includes("background")) {
        const v = String(row.value ?? "").trim();
        if (v) return v;
      }
    }
  }

  return "";
}

/**
 * Symbol label from API document / traits / nested attributes.
 * @param {Record<string, unknown> | null | undefined} gift
 * @returns {string}
 */
export function extractSymbolLabelFromGift(gift) {
  if (!gift || typeof gift !== "object") return "";
  const g = gift;

  const top = String(g.symbol ?? g.symbolName ?? "").trim();
  if (top) return top;

  const traits = Array.isArray(g.traits) ? g.traits : [];
  for (const t of traits) {
    if (!t || typeof t !== "object") continue;
    const key = String(t.key ?? "").trim();
    const kl = key.toLowerCase();
    if (kl === "symbol" || key.toUpperCase() === "SYMBOL") {
      const v = String(t.value ?? "").trim();
      if (v) return v;
    }
  }

  const attrs = g.attributes;
  if (attrs && typeof attrs === "object") {
    const a = /** @type {Record<string, unknown>} */ (attrs);
    const S = a.SYMBOL ?? a.symbol;
    if (typeof S === "string" && S.trim()) return S.trim();
    if (S && typeof S === "object" && typeof S.name === "string" && S.name.trim()) return S.name.trim();
  }

  const meta = g.metadata;
  if (meta && typeof meta === "object" && Array.isArray(meta.attributes)) {
    for (const row of meta.attributes) {
      if (!row || typeof row !== "object") continue;
      const trait = String(row.trait_type ?? row.key ?? "").toLowerCase();
      if (trait.includes("symbol")) {
        const v = String(row.value ?? "").trim();
        if (v) return v;
      }
    }
  }

  return "";
}

/**
 * Same as buildHeroPresentationFields but reads backdrop/symbol from any gift shape.
 * @param {Record<string, unknown> | null | undefined} gift
 */
export function buildHeroPresentationFieldsFromGift(gift) {
  return buildHeroPresentationFields({
    backdrop: extractBackdropLabelFromGift(gift),
    symbol: extractSymbolLabelFromGift(gift),
    model: String(gift?.model ?? ""),
    collection: String(gift?.collection ?? ""),
    listingId: String(gift?.id ?? gift?.listingId ?? ""),
  });
}

/**
 * @param {Record<string, unknown> | null | undefined} gift
 * @param {unknown} existingPattern
 */
function mergeSymbolPatternFromGift(gift, existingPattern) {
  const ex = existingPattern && typeof existingPattern === "object" ? existingPattern : null;
  if (ex && ex.enabled && String(ex.id || "").trim()) return ex;
  const sym = resolveSymbolPattern(extractSymbolLabelFromGift(gift));
  if (sym) return { id: sym.id, label: sym.label, enabled: true };
  return { id: "", label: "", enabled: false };
}

/**
 * Resolve hero presentation for detail modal: prefer API snapshot, else trait extraction + theme JSON.
 * @param {Record<string, unknown> | null | undefined} gift
 */
export function resolveCollectibleHeroPresentation(gift) {
  const hasApi =
    gift &&
    typeof gift === "object" &&
    gift.backdropTheme &&
    gift.heroBackground &&
    typeof gift.backdropTheme === "object" &&
    typeof gift.heroBackground === "object";

  if (hasApi) {
    const apiKey = String(gift.backdropTheme?.key || "");
    const extractedBackdrop = extractBackdropLabelFromGift(gift);
    if (extractedBackdrop && apiKey === NEUTRAL_KEY) {
      const recomputed = buildHeroPresentationFields({
        backdrop: extractedBackdrop,
        symbol: extractSymbolLabelFromGift(gift),
        model: String(gift?.model ?? ""),
        collection: String(gift?.collection ?? ""),
        listingId: String(gift?.id ?? gift?.listingId ?? ""),
      });
      if (recomputed.backdropTheme.key !== NEUTRAL_KEY) {
        return {
          backdropTheme: recomputed.backdropTheme,
          heroBackground: recomputed.heroBackground,
          symbolPattern: mergeSymbolPatternFromGift(gift, recomputed.symbolPattern),
          fromApi: false,
        };
      }
    }

    return {
      backdropTheme: gift.backdropTheme,
      heroBackground: gift.heroBackground,
      symbolPattern: mergeSymbolPatternFromGift(gift, gift.symbolPattern),
      fromApi: true,
    };
  }

  return {
    ...buildHeroPresentationFieldsFromGift(gift),
    fromApi: false,
  };
}

/**
 * @param {{
 *   backdrop?: string;
 *   symbol?: string;
 *   model?: string;
 *   collection?: string;
 *   listingId?: string;
 * }} g
 */
export function buildHeroPresentationFields(g) {
  const backdropRes = resolveBackdropTheme(g.backdrop);
  const sym = resolveSymbolPattern(g.symbol);
  /** @type {BackdropThemeShape} */
  const bt = backdropRes.theme;

  const backdropTheme = {
    key: backdropRes.key,
    label: bt.label || backdropRes.key,
    background: bt.background,
    overlay: bt.overlay,
    symbolColor: bt.symbolColor,
    glowColor: bt.glowColor,
    glowColorSoft: bt.glowColorSoft,
    /** @deprecated use glowColor */
    vignette: bt.vignette,
    matched: backdropRes.matched,
    inferred: backdropRes.inferred,
  };

  const symbolPattern = sym
    ? {
        id: sym.id,
        label: sym.label,
        enabled: true,
      }
    : {
        id: "",
        label: "",
        enabled: false,
      };

  const heroBackground = {
    gradient: bt.background,
    overlay: bt.overlay,
    vignette: bt.vignette,
    glowCenter: bt.glowColor,
    glowEdge: bt.glowColorSoft,
  };

  return {
    backdropTheme,
    symbolPattern,
    heroBackground,
  };
}
