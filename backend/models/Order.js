import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, trim: true, index: true },
    buyerTelegramId: { type: String, default: "", trim: true, index: true },
    buyerWalletAddress: { type: String, default: "", trim: true, index: true },
    listingIds: { type: [String], required: true, default: [] },
    totalTon: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "failed", "expired"],
      default: "pending_payment",
      index: true,
    },
    txHash: { type: String, default: "", trim: true, index: true },
    payload: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now, index: true },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
