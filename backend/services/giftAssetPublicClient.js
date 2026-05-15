/**
 * Gift Asset **public / provider** endpoints only (Trial-safe; no User-Data routes).
 * Floors are resolved by collection name via market price-list APIs.
 */

import { FLOOR_CACHE_TTL_MS, GIFT_ASSET_API_KEY } from "../config.js";
import { giftAssetGet } from "./giftAssetHttp.js";
import {
  normalizeCollectionFloorKeyFromLabel,
  collectionDisplayNameFromGiftAssetName,
} from "./floorNormalization.js";

/** @type {Map<string, { floorTon: number; source: string; at: number }>} */
const collectionFloorCache = new Map();

/** @type {{ map: Record<string, object> | null; at: number }} */
let globalPriceListCache = { map: null, at: 0 };

const MAX_CACHE_ENTRIES = 500;

/**
 * Min positive TON quote across marketplace provider fields on a floor row.
 * @param {object | null | undefined} row
 * @returns {number}
 */
export function extractMinFloorTonFromProviderRow(row) {
  if (!row || typeof row !== "object") return 0;
  const candidates = [];
  for (const k of ["getgems", "mrkt", "portals", "tonnel", "min", "floor", "avg"]) {
    const n = Number(row[k]);
    if (Number.isFinite(n) && n > 0) candidates.push(n);
  }
  for (const v of Object.values(row)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const nested = extractMinFloorTonFromProviderRow(v);
      if (nested > 0) candidates.push(nested);
    }
  }
  return candidates.length ? Math.min(...candidates) : 0;
}

/**
 * @param {Record<string, unknown>} floorsMap
 * @param {string} collectionName
 * @returns {object | null}
 */
function matchCollectionRowInGlobalMap(floorsMap, collectionName) {
  const target = normalizeCollectionFloorKeyFromLabel(collectionName);
  if (!target || !floorsMap || typeof floorsMap !== "object") return null;

  for (const [key, row] of Object.entries(floorsMap)) {
    if (normalizeCollectionFloorKeyFromLabel(key) === target && row && typeof row === "object") {
      return row;
    }
  }
  return null;
}

function touchCollectionCache(key, row) {
  if (collectionFloorCache.size > MAX_CACHE_ENTRIES) {
    const first = collectionFloorCache.keys().next().value;
    if (first) collectionFloorCache.delete(first);
  }
  collectionFloorCache.set(key, row);
}

function readCollectionCache(key) {
  const row = collectionFloorCache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > FLOOR_CACHE_TTL_MS) {
    collectionFloorCache.delete(key);
    return null;
  }
  return row;
}

/**
 * Ordered collection labels to query on Gift Asset public APIs.
 * @param {object} resolved Metadata resolver output (`ok: true`)
 * @returns {string[]}
 */
export function resolveCollectionNameCandidates(resolved) {
  const out = [];
  const seen = new Set();

  const add = (name) => {
    const n = String(name ?? "").trim();
    if (!n) return;
    const low = n.toLowerCase();
    if (low === "telegram" || low === "telegram gifts" || low === "telegram nft") return;
    const key = normalizeCollectionFloorKeyFromLabel(n);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(n);
  };

  add(resolved.collection);
  add(collectionDisplayNameFromGiftAssetName(resolved.giftAssetName));

  const title = String(resolved.name ?? "").trim();
  const hash = title.match(/#\d+$/);
  if (hash) add(title.replace(/\s*#\d+\s*$/, "").trim());

  return out;
}

/**
 * @param {string} collectionName
 * @returns {Promise<{ floorTon: number; source: string } | null>}
 */
async function fetchFloorFromUniquePriceList(collectionName) {
  try {
    const res = await giftAssetGet("/api/v1/gifts/get_unique_gifts_price_list", {
      collection_name: collectionName,
    });
    if (res.status !== 200 || !res.data || typeof res.data !== "object") return null;
    if (res.data.code && res.data.message) return null;
    const cf = res.data.collection_floors;
    const floorTon = extractMinFloorTonFromProviderRow(cf);
    if (floorTon <= 0) return null;
    return { floorTon, source: "gift_asset_collection" };
  } catch (e) {
    console.warn("[giftAssetPublic] unique price list failed:", e?.message || e);
    return null;
  }
}

/**
 * @returns {Promise<Record<string, object> | null>}
 */
async function loadGlobalCollectionFloorsMap() {
  if (globalPriceListCache.map && Date.now() - globalPriceListCache.at < FLOOR_CACHE_TTL_MS) {
    return globalPriceListCache.map;
  }
  try {
    const res = await giftAssetGet("/api/v1/gifts/get_gifts_price_list", {});
    if (res.status !== 200 || !res.data || typeof res.data !== "object") return null;
    if (res.data.code && res.data.message) return null;
    const cf = res.data.collection_floors;
    if (!cf || typeof cf !== "object") return null;
    globalPriceListCache = { map: cf, at: Date.now() };
    return cf;
  } catch (e) {
    console.warn("[giftAssetPublic] global price list failed:", e?.message || e);
    return null;
  }
}

/**
 * @param {string} collectionName
 * @returns {Promise<{ floorTon: number; source: string } | null>}
 */
async function fetchFloorFromGlobalPriceList(collectionName) {
  const map = await loadGlobalCollectionFloorsMap();
  if (!map) return null;
  const row = matchCollectionRowInGlobalMap(map, collectionName);
  if (!row) return null;
  const floorTon = extractMinFloorTonFromProviderRow(row);
  if (floorTon <= 0) return null;
  return { floorTon, source: "gift_asset_public" };
}

/**
 * Resolve live collection floor (unique list → global list). No user-data routes.
 * @param {string} collectionName
 * @param {string} [cacheKey] normalized cache bucket
 * @returns {Promise<{ floorTon: number; source: string } | null>}
 */
export async function fetchLiveCollectionFloor(collectionName, cacheKey = "") {
  if (!GIFT_ASSET_API_KEY) return null;
  const name = String(collectionName ?? "").trim();
  if (!name) return null;

  const key = cacheKey || normalizeCollectionFloorKeyFromLabel(name);
  if (key) {
    const mem = readCollectionCache(key);
    if (mem && mem.floorTon > 0) {
      return { floorTon: mem.floorTon, source: "gift_asset_memory" };
    }
  }

  let hit = await fetchFloorFromUniquePriceList(name);
  if (!hit) hit = await fetchFloorFromGlobalPriceList(name);
  if (!hit || hit.floorTon <= 0) return null;

  if (key) touchCollectionCache(key, { floorTon: hit.floorTon, source: hit.source, at: Date.now() });
  return hit;
}

/**
 * Try several collection labels; returns first successful floor.
 * @param {string[]} candidates
 * @param {string} cacheKey
 */
export async function fetchLiveCollectionFloorForCandidates(candidates, cacheKey = "") {
  for (const name of candidates) {
    const hit = await fetchLiveCollectionFloor(name, cacheKey);
    if (hit && hit.floorTon > 0) return { ...hit, collectionName: name };
  }
  return null;
}
