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
    /** Telegram collectible model trait (e.g. True Love). */
    model: { type: String, default: "", trim: true },
    symbol: { type: String, default: "", trim: true },
    backdrop: { type: String, default: "", trim: true },
    image: { type: String, required: true, trim: true },
    /** Largest static raster URL (Gift Asset / upgraded OG); primary quality source. */
    imageHiRes: { type: String, default: "", trim: true },
    /** Smaller raster for marketplace grid (optional; falls back to imageHiRes). */
    imageThumb: { type: String, default: "", trim: true },
    /** Poster / first frame for video or Lottie while loading. */
    animationPosterUrl: { type: String, default: "", trim: true },
    /** `contain` for sticker-like transparent gifts; `cover` for photo-like OG previews. */
    imageFit: { type: String, enum: ["contain", "cover"], default: "contain" },
    /** OpenGraph / low-res source URL before optional AI upscale (OpenGraph listings). */
    imageOriginal: { type: String, default: "", trim: true },
    imageUpscaled: { type: Boolean, default: false },
    imageUpscaleProvider: { type: String, default: "", trim: true },
    imageUpscaledAt: { type: Date, default: null },
    imageUpscaleStatus: {
      type: String,
      enum: ["none", "pending", "skipped", "complete", "done", "failed"],
      default: "none",
    },
    /** Fragment / Telegram lottie JSON URL when available */
    animationUrl: { type: String, default: "", trim: true },
    /**
     * Media provenance: local_asset | gift_asset | telegram_cdn | telegram_sticker | ai_upscaled | opengraph
     */
    mediaSource: { type: String, default: "", trim: true },
    /**
     * Match specificity: exact_model | model | collection | opengraph
     */
    mediaMatchLevel: { type: String, default: "", trim: true },
    priceTon: { type: Number, required: true },
    floorTon: { type: Number, required: true },
    /** Normalized key for cross-alias floor cache (e.g. freshsocks / fresh-socks). */
    collectionFloorKey: { type: String, default: "", trim: true, index: true },
    /** Best-known collection floor (live provider → Mongo stale → resolver seed). */
    resolvedFloorTon: { type: Number, default: 0 },
    resolvedFloorSource: { type: String, default: "", trim: true },
    resolvedFloorUpdatedAt: { type: Date, default: null },
    rarity: { type: Number, required: true, min: 1, max: 100 },
    sales24h: { type: Number, default: 0 },
    volumeGrowth: { type: Number, default: 0 },
    liquidity: { type: String, default: "Unknown" },
    risk: { type: String, default: "Unknown" },
    status: { type: String, default: "pending" },
    /** Escrow marketplace state: only `listed` escrow gifts should be publicly buyable. */
    escrowStatus: {
      type: String,
      enum: ["none", "pending_verification", "escrowed", "listed", "reserved", "sold", "transferred", "failed"],
      default: "none",
      index: true,
    },
    transferStatus: {
      type: String,
      enum: ["none", "not_ready", "pending", "transferred", "failed", "retrying"],
      default: "none",
      index: true,
    },
    payoutStatus: {
      type: String,
      enum: ["none", "pending", "paid", "failed"],
      default: "none",
      index: true,
    },
    /** Telegram escrow provenance. */
    escrowOwnerTelegramId: { type: String, default: "", trim: true, index: true },
    ownedGiftId: { type: String, default: "", trim: true, index: true },
    receivedGiftId: { type: String, default: "", trim: true, index: true },
    transferCooldown: { type: mongoose.Schema.Types.Mixed, default: null },
    buyerTelegramId: { type: String, default: "", trim: true, index: true },
    txHash: { type: String, default: "", trim: true, index: true },
    paidAt: { type: Date, default: null },
    transferredAt: { type: Date, default: null },
    transferAttempts: { type: Number, default: 0 },
    transferError: { type: String, default: "", trim: true },
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
giftSchema.index(
  { ownedGiftId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { ownedGiftId: { $type: "string", $gt: "" } } }
);

function computeAiScoreForDoc(doc) {
  const base = {
    id: doc.listingId,
    name: doc.name,
    collection: doc.collection,
    image: doc.image,
    priceTon: doc.priceTon,
    floorTon: doc.floorTon,
    resolvedFloorTon: doc.resolvedFloorTon ?? 0,
    resolvedFloorSource: doc.resolvedFloorSource ?? "",
    resolvedFloorUpdatedAt: doc.resolvedFloorUpdatedAt ?? null,
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
