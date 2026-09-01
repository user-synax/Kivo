import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const ROLES = ["user", "admin"];

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    // Short free-text bio shown on the full profile page.
    bio: {
      type: String,
      trim: true,
      maxlength: 280,
    },
    // Custom status line (e.g. "Busy", "In a meeting") shown under the name.
    status: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    // Avatar border customization, broadcast to friends in the sidebar. One of
    // the AVATAR_STYLE_IDS values (see users.validation.js), or null for the
    // default border. Stored as an id so rendering stays client-driven.
    avatarStyle: {
      type: String,
      default: null,
    },
    // Uploaded display picture (DP). A public Appwrite Storage view URL. Null
    // until the user uploads one; the initials avatar is the fallback.
    avatarUrl: {
      type: String,
      default: null,
    },
    // Profile cover banner (animated GIF URL chosen from the curated set). Null
    // when the user hasn't picked one; rendered behind the avatar on profiles.
    banner: {
      type: String,
      default: null,
    },
    // Appwrite file id backing avatarUrl. Server-only (never sent to clients)
    // so the previous file can be deleted on re-upload.
    avatarFileId: {
      type: String,
      default: null,
      select: false,
    },
    // Never returned by default queries (select: false) and never logged.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      default: "user",
    },
    blockedUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
      index: true,
    },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (candidatePlain) {
  return bcrypt.compare(candidatePlain, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 12);
};

// Indexes for search lookups.
userSchema.index({ username: 1 });
userSchema.index({ displayName: 1 });

export const Role = Object.freeze({ USER: "user", ADMIN: "admin" });
export const User = mongoose.model("User", userSchema);
export default User;
