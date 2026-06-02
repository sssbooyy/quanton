import crypto from "crypto";
import { AggregatorCache } from "../models/AggregatorCache.js";
import { AGGREGATOR_CACHE_SECONDS, MARKETPLACE_SOURCES } from "../config.js";
import { searchQuantonListings } from "./marketplaces/quantonAdapter.js";
import { searchPortalsListings } from "./marketplaces/portalsAdapter.js";
import { searchTonnelListings } from "./marketplaces/tonnelAdapter.js";
import { searchMrktListings } from "./marketplaces/mrktAdapter.js";
import { searchSatelliteListings } from "./marketplaces/satelliteAdapter.js";

const SORTS = new Set(["price_asc", "price_desc", "rarity", "newest"]);

const SOURCE_ADAPTERS = {
  quanton: searchQuantonListings,
  portals: searchPortalsListings,
  tonnel: searchTonnelListings,
  mrkt: searchMrktListings,
  satellite: searchSatelliteListings,
};

function normalizeQuery(input = {}) {
  const q = String(input.q || "").trim();
  const collection = String(input.collection || "").trim();
  const model = String(input.model || "").trim();
  const symbol = String(input.symbol || "").trim();
  const backdrop = String(input.backdrop || "").trim();
  const minPrice = Number(input.minPrice);
  const maxPrice = Number(input.maxPrice);
  const sort = SORTS.has(String(input.sort || "").trim()) ? String(input.sort).trim() : "price_asc";
  const limit = Math.min(100, Math.max(1, Number.parseInt(input.limit, 10) || 20));

  return {
    q,
    collection,
    model,
    symbol,
    backdrop,
    minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    sort,
    limit,
  };
}

function pickSources() {
  const configured = Array.isArray(MARKETPLACE_SOURCES) ? MARKETPLACE_SOURCES : [];
  return configured.filter((name) => SOURCE_ADAPTERS[name]);
}

function cacheKeyForQuery(query) {
  const hash = crypto.createHash("sha1").update(JSON.stringify(query)).digest("hex");
  return `agg:${hash}`;
}

function dedupeListings(listings) {
  const seen = new Set();
  const output = [];

  for (const item of listings) {
    const key = [
      String(item.giftName || "").toLowerCase(),
      String(item.number ?? ""),
      String(item.source || ""),
      String(item.sourceListingId || ""),
      Number(item.priceTon || 0).toFixed(6),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
}

function sortedListings(listings, sort) {
  const copy = [...listings];
  if (sort === "price_desc") {
    copy.sort((a, b) => Number(b.priceTon) - Number(a.priceTon));
    return copy;
  }
  if (sort === "newest") {
    copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return copy;
  }
  // rarity placeholder: until all sources provide explicit rarity we sort by number asc as proxy.
  if (sort === "rarity") {
    copy.sort((a, b) => Number(a.number ?? Number.MAX_SAFE_INTEGER) - Number(b.number ?? Number.MAX_SAFE_INTEGER));
    return copy;
  }
  copy.sort((a, b) => Number(a.priceTon) - Number(b.priceTon));
  return copy;
}

async function getCached(key) {
  const cached = await AggregatorCache.findOne({ key }).lean();
  if (!cached) return null;
  if (new Date(cached.expiresAt).getTime() <= Date.now()) return null;
  return cached.results || [];
}

async function setCached(key, query, results) {
  const expiresAt = new Date(Date.now() + AGGREGATOR_CACHE_SECONDS * 1000);
  await AggregatorCache.findOneAndUpdate(
    { key },
    {
      $set: {
        key,
        params: query,
        results,
        expiresAt,
      },
    },
    { upsert: true, new: true }
  );
}

async function fetchFromSources(query) {
  const sources = pickSources();
  const settled = await Promise.allSettled(
    sources.map(async (source) => {
      const adapter = SOURCE_ADAPTERS[source];
      const items = await adapter(query);
      return { source, items };
    })
  );

  const errors = [];
  const listings = [];
  for (const row of settled) {
    if (row.status === "fulfilled") {
      listings.push(...row.value.items);
    } else {
      errors.push(String(row.reason?.message || row.reason || "adapter_failed"));
    }
  }

  return { listings, errors, sources };
}

export async function searchAggregator(rawQuery = {}) {
  const query = normalizeQuery(rawQuery);
  const key = cacheKeyForQuery(query);
  const cached = await getCached(key);
  if (cached) {
    return {
      ok: true,
      cached: true,
      query,
      count: cached.length,
      items: cached.slice(0, query.limit),
      errors: [],
    };
  }

  const { listings, errors, sources } = await fetchFromSources(query);
  const normalized = dedupeListings(listings).map((item) => ({
    source: String(item.source || ""),
    sourceListingId: String(item.sourceListingId || ""),
    giftName: String(item.giftName || ""),
    collection: String(item.collection || ""),
    model: String(item.model || ""),
    symbol: String(item.symbol || ""),
    backdrop: String(item.backdrop || ""),
    number: Number.isFinite(Number(item.number)) ? Number(item.number) : null,
    priceTon: Number(item.priceTon) || 0,
    seller: String(item.seller || ""),
    imageUrl: String(item.imageUrl || ""),
    marketplaceUrl: String(item.marketplaceUrl || ""),
    updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : new Date().toISOString(),
  }));

  const sorted = sortedListings(normalized, query.sort);
  await setCached(key, query, sorted);

  return {
    ok: true,
    cached: false,
    query,
    count: sorted.length,
    items: sorted.slice(0, query.limit),
    sources,
    errors,
  };
}

export async function getBestDealsAcrossSources(rawQuery = {}) {
  const search = await searchAggregator({ ...rawQuery, sort: "price_asc", limit: 100 });
  const collectionFloor = new Map();

  for (const item of search.items) {
    const key = String(item.collection || item.giftName || "").toLowerCase();
    if (!key || !item.priceTon) continue;
    const prev = collectionFloor.get(key);
    if (prev == null || item.priceTon < prev) collectionFloor.set(key, item.priceTon);
  }

  const deals = search.items
    .map((item) => {
      const key = String(item.collection || item.giftName || "").toLowerCase();
      const floor = collectionFloor.get(key);
      if (!floor || floor <= 0) return null;
      const discountPct = ((floor - item.priceTon) / floor) * 100;
      if (discountPct < 10) return null;
      return { ...item, floorTon: floor, discountPct: Number(discountPct.toFixed(2)) };
    })
    .filter(Boolean)
    .sort((a, b) => b.discountPct - a.discountPct);

  return deals;
}

export async function getFloorSummary(rawQuery = {}) {
  const search = await searchAggregator({ ...rawQuery, sort: "price_asc", limit: 100 });
  const byMarketplace = new Map();

  for (const item of search.items) {
    const key = String(item.source || "").toLowerCase();
    if (!key) continue;
    const prev = byMarketplace.get(key);
    if (!prev || Number(item.priceTon) < Number(prev.priceTon)) byMarketplace.set(key, item);
  }

  const floors = [...byMarketplace.values()].sort((a, b) => Number(a.priceTon) - Number(b.priceTon));
  const globalFloor = floors[0] || null;
  const max = floors.length ? Math.max(...floors.map((x) => Number(x.priceTon))) : 0;
  const min = floors.length ? Math.min(...floors.map((x) => Number(x.priceTon))) : 0;
  const spreadTon = max - min;

  return {
    query: rawQuery,
    globalFloor,
    byMarketplace: floors,
    spreadTon: Number(spreadTon.toFixed(6)),
  };
}
