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
