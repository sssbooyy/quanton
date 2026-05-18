import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, trim: true, index: true },
    buyerTelegramId: { type: String, default: "", trim: true, index: true },
    buyerUsername: { type: String, default: "", trim: true },
    buyerWalletAddress: { type: String, default: "", trim: true, index: true },
    listingIds: { type: [String], required: true, default: [] },
    totalTon: { type: Number, required: true, min: 0 },
    totalUzs: { type: Number, default: 0, min: 0 },
    tonUzsRate: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: ["ton", "card"], default: "ton", index: true },
    cardProvider: { type: String, enum: ["", "click", "payme"], default: "", index: true },
    paymentUrl: { type: String, default: "", trim: true },
    cardPaymentStatus: {
      type: String,
      enum: ["none", "pending", "paid", "failed", "cancelled"],
      default: "none",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "awaiting_transfer", "buyer_confirmed", "completed", "disputed", "failed", "expired"],
      default: "pending_payment",
      index: true,
    },
    txHash: { type: String, default: "", trim: true, index: true },
    payload: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now, index: true },
    paidAt: { type: Date, default: null },
    transferStatus: {
      type: String,
      enum: ["none", "not_started", "pending", "pending_manual_transfer", "buyer_confirmed_received", "disputed", "transferred", "failed", "partial"],
      default: "not_started",
      index: true,
    },
    payoutStatus: {
      type: String,
      enum: ["none", "not_ready", "pending_admin_payout", "paid", "failed"],
      default: "not_ready",
      index: true,
    },
    transferResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
