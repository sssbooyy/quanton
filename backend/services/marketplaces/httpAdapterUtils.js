import axios from "axios";

const DEFAULT_TIMEOUT_MS = 7000;

export function normalizeExternalRows(rows, source) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      source,
      sourceListingId: String(
        row?.sourceListingId ?? row?.listingId ?? row?.id ?? row?.uuid ?? ""
      ),
      giftName: String(row?.giftName ?? row?.name ?? ""),
      collection: String(row?.collection ?? ""),
      model: String(row?.model ?? ""),
      symbol: String(row?.symbol ?? ""),
      backdrop: String(row?.backdrop ?? ""),
      number: Number.isFinite(Number(row?.number)) ? Number(row.number) : null,
      priceTon: Number(row?.priceTon ?? row?.price ?? 0) || 0,
      seller: String(row?.seller ?? row?.sellerUsername ?? row?.sellerId ?? ""),
      imageUrl: String(row?.imageUrl ?? row?.image ?? ""),
      marketplaceUrl: String(row?.marketplaceUrl ?? row?.url ?? ""),
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    }))
    .filter((x) => x.giftName && x.priceTon > 0);
}

export async function fetchExternalAdapter({ source, baseUrl, query }) {
  if (!String(baseUrl || "").trim()) return [];

  const url = `${String(baseUrl).replace(/\/+$/, "")}/search`;
  try {
    const res = await axios.get(url, {
      timeout: DEFAULT_TIMEOUT_MS,
      params: {
        q: query.q,
        collection: query.collection,
        model: query.model,
        symbol: query.symbol,
        backdrop: query.backdrop,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        limit: query.limit || 100,
      },
    });
    const rows = Array.isArray(res.data?.items) ? res.data.items : Array.isArray(res.data) ? res.data : [];
    return normalizeExternalRows(rows, source);
  } catch (error) {
    console.warn(`[aggregator] ${source} adapter failed`, error?.message || error);
    return [];
  }
}
