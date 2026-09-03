import mongoose from "mongoose";

// Reaction subdocument: who reacted and with which emoji. The _id is used by the
// client to target a specific reaction when removing it.
const reactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, maxlength: 8 },
  },
  { _id: true, timestamps: true }
);

// Read receipt: who read the message and when.
const readBySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Saved (bookmark): per-user saves, mirroring reactions. A message is "saved"
// for a user when their userId is present; the savedAt drives the Saved view's
// ordering (newest save first).
const savedBySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    savedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// A single chat message. Messages are stored in their own collection (not
// embedded in the Conversation) and referenced by conversationId so a thread can
// grow without bloating the conversation document.
const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Plain text for now. File/attachment support is intentionally out of scope
    // for this pass (see spec); the schema leaves room for a media array later.
    // Not `required` here because soft-deleted messages blank it to ""; creation
    // still enforces non-empty content via the zod schema in messages.validation.
    content: { type: String, trim: true, maxlength: 4000 },

    // "text" for normal chat messages; "system" for centered info notices
    // (e.g. a member was removed from a group). System messages render as a
    // non-interactive chip and never bump unread counts.
    type: { type: String, enum: ["text", "system"], default: "text" },

    // Optional reference to the message this one replies to with an inline
    // quote (rendered flat in the main timeline). Distinct from threads.
    replyToMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Threading. When set, this message is a reply inside the thread anchored
    // at the referenced root message and is EXCLUDED from the main timeline
    // (thread conversations render in the thread side panel instead). Root
    // messages have threadId === null. Thread replies don't bump unread counts
    // and only ever produce mention notifications, never category ones.
    threadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    reactions: { type: [reactionSchema], default: [] },

    // User ids that have received delivery of this message (per-device delivery
    // could be modelled later; for now an id appears once it's been delivered).
    deliveredTo: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    readBy: { type: [readBySchema], default: [] },

    // Per-user saves ("Saved messages"). Not a read/unread signal.
    savedBy: { type: [savedBySchema], default: [] },

    // User ObjectIds resolved from @username mentions in the content.
    mentions: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },

    // File attachments — images and documents uploaded via the attachments endpoint.
    attachments: {
      type: [
        {
          fileId: { type: String, required: true },
          bucketId: { type: String, required: true },
          fileName: { type: String, required: true },
          mimeType: { type: String, required: true },
          size: { type: Number, required: true },
          kind: { type: String, enum: ["image", "document"], required: true },
          url: { type: String, required: true },
        },
      ],
      default: [],
    },
    isEdited: { type: Boolean, default: false },
    // Soft delete: keep the row (so replies/ordering remain stable) but blank it.
    isDeleted: { type: Boolean, default: false },

    // Forwarding. `forwardedFromId` references the original message and
    // `forwardedFromName` is the original author's display name, denormalized
    // at forward time so the attribution pill renders without cross-conversation
    // joins. Forwarded copies never re-resolve @mentions.
    forwardedFromId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    forwardedFromName: { type: String, default: null },

    // Pinning. Any member can pin/unpin a message; pinned messages surface in a
    // banner at the top of the conversation. Deleting a message clears its pin.
    pinnedAt: { type: Date, default: null },
    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// Most common query: "messages for this conversation, newest last".
messageSchema.index({ conversationId: 1, createdAt: -1 });
// Thread replies per root (thread panel feed), oldest first.
messageSchema.index({ conversationId: 1, threadId: 1, createdAt: 1 });
// Pinned messages per conversation (banner feed), newest pin first.
messageSchema.index({ conversationId: 1, pinnedAt: -1 });
// Secondary: "messages sent by a user" (e.g. for moderation/search later).
messageSchema.index({ senderId: 1, createdAt: -1 });
// Saved feed per user: "messages this user saved, newest save first".
messageSchema.index({ "savedBy.userId": 1, "savedBy.savedAt": -1 });

// Text index for full-text search on message content.
messageSchema.index({ content: "text" }, { weights: { content: 1 } });

export const Message = mongoose.model("Message", messageSchema);
export default Message;
