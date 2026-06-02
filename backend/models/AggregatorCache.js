import mongoose from "mongoose";

const aggregatorCacheSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    results: { type: [mongoose.Schema.Types.Mixed], default: [] },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

aggregatorCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AggregatorCache =
  mongoose.models.AggregatorCache || mongoose.model("AggregatorCache", aggregatorCacheSchema);
