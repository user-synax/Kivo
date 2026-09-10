import mongoose from "mongoose";

const customEmojiSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 32,
      minlength: 2,
      match: /^[a-z0-9_]+$/,
    },
    spaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
      default: null,
      index: true,
    },
    // Personal emoji owner: null = space/global, ObjectId = personal (Plus-only, usable everywhere)
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    fileId: {
      type: String,
      default: null,
      select: false,
    },
    bucketId: {
      type: String,
      default: null,
      select: false,
    },
    animated: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Space-scoped: per-space unique name (only when spaceId is ObjectId)
customEmojiSchema.index(
  { spaceId: 1, name: 1 },
  { unique: true, partialFilterExpression: { spaceId: { $type: "objectId" } }, name: "space_emoji_unique" }
);
// Personal: per-owner unique name (only when ownerId is ObjectId)
customEmojiSchema.index(
  { ownerId: 1, name: 1 },
  { unique: true, partialFilterExpression: { ownerId: { $type: "objectId" } }, name: "personal_emoji_unique" }
);
// Global: unique name among globals (both null)
customEmojiSchema.index(
  { name: 1 },
  { unique: true, partialFilterExpression: { spaceId: null, ownerId: null }, name: "global_emoji_unique" }
);

const CustomEmoji = mongoose.model("CustomEmoji", customEmojiSchema);

// Drop legacy index `spaceId_1_name_1` (pre-personal, was global+space unique) so per-owner personal names can reuse same :name: across owners.
// Runs once on first import after DB connects; safe to fail if index already gone or DB not yet connected.
try {
  const conn = mongoose.connection;
  const dropLegacy = () => CustomEmoji.collection.dropIndex("spaceId_1_name_1").catch(() => {});
  if (conn.readyState === 1) dropLegacy();
  else conn.once("connected", dropLegacy);
} catch {}

export default CustomEmoji;
