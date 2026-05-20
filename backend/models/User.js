import mongoose from "mongoose";

const miningUpgradeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    level: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/**
 * Telegram Mini App user profile (from WebApp initDataUnsafe.user).
 * Upserted when a listing is submitted with `telegramUser` or via mining endpoints.
 */
const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    username: { type: String, default: "" },
    languageCode: { type: String, default: "" },
    isPremium: { type: Boolean, default: false },
    photoUrl: { type: String, default: "" },

    shards: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    xp: { type: Number, default: 0, min: 0 },
    energy: { type: Number, default: 1000, min: 0 },
    maxEnergy: { type: Number, default: 1000, min: 1 },
    energyUpdatedAt: { type: Date, default: Date.now },
    miningPower: { type: Number, default: 1, min: 1 },
    dailyStreak: { type: Number, default: 0, min: 0 },
    lastDailyClaim: { type: Date, default: null },
    totalTaps: { type: Number, default: 0, min: 0 },
    upgrades: { type: [miningUpgradeSchema], default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
