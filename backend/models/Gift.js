import mongoose from "mongoose";
import { calculateAiScore } from "../services/aiScore.js";

const traitEntrySchema = new mongoose.Schema(
  {
    key: { type: String, default: "" },
    value: { type: String, default: "" },
    media: { type: String, default: "" },
  },
  { _id: false }
);

/**
 * Quanton listing. `listingId` is the stable public id returned as `id` in API JSON.
 * `aiScore` is denormalized from `calculateAiScore` for indexing and sorting; API responses
 * still merge live `calculateAiScore` output so the model formula stays authoritative.
 */
const giftSchema = new mongoose.Schema(
  {
    listingId: { type: String, required: true, unique: true, trim: true },
    /** Pasted Telegram gift link or raw gift id (new listings). */
    giftLink: { type: String, default: "", trim: true, index: true },
    /** Gift Asset `name` query (e.g. LushBouquet-6509) for refresh/sync. */
    giftAssetName: { type: String, default: "", trim: true, index: true },
    /** Optional note from seller (new listings). */
    sellerNote: { type: String, default: "", trim: true },
    name: { type: String, required: true, trim: true },
    collection: { type: String, required: true, trim: true },
    image: { type: String, required: true, trim: true },
    /** Fragment / Telegram lottie JSON URL when available */
    animationUrl: { type: String, default: "", trim: true },
    priceTon: { type: Number, required: true },
    floorTon: { type: Number, required: true },
    rarity: { type: Number, required: true, min: 1, max: 100 },
    sales24h: { type: Number, default: 0 },
    volumeGrowth: { type: Number, default: 0 },
    liquidity: { type: String, default: "Unknown" },
    risk: { type: String, default: "Unknown" },
    status: { type: String, default: "pending" },
    traits: { type: [traitEntrySchema], default: [] },
    /**
     * gift-asset | opengraph | catalog-json | seed-catalog
     * (seed-catalog only from Mongo seed import)
     */
    metadataSource: { type: String, default: "gift-asset", trim: true },
    /** Trimmed provider payload / OG snapshot for analytics & refresh */
    cachedMetadata: { type: mongoose.Schema.Types.Mixed, default: null },
    /** Last successful metadata sync */
    metadataSyncedAt: { type: Date, default: null },
    /** Owner / provenance from external providers (future wallet proofs) */
    ownerInfo: { type: mongoose.Schema.Types.Mixed, default: null },
    telegramUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    /** Exact payload echoed by GET /gifts for Mini App compatibility */
    telegramUserSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    /** Denormalized for MongoDB indexes (kept in sync in pre-save) */
    aiScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

giftSchema.index({ name: 1 });
giftSchema.index({ rarity: 1 });
giftSchema.index({ aiScore: -1 });
giftSchema.index({ metadataSyncedAt: 1 });

function computeAiScoreForDoc(doc) {
  const base = {
    id: doc.listingId,
    name: doc.name,
    collection: doc.collection,
    image: doc.image,
    priceTon: doc.priceTon,
    floorTon: doc.floorTon,
    rarity: doc.rarity,
    sales24h: doc.sales24h ?? 0,
    volumeGrowth: doc.volumeGrowth ?? 0,
    liquidity: doc.liquidity,
    risk: doc.risk,
    status: doc.status,
  };
  return calculateAiScore(base).aiScore;
}

giftSchema.pre("save", function (next) {
  try {
    this.aiScore = computeAiScoreForDoc(this);
    next();
  } catch (e) {
    next(e);
  }
});

export const Gift = mongoose.models.Gift || mongoose.model("Gift", giftSchema);
