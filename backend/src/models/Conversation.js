import mongoose from "mongoose";

// Conversations group message threads. For 1-to-1 chat, type is "dm" and there
// are exactly two participants. Group chats (future work) use type "group".
// The message bodies live in the separate Message collection (see Message.js),
// keyed by conversationId — they are NOT embedded here, so a conversation with
// thousands of messages stays a tiny document.
const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["dm", "group"],
      default: "dm",
      required: true,
    },
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      required: true,
      // Always exactly 2 for DM; >= 3 for groups (enforced in the service).
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2,
        message: "A conversation needs at least two participants",
      },
    },
    // Group display name. Required for type "group", unused for DMs.
    name: {
      type: String,
      trim: true,
      maxlength: 50,
      default: null,
      validate: {
        validator(v) {
          if (this.type === "group") {
            return typeof v === "string" && v.trim().length > 0;
          }
          return true;
        },
        message: "Group conversations require a name",
      },
    },
    // Uploaded group photo (public Appwrite view URL). Mirrors the User avatar
    // pattern; null until uploaded.
    avatarUrl: { type: String, default: null },
    // Appwrite file id backing avatarUrl. Server-only (never sent to clients).
    avatarFileId: { type: String, default: null, select: false },
    // Creator of the group (the first admin). Null for DMs.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Group admins. Participants-only; the creator is seeded as the first admin.
    // Empty for DMs (membership is the only authorization primitive there).
    admins: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    // Denormalized timestamp of the latest message, used to sort the inbox.
    lastMessageAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

// Index for inbox listing (find all conversations a user participates in) and
// for the duplicate-DM lookup in the service layer ($all on participants).
// Duplicate DM prevention is handled explicitly in the service (a unique index
// on an array field does not behave as a pairwise constraint in MongoDB).
conversationSchema.index({ participants: 1 });

export const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
