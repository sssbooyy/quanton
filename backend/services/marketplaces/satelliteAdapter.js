import axios from "axios";

const SATELLITE_TIMEOUT_MS = 8000;

function normalizeSatelliteRow(row) {
  try {
    return {
      source: "satellite",
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
    };
  } catch (error) {
    console.warn("[aggregator] satellite normalize error", error?.message || error);
    return null;
  }
}

export async function searchSatelliteListings(query = {}) {
  const baseUrl = String(process.env.SATELLITE_API_BASE_URL || "").trim();
  const apiKey = String(process.env.SATELLITE_API_KEY || "").trim();

  if (!apiKey) {
    console.warn("[aggregator] satellite adapter skipped: SATELLITE_API_KEY missing");
    return [];
  }
  if (!baseUrl) return [];

  const url = `${baseUrl.replace(/\/+$/, "")}/search`;
  console.log("[aggregator] satellite request", { url });

  try {
    const res = await axios.get(url, {
      timeout: SATELLITE_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-API-Key": apiKey,
      },
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

    const rawItems = Array.isArray(res.data?.items)
      ? res.data.items
      : Array.isArray(res.data)
        ? res.data
        : [];

    const normalized = rawItems
      .map(normalizeSatelliteRow)
      .filter((x) => x && x.giftName && x.priceTon > 0);

    console.log("[aggregator] satellite listings", {
      returned: normalized.length,
    });
    return normalized;
  } catch (error) {
    console.warn("[aggregator] satellite adapter failed", error?.message || error);
    return [];
  }
}
