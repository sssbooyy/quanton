import { Gift } from "../../models/Gift.js";

function parseGiftNumber(gift) {
  const fromName = String(gift?.name || "").match(/#(\d+)/);
  if (fromName) return Number(fromName[1]);
  return null;
}

function toNormalized(gift) {
  return {
    source: "quanton",
    sourceListingId: String(gift.listingId || gift._id || ""),
    giftName: String(gift.name || ""),
    collection: String(gift.collection || ""),
    model: String(gift.model || ""),
    symbol: String(gift.symbol || ""),
    backdrop: String(gift.backdrop || ""),
    number: parseGiftNumber(gift),
    priceTon: Number(gift.priceTon) || 0,
    seller: gift.sellerUsername
      ? `@${String(gift.sellerUsername).replace(/^@/, "")}`
      : String(gift.sellerTelegramId || ""),
    imageUrl: String(gift.imageHiRes || gift.image || ""),
    marketplaceUrl: gift.giftLink
      ? String(gift.giftLink)
      : `https://t.me/nft/${encodeURIComponent(String(gift.listingId || ""))}`,
    updatedAt: gift.updatedAt ? new Date(gift.updatedAt).toISOString() : new Date().toISOString(),
  };
}

function applyTextQuery(items, q) {
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return items;
  return items.filter((gift) => {
    const hay = [
      gift.name,
      gift.collection,
      gift.model,
      gift.symbol,
      gift.backdrop,
      gift.listingId,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}

function applyFieldFilters(items, query) {
  const collection = String(query.collection || "").trim().toLowerCase();
  const model = String(query.model || "").trim().toLowerCase();
  const symbol = String(query.symbol || "").trim().toLowerCase();
  const backdrop = String(query.backdrop || "").trim().toLowerCase();
  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);

  return items.filter((gift) => {
    if (collection && String(gift.collection || "").toLowerCase() !== collection) return false;
    if (model && String(gift.model || "").toLowerCase() !== model) return false;
    if (symbol && String(gift.symbol || "").toLowerCase() !== symbol) return false;
    if (backdrop && String(gift.backdrop || "").toLowerCase() !== backdrop) return false;
    if (Number.isFinite(minPrice) && Number(gift.priceTon) < minPrice) return false;
    if (Number.isFinite(maxPrice) && Number(gift.priceTon) > maxPrice) return false;
    return true;
  });
}

export async function searchQuantonListings(query = {}) {
  const docs = await Gift.find({
    $or: [
      { listingSource: "manual_url", status: "approved" },
      { listingSource: "manual_admin_verified", status: "listed", verificationStatus: "admin_verified" },
      { listingSource: "escrow", status: "approved", escrowStatus: "listed" },
    ],
  })
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();

  const filtered = applyFieldFilters(applyTextQuery(docs, query.q), query);
  return filtered.map(toNormalized);
}
