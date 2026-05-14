import { Gift } from "../models/Gift.js";
import { resolveGiftMetadata, applyResolvedMetadataToGiftDocument } from "./metadataProvider.js";
import { scheduleGiftImageUpscale, syncUpscaleMetadataFields } from "./imageUpscaler.js";

/**
 * Re-fetch external metadata for a single listing (Gift Asset + fallbacks).
 * @param {string} listingId
 */
export async function refreshGiftByListingId(listingId) {
  const doc = await Gift.findOne({ listingId });
  if (!doc) {
    return { error: { status: 404, body: { error: "Listing not found." } } };
  }
  const paste =
    (typeof doc.giftLink === "string" && doc.giftLink.trim()) ||
    (doc.giftAssetName ? `https://t.me/nft/${doc.giftAssetName}` : "");
  if (!paste) {
    return { error: { status: 400, body: { error: "Nothing to refresh for this listing." } } };
  }
  const resolved = await resolveGiftMetadata(paste);
  if (!resolved.ok) {
    return { error: { status: 400, body: { error: resolved.error || "Refresh failed." } } };
  }
  if (!String((resolved.imageHiRes || resolved.image) ?? "").trim()) {
    return {
      error: { status: 422, body: { error: "Refreshed metadata is missing an image URL." } },
    };
  }
  applyResolvedMetadataToGiftDocument(doc, resolved);
  syncUpscaleMetadataFields(doc, resolved);
  await doc.save();
  if (doc.imageUpscaleStatus === "pending") {
    scheduleGiftImageUpscale(doc.listingId);
  }
  return { gift: doc };
}

/**
 * Batch-refresh stale listings (floor, rarity, media from Gift Asset when configured).
 * @param {{ maxAgeHours?: number; limit?: number }} opts
 */
export async function syncStaleGiftMetadata(opts = {}) {
  const maxAgeHours = Number(opts.maxAgeHours) > 0 ? Number(opts.maxAgeHours) : 48;
  const limit = Number(opts.limit) > 0 ? Math.min(Number(opts.limit), 100) : 20;
  const cutoff = new Date(Date.now() - maxAgeHours * 3600 * 1000);

  const candidates = await Gift.find({
    $and: [
      {
        $or: [{ giftAssetName: { $nin: [null, ""] } }, { giftLink: { $regex: /\S/ } }],
      },
      { $or: [{ metadataSyncedAt: null }, { metadataSyncedAt: { $lt: cutoff } }] },
    ],
  }).limit(limit);

  let updated = 0;
  const errors = [];
  for (const doc of candidates) {
    const r = await refreshGiftByListingId(doc.listingId);
    if (r.error) {
      errors.push({ listingId: doc.listingId, error: r.error.body?.error || "unknown" });
    } else {
      updated += 1;
    }
  }
  return { updated, errors, scanned: candidates.length };
}
