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
