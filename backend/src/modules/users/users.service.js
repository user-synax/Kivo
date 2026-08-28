import { unauthorized, notFound, conflict, badRequest } from "../../utils/errors.js";
import mongoose from "mongoose";
import User from "../../models/User.js";
import FriendRequest from "../../models/FriendRequest.js";

// Public user shape returned in search/friend results and self profile.
function publicUser(user) {
  const u = user.toObject ? user.toObject() : user;
  return {
    id: u._id.toString(),
    displayName: u.displayName || null,
    username: u.username || null,
    email: u.email,
    bio: u.bio || null,
    status: u.status || null,
    avatarStyle: u.avatarStyle || null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
  };
}

// Relationship of `userId` -> `otherId` for UI hints: friends / outgoing request
// / incoming request / none.
async function relationship(userId, otherId) {
  const req = await FriendRequest.findOne({
    $or: [
      { from: userId, to: otherId },
      { from: otherId, to: userId },
    ],
  });
  if (!req) return "none";
  if (req.status === "accepted") return "friends";
  if (req.from.toString() === userId) return "outgoing";
  return "incoming";
}

export async function searchUsers({ userId, q }) {
  if (!q || q.trim().length === 0) return [];
  const trimmed = q.trim();
  const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const users = await User.find({
    _id: { $ne: userId },
    $or: [{ username: regex }, { email: regex }, { displayName: regex }],
  })
    .select("displayName username email")
    .limit(20)
    .lean();

  const withRel = await Promise.all(
    users.map(async (u) => ({
      ...publicUser(u),
      relationship: await relationship(userId, u._id.toString()),
    }))
  );
  return withRel;
}

// Return the current user's own profile (self view).
export async function getMe({ userId }) {
  const user = await User.findById(userId).select(
    "displayName username email bio status avatarStyle role createdAt",
  );
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  return publicUser(user);
}

// Public profile of any user by id — used by the conversation detail panel.
export async function getUserById({ otherId }) {
  if (!mongoose.Types.ObjectId.isValid(otherId)) {
    throw badRequest("Invalid user id", "INVALID_ID");
  }
  const user = await User.findById(otherId).select(
    "displayName username email bio status avatarStyle role createdAt",
  );
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  return publicUser(user);
}

// Partial self-profile update. Validates username uniqueness when changed and
// only writes keys that were actually provided.
export async function updateMe({ userId, data }) {
  const update = {};
  if (data.displayName !== undefined) {
    update.displayName = data.displayName || undefined;
  }
  if (data.username !== undefined) {
    const uname = data.username || undefined;
    if (uname) {
      const taken = await User.findOne({
        username: uname,
        _id: { $ne: userId },
      });
      if (taken) throw conflict("Username already taken", "USERNAME_TAKEN");
    }
    update.username = uname;
  }
  if (data.bio !== undefined) update.bio = data.bio;
  if (data.status !== undefined) update.status = data.status;
  if (data.avatarStyle !== undefined) {
    update.avatarStyle = data.avatarStyle || null;
  }

  const user = await User.findByIdAndUpdate(userId, update, {
    new: true,
    runValidators: true,
  }).select("displayName username email bio status avatarStyle role createdAt");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  return publicUser(user);
}
