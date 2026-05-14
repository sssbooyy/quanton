/**
 * Collection floor resolution (Gift Asset today; Portals / Fragment / Tonnel later).
 * Uses in-memory TTL cache + Mongo fields for stale-while-offline.
 */

import { FLOOR_CACHE_TTL_MS } from "../config.js";
import { fetchGiftAssetByName } from "./giftAssetClient.js";
import {
  normalizeCollectionFloorKeyFromGiftAssetName,
  normalizeCollectionFloorKeyFromLabel,
} from "./floorNormalization.js";

/** @type {Map<string, { floorTon: number; source: string; sales24h: number; at: number }>} */
const memoryFloorCache = new Map();
const MAX_CACHE_ENTRIES = 500;

function touchCache(key, row) {
  if (memoryFloorCache.size > MAX_CACHE_ENTRIES) {
    const first = memoryFloorCache.keys().next().value;
    if (first) memoryFloorCache.delete(first);
  }
  memoryFloorCache.set(key, row);
}

function readCache(key) {
  const row = memoryFloorCache.get(key);
  if (!row) return null;
  if (Date.now() - row.at > FLOOR_CACHE_TTL_MS) {
    memoryFloorCache.delete(key);
    return null;
  }
  return row;
}

/**
 * Aggregate 24h sales count from Gift Asset `providers` map.
 * @param {object | null | undefined} payload
 */
export function extractSales24hFromGiftAssetPayload(payload) {
  if (!payload || typeof payload !== "object") return 0;
  const providers = payload.providers;
  if (!providers || typeof providers !== "object") return 0;
  let sum = 0;
  for (const p of Object.values(providers)) {
    const n = Number(p?.sales_stat?.sales_24h);
    if (Number.isFinite(n)) sum += n;
  }
  return Math.round(sum);
}

/**
 * Best-effort collection floor in TON from Gift Asset payload (market_floor + marketplace rows).
 * Prefers **min** positive quote across sources (closest to tradable floor).
 * @param {object | null | undefined} payload
 * @returns {number}
 */
export function extractBestCollectionFloorTon(payload) {
  if (!payload || typeof payload !== "object") return 0;
  const candidates = [];

  const mf = payload.market_floor;
  if (mf && typeof mf === "object") {
    for (const k of ["min", "avg", "floor", "median", "ton"]) {
      const n = Number(mf[k]);
      if (Number.isFinite(n) && n > 0) candidates.push(n);
    }
  }

  const providers = payload.providers;
  if (providers && typeof providers === "object") {
    for (const v of Object.values(providers)) {
      const cf = Number(v?.collection_floor);
      const mf2 = Number(v?.model_floor);
      if (Number.isFinite(cf) && cf > 0) candidates.push(cf);
      if (Number.isFinite(mf2) && mf2 > 0) candidates.push(mf2);
    }
  }

  if (!candidates.length) return 0;
  return Math.min(...candidates);
}

/**
 * Legacy extractor (avg/min on market_floor only) — used as secondary hint.
 * @param {object | null | undefined} payload
 */
export function extractLegacyMarketFloorTon(payload) {
  const mf = payload?.market_floor;
  if (!mf || typeof mf !== "object") return 0;
  const avg = Number(mf.avg);
  if (Number.isFinite(avg) && avg > 0) return avg;
  const mn = Number(mf.min);
  if (Number.isFinite(mn) && mn > 0) return mn;
  return 0;
}

/**
 * Effective floor for scoring / API (live resolved → Mongo cache → listing seed).
 * @param {{ floorTon?: unknown; resolvedFloorTon?: unknown }} row
 * @returns {number}
 */
export function computeRealFloorTon(row) {
  const live = Number(row?.resolvedFloorTon);
  if (Number.isFinite(live) && live > 0) return live;
  const seed = Number(row?.floorTon);
  if (Number.isFinite(seed) && seed > 0) return seed;
  return 0;
}

/**
 * @param {object} resolved Metadata resolver output (`ok: true`)
 * @param {{
 *   giftAssetPayload?: object | null;
 *   previousResolvedFloorTon?: number;
 *   previousResolvedFloorSource?: string;
 *   previousResolvedFloorUpdatedAt?: Date | null;
 * }} [ctx]
 */
