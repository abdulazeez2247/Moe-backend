const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripePaymentIntentId: String,
    stripeSubscriptionId: String,
    stripeCustomerId: String,
    plan: {
      type: String,
      enum: ["free", "hobby", "occ", "pro", "ent"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "USD",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded"],
      default: "pending",
    },
    type: {
      type: String,
      enum: ["one_time", "subscription"],
      required: true,
    },
    periodStart: Date,
    periodEnd: Date,
    invoiceUrl: String,
    rawStripeData: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index(
  { stripePaymentIntentId: 1 },
  { unique: true, sparse: true }
);
paymentSchema.index({ stripeSubscriptionId: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model("Payment", paymentSchema);
