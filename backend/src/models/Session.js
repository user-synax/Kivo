import mongoose from "mongoose";

// Server-side session records. The refresh token is merely a credential that
// references one of these documents by its _id (the "sessionId"). Deleting the
// document revokes the session. A TTL index auto-expires stale sessions.
const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    deviceInfo: {
      userAgent: { type: String, default: null },
      ip: { type: String, default: null },
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Auto-delete expired sessions.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model("Session", sessionSchema);
export default Session;
