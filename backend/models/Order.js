import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, trim: true, index: true },
    buyerTelegramId: { type: String, default: "", trim: true, index: true },
    buyerUsername: { type: String, default: "", trim: true },
    sellerTelegramId: { type: String, default: "", trim: true, index: true },
    sellerUsername: { type: String, default: "", trim: true },
    sellerPayoutAddress: { type: String, default: "", trim: true },
    sellerPayoutAddressReceivedAt: { type: Date, default: null },
    buyerWalletAddress: { type: String, default: "", trim: true, index: true },
    listingIds: { type: [String], required: true, default: [] },
    totalTon: { type: Number, required: true, min: 0 },
    totalUzs: { type: Number, default: 0, min: 0 },
    tonUzsRate: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: ["ton", "card", "ton_manual_admin"], default: "ton", index: true },
    paymentReviewStatus: {
      type: String,
      enum: ["none", "waiting_admin_confirmation", "confirmed_by_admin", "rejected_by_admin"],
      default: "none",
      index: true,
    },
    paymentClaimedAt: { type: Date, default: null },
    walletAppInfo: { type: String, default: "", trim: true },
    marketplaceWalletAddress: { type: String, default: "", trim: true },
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
      enum: [
        "pending_payment",
        "paid",
        "awaiting_transfer",
        "buyer_confirmed",
        "completed",
        "disputed",
        "failed",
        "expired",
        "payment_rejected",
      ],
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
      enum: ["none", "not_ready", "waiting_seller_wallet", "waiting_buyer_confirmation", "pending_admin_payout", "paid", "failed"],
      default: "not_ready",
      index: true,
    },
    transferResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
