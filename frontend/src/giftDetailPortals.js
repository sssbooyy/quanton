/**
 * Helpers for Portals-style gift detail (trait rows, floors from cached Gift Asset metadata).
 * @param {Record<string, unknown>} gift
 */

/** @param {unknown} cm */
function getCached(gift) {
  const cm = gift?.cachedMetadata;
  return cm && typeof cm === "object" ? cm : null;
}

/**
 * Best trait-specific floor from provider snapshot; falls back to collection/listing floor.
 * @param {Record<string, unknown>} gift
 * @param {"model" | "symbol" | "backdrop"} kind
 */
export function traitFloorTon(gift, kind) {
  const live =
    Number(gift?.realFloorTon) > 0
      ? Number(gift.realFloorTon)
      : Number(gift?.floorTon) > 0
        ? Number(gift.floorTon)
        : 0;

  const cm = getCached(gift);
  const providers = cm?.providers && typeof cm.providers === "object" ? cm.providers : null;

  if (providers && kind === "model") {
    for (const v of Object.values(providers)) {
      if (!v || typeof v !== "object") continue;
      const mf = Number(/** @type {{ model_floor?: unknown }} */ (v).model_floor);
      if (Number.isFinite(mf) && mf > 0) return mf;
    }
  }

  if (providers) {
    for (const v of Object.values(providers)) {
      if (!v || typeof v !== "object") continue;
      const cf = Number(/** @type {{ collection_floor?: unknown }} */ (v).collection_floor);
      if (Number.isFinite(cf) && cf > 0) return cf;
    }
  }

  const mfRoot = cm?.market_floor;
  if (mfRoot && typeof mfRoot === "object") {
    const avg = Number(/** @type {{ avg?: unknown }} */ (mfRoot).avg);
    if (Number.isFinite(avg) && avg > 0) return avg;
    const mn = Number(/** @type {{ min?: unknown }} */ (mfRoot).min);
    if (Number.isFinite(mn) && mn > 0) return mn;
  }

  return live > 0 ? live : null;
}

/**
 * Rarity % pill text per trait when Gift Asset exposes it; otherwise null.
 * @param {Record<string, unknown>} gift
 * @param {"model" | "symbol" | "backdrop"} kind
 */
export function traitRarityBadgeText(gift, kind) {
  const cm = getCached(gift);
  const attrs = cm?.attributes && typeof cm.attributes === "object" ? cm.attributes : null;
  const map = { model: "MODEL", symbol: "SYMBOL", backdrop: "BACKDROP" };
  const block = attrs?.[map[kind]];
  if (block && typeof block === "object") {
    const o = /** @type {Record<string, unknown>} */ (block);
    const candidates = [o.rarity_percent, o.rarityPercent, o.percent_rarity, o.percent, o.rarity];
    for (const c of candidates) {
      if (c == null) continue;
      const n = Number(c);
      if (Number.isFinite(n) && n >= 0 && n <= 100) return `${n}%`;
      const s = String(c).trim();
      if (s && /%/.test(s)) return s.replace(/\s+/g, "");
    }
  }

  const ta = Number(cm?.total_amount);
  const ri = Number(cm?.rarity_index);
  if (kind === "model" && Number.isFinite(ta) && ta > 0 && Number.isFinite(ri) && ri >= 0) {
    const p = Math.round((ri / Math.max(ta, 1)) * 1000) / 10;
    if (p > 0 && p < 100) return `${p}%`;
  }

  return null;
}

/** @param {Record<string, unknown>} gift */
export function giftBackdropLabel(gift) {
  const cm = getCached(gift);
  const bn =
    cm &&
    typeof cm === "object" &&
    "backdropName" in cm &&
    typeof cm.backdropName === "string"
      ? cm.backdropName.trim()
      : "";
  if (bn) return bn;
  const b = typeof gift?.backdrop === "string" ? gift.backdrop.trim() : "";
  return b || "";
}

/** @param {Record<string, unknown>} gift */
export function giftListingIdDisplay(gift) {
  const id = String(gift?.id ?? "").trim();
  if (id) return `#${id}`;
  const m = String(gift?.name ?? "").match(/#(\d+)/);
  return m ? `#${m[1]}` : "";
}
