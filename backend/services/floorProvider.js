/**
 * Collection floor resolution (Gift Asset public APIs today; Portals / Fragment / Tonnel later).
 * Uses in-memory TTL cache + Mongo fields for stale-while-offline.
 */

import { FLOOR_CACHE_TTL_MS, GIFT_ASSET_API_KEY } from "../config.js";
import {
  fetchLiveCollectionFloorForCandidates,
  resolveCollectionNameCandidates,
} from "./giftAssetPublicClient.js";
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

  if (liveFloor <= 0 && key) {
    const mem = readCache(key);
    if (mem && mem.floorTon > 0) {
      liveFloor = mem.floorTon;
      liveSource = mem.source || "gift_asset_memory";
    }
  }

  if (liveFloor <= 0 && GIFT_ASSET_API_KEY) {
    const candidates = resolveCollectionNameCandidates(resolved);
    const hit = await fetchLiveCollectionFloorForCandidates(candidates, key);
    if (hit && hit.floorTon > 0) {
      liveFloor = hit.floorTon;
      liveSource = hit.source;
      if (key) {
        touchCache(key, {
          floorTon: liveFloor,
          source: liveSource,
          sales24h: 0,
          at: Date.now(),
        });
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
 * Default Gift Asset public-market implementation (swap for multi-provider later).
 */
export class FloorProvider {
  /** @param {string} [_name = "gift_asset_public"] */
  constructor(_name = "gift_asset_public") {
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

export const defaultFloorProvider = new FloorProvider("gift_asset_public");
