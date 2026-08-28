import mongoose from "mongoose";

// Friend relationships are request-based: a user sends a request, the target
// accepts (or declines). An "accepted" request is the friendship edge. We keep
// declined requests as a terminal record (rather than deleting) so the sender
// can see the outcome, but only "accepted" rows count as friends.
const friendRequestSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true }
);

// One active request per directed pair. Prevents spamming duplicate requests
// from the same sender to the same target.
friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });

// Quickly find incoming/outgoing requests for a user.
friendRequestSchema.index({ to: 1, status: 1 });
friendRequestSchema.index({ from: 1, status: 1 });

export const FriendRequest = mongoose.model("FriendRequest", friendRequestSchema);
export default FriendRequest;
