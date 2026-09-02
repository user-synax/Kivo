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
    // ISO 3166-1 alpha-2 country code (e.g. "US", "IN"). Optional;
    // displayed as a flag on the public profile next to the @handle.
    country: {
      type: String,
      default: null,
      maxlength: 2,
    },
    // GitHub username for displaying the contribution graph on the public
    // profile. Optional; a plain string, no OAuth required.
    githubUsername: {
      type: String,
      default: null,
      trim: true,
      maxlength: 39,
    },
    // Whether the account has been verified (admin-set or auto-verified).
    verified: {
      type: Boolean,
      default: false,
    },
    // Whether to display the verified badge on the public profile.
    // Defaults to true for verified users so the badge is visible immediately.
    showBadge: {
      type: Boolean,
      default: true,
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
    lastActiveAt: {
      type: Date,
      default: null,
    },
    // Email verification
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, default: null, select: false },
    emailVerificationExpires: { type: Date, default: null, select: false },

    // Password reset
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },

    // Admin ban fields — the user document is preserved (not deleted) so the
    // email stays locked and re-registration is impossible.
    isBanned: { type: Boolean, default: false, index: true },
    bannedAt: { type: Date, default: null },
    bannedReason: { type: String, default: null, maxlength: 500 },

    notificationPreferences: {
      directMessages: { type: Boolean, default: true },
      groupMessages: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      friendRequests: { type: Boolean, default: true },
      spaceMessages: { type: Boolean, default: false },
      announcements: { type: Boolean, default: true },
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
