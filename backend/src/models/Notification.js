import mongoose from "mongoose";

const NOTIFICATION_TYPES = [
  "dm_message",
  "group_message",
  "space_message",
  "friend_request",
  "friend_accept",
  "space_invite",
  "mention",
  "wave",
  "missed_call",
];

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Username of the acting user (denormalized at send time so a "wave" or
    // friend event can deep-link to the sender's profile without a join).
    senderUsername: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
      index: true,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      default: "",
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
    seen: {
      type: Boolean,
      default: false,
    },
    delivery: {
      inAppDelivered: { type: Boolean, default: false },
      pushDelivered: { type: Boolean, default: false },
      pushError: { type: String, default: null },
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, read: 1 });
notificationSchema.index({ recipientId: 1, type: 1 });

export const NOTIFICATION_TYPES_CONST = NOTIFICATION_TYPES;

export const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
