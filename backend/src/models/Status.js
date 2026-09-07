import mongoose from "mongoose";

const viewerSchema = new mongoose.Schema(
  { userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, viewedAt: { type: Date, default: Date.now } },
  { _id: false }
);

const statusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 280 },
    background: { type: String, enum: ["default","accent","sunset","ocean","forest","midnight"], default: "default" },
    viewers: { type: [viewerSchema], default: [] },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

statusSchema.index({ userId: 1, expiresAt: 1 });
statusSchema.index({ createdAt: -1 });
statusSchema.index({ "viewers.userId": 1 });

export const STATUS_BACKGROUNDS = ["default","accent","sunset","ocean","forest","midnight"];
export const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

export const Status = mongoose.model("Status", statusSchema);
export default Status;
