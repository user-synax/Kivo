import mongoose from "mongoose";

// A manual-UPI Plus claim: the user paid ₹49 to the published UPI ID and
// submits the 12-digit UPI reference (UTR/RRN) for admin review. Approval
// grants Plus for 30 days (manual grant, planExpiresAt set — never lifetime).
// Pending claims carry a 24h review window (expiresAt); the hourly sweep
// flips lapsed ones to "expired" so the user can file a fresh claim.
const plusRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // 12-digit UPI transaction reference (RRN). Validated by zod; stored
    // trimmed. Uniqueness is NOT enforced — a repeated UTR is a review
    // signal for the admin, not a DB error.
    utr: { type: String, required: true, trim: true, maxlength: 32 },
    // Amount paid, in paise. Fixed at ₹49 (4900) for one month.
    amountPaise: { type: Number, default: 4900 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "expired"],
      default: "pending",
      index: true,
    },
    // Review deadline (createdAt + 24h). Enforced by the sweep; the admin
    // queue sorts pending oldest-first so the tightest deadline is on top.
    expiresAt: { type: Date, required: true, index: true },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null, maxlength: 500 },
  },
  { timestamps: true },
);

plusRequestSchema.index({ status: 1, createdAt: -1 });
plusRequestSchema.index({ userId: 1, status: 1 });

export const PlusRequest = mongoose.model("PlusRequest", plusRequestSchema);
export default PlusRequest;
