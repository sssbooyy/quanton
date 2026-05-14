/**
 * Canonical collection keys so "FreshSocks", "fresh-socks", "Fresh Socks" share one cache bucket.
 */

/**
 * @param {string} name Gift Asset style `CollectionName-123`
 * @returns {string}
 */
export function normalizeCollectionFloorKeyFromGiftAssetName(name) {
  const raw = String(name ?? "").trim();
  const m = raw.match(/^([A-Za-z][A-Za-z0-9]*)-\d+$/);
  const base = m ? m[1] : raw.replace(/-\d+$/, "");
  return normalizeCollectionFloorKeyFromLabel(base);
}

/**
 * @param {string} label Human collection name or slug fragment
 * @returns {string}
 */
export function normalizeCollectionFloorKeyFromLabel(label) {
  return String(label ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
