import mongoose from "mongoose";

/**
 * Telegram Mini App / bot user profile (from WebApp initDataUnsafe.user or bot /start).
 * Upserted when a listing is submitted with `telegramUser` or via bot language commands.
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
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
