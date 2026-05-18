/**
 * @typedef {import("./api").Gift} Gift
 */

/** @param {string} q */
export function normalizeQuery(q) {
  return String(q ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Search name, collection, model, symbol, backdrop, listing id / #number in name.
 * @param {Gift} gift
 * @param {string} rawQuery
 */
export function giftMatchesSearch(gift, rawQuery) {
  const q = normalizeQuery(rawQuery);
  if (!q) return true;

  const id = String(gift.id ?? "").toLowerCase();
  const name = String(gift.name ?? "").toLowerCase();
  const collection = String(gift.collection ?? "").toLowerCase();
  const model = String(gift.model ?? "").toLowerCase();
  const symbol = String(gift.symbol ?? "").toLowerCase();
  const backdrop = String(gift.backdrop ?? "").toLowerCase();

  if (id.includes(q)) return true;
  if (name.includes(q)) return true;
  if (collection.includes(q)) return true;
  if (model.includes(q)) return true;
  if (symbol.includes(q)) return true;
  if (backdrop.includes(q)) return true;

  const numMatch = q.match(/^#?(\d+)$/);
  if (numMatch) {
    const n = numMatch[1];
    if (id.includes(n)) return true;
    if (name.includes(`#${n}`)) return true;
  }

  return false;
}

/** @param {string | undefined | null} status */
export function normalizedListingStatus(status) {
  return String(status ?? "")
    .trim()
    .toLowerCase();
}

/**
 * @param {Gift} gift
 * @param {"all" | "live" | "pending" | "sold"} filter
 */
export function giftMatchesListingStatus(gift, filter) {
  if (filter === "all") return true;
  const s = normalizedListingStatus(gift.status);
  if (filter === "live") return s === "approved" || s === "listed";
  if (filter === "pending") return s === "pending" || s === "pending_admin_review";
  if (filter === "sold") return ["sold", "awaiting_seller_transfer", "completed_pending_payout", "completed"].includes(s);
  return true;
}

/**
 * @param {Gift} gift
 * @param {{ minPrice: string; maxPrice: string; collection: string; minRarity: string; minScore: string }} f
 */
export function giftMatchesAdvancedFilters(gift, f) {
  const price = Number(gift.priceTon);
  if (!Number.isFinite(price)) return false;

  const minP = Number.parseFloat(f.minPrice);
  if (f.minPrice.trim() !== "" && Number.isFinite(minP) && price < minP) return false;

  const maxP = Number.parseFloat(f.maxPrice);
  if (f.maxPrice.trim() !== "" && Number.isFinite(maxP) && price > maxP) return false;

  const coll = f.collection.trim();
  if (coll) {
    const g = String(gift.collection ?? "").trim();
    if (g !== coll) return false;
  }

  const minR = Number.parseInt(f.minRarity, 10);
  if (f.minRarity.trim() !== "" && Number.isFinite(minR) && (gift.rarity ?? 0) < minR) return false;

  const minS = Number.parseFloat(f.minScore);
  if (f.minScore.trim() !== "" && Number.isFinite(minS) && (gift.aiScore ?? 0) < minS) return false;

  return true;
}

/**
 * @typedef {"newest" | "price_asc" | "price_desc" | "score" | "floor_diff"} SortKey
 */

/**
 * @param {Gift[]} list
 * @param {SortKey} sort
 */
export function sortGiftList(list, sort) {
  const out = [...list];
  if (sort === "newest") {
    out.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
  } else if (sort === "price_asc") {
    out.sort((a, b) => (Number(a.priceTon) || 0) - (Number(b.priceTon) || 0));
  } else if (sort === "price_desc") {
    out.sort((a, b) => (Number(b.priceTon) || 0) - (Number(a.priceTon) || 0));
  } else if (sort === "score") {
    out.sort((a, b) => (Number(b.aiScore) || 0) - (Number(a.aiScore) || 0));
  } else if (sort === "floor_diff") {
    out.sort((a, b) => (Number(b.undervaluedPercent) || 0) - (Number(a.undervaluedPercent) || 0));
  }
  return out;
}

/**
 * @param {Gift[]} gifts
 */
export function uniqueCollections(gifts) {
  const set = new Set();
  for (const g of gifts) {
    const c = String(g.collection ?? "").trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