export async function finalizeResolvedFloorMetadata(resolved, ctx = {}) {
  const giftAssetName = String(resolved.giftAssetName || "").trim();
  const label = String(resolved.collection || "").trim();
  const key =
    (giftAssetName && normalizeCollectionFloorKeyFromGiftAssetName(giftAssetName)) ||
    normalizeCollectionFloorKeyFromLabel(label) ||
    "";

  resolved.collectionFloorKey = key;

  const prevResolved = Number(ctx.previousResolvedFloorTon) || 0;
  const prevSource = String(ctx.previousResolvedFloorSource || "").trim();

  let liveFloor = 0;
  let liveSource = "";
  let salesBump = 0;

  const directPayload = ctx.giftAssetPayload ?? resolved.__giftAssetPayload ?? null;
  if (directPayload && typeof directPayload === "object") {
    liveFloor = extractBestCollectionFloorTon(directPayload);
    if (liveFloor <= 0) liveFloor = extractLegacyMarketFloorTon(directPayload);
    if (liveFloor > 0) {
      liveSource = "gift_asset";
      salesBump = extractSales24hFromGiftAssetPayload(directPayload);
      if (key) touchCache(key, { floorTon: liveFloor, source: liveSource, sales24h: salesBump, at: Date.now() });
    }
  }

  if (liveFloor <= 0 && key) {
    const mem = readCache(key);
    if (mem && mem.floorTon > 0) {
      liveFloor = mem.floorTon;
      liveSource = "gift_asset_memory";
    }
  }

  if (liveFloor <= 0 && giftAssetName) {
    const payload = await fetchGiftAssetByName(giftAssetName);
    if (payload) {
      liveFloor = extractBestCollectionFloorTon(payload);
      if (liveFloor <= 0) liveFloor = extractLegacyMarketFloorTon(payload);
      if (liveFloor > 0) {
        liveSource = "gift_asset";
        salesBump = extractSales24hFromGiftAssetPayload(payload);
        if (key) touchCache(key, { floorTon: liveFloor, source: liveSource, sales24h: salesBump, at: Date.now() });
      }
    }
  }

  const merged = liveFloor > 0 ? liveFloor : prevResolved > 0 ? prevResolved : 0;
  const mergedSource =
    liveFloor > 0 ? liveSource : prevResolved > 0 ? prevSource || "mongo_cached" : "";

  const seed = Number(resolved.floorTon) || 0;
  const finalFloor = merged > 0 ? merged : seed;
  const finalSource =
    merged > 0 ? mergedSource : seed > 0 ? "resolver_seed" : mergedSource || "unavailable";

  resolved.resolvedFloorTon = finalFloor;
  resolved.resolvedFloorSource = finalSource;

  if (finalFloor > 0) {
    if (liveFloor > 0) {
      resolved.resolvedFloorUpdatedAt = new Date();
    } else if (merged > 0 && merged === prevResolved && prevResolved > 0) {
      const p = ctx.previousResolvedFloorUpdatedAt;
      resolved.resolvedFloorUpdatedAt =
        p instanceof Date ? p : p ? new Date(p) : new Date();
    } else {
      resolved.resolvedFloorUpdatedAt = new Date();
    }
  } else {
    resolved.resolvedFloorUpdatedAt = null;
  }

  if (liveFloor > 0 && salesBump > 0 && (!resolved.sales24h || resolved.sales24h === 0)) {
    resolved.sales24h = salesBump;
  }

  delete resolved.__giftAssetPayload;
}

export function computeFloorIsLive(plain) {
  const ton = Number(plain?.resolvedFloorTon);
  if (!Number.isFinite(ton) || ton <= 0) return false;
  const src = String(plain?.resolvedFloorSource || "");
  if (!src.startsWith("gift_asset")) return false;
  const d = plain?.resolvedFloorUpdatedAt;
  const t = d instanceof Date ? d.getTime() : d ? new Date(d).getTime() : 0;
  if (!t || Number.isNaN(t)) return false;
  return Date.now() - t < FLOOR_CACHE_TTL_MS * 3;
}

/**
 * Default Gift Asset implementation (swap for multi-provider later).
 */
export class FloorProvider {
  /** @param {string} [_name = "gift_asset"] */
  constructor(_name = "gift_asset") {
    this.name = _name;
  }

  /**
   * @param {object} resolved
   * @param {object} [ctx]
   */
  async enrichMetadata(resolved, ctx) {
    await finalizeResolvedFloorMetadata(resolved, ctx);
  }
}

export const defaultFloorProvider = new FloorProvider("gift_asset");
