import mongoose from "mongoose";

const ROLES = ["owner", "admin", "moderator", "member"];
const CHANNEL_TYPES = ["text", "announcement"];
const CATEGORIES = [
  "Technology",
  "Design",
  "Education",
  "Business",
  "Gaming",
  "Community",
  "Art",
  "Music",
  "Lifestyle",
  "Other",
];

const memberSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ROLES, default: "member" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const channelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    slug: { type: String, required: true, lowercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 280, default: "" },
    type: { type: String, enum: CHANNEL_TYPES, default: "text" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const spaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    category: { type: String, enum: CATEGORIES, default: "Other" },
    avatarUrl: { type: String, default: null },
    avatarFileId: { type: String, default: null, select: false },
    banner: { type: String, default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [memberSchema], default: [] },
    channels: { type: [channelSchema], default: [] },
  },
  { timestamps: true }
);

spaceSchema.index({ "members.userId": 1 });
spaceSchema.index({ name: 1 });

export const SPACE_ROLES = ROLES;
export const SPACE_CHANNEL_TYPES = CHANNEL_TYPES;
export const SPACE_CATEGORIES = CATEGORIES;

export default mongoose.model("Space", spaceSchema);
