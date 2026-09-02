import { unauthorized, notFound, conflict, badRequest, forbidden } from "../../utils/errors.js";
import mongoose from "mongoose";
import User from "../../models/User.js";
import FriendRequest from "../../models/FriendRequest.js";
import Conversation from "../../models/Conversation.js";
import { uploadAvatar, getStorageSafe } from "../../lib/appwrite.js";
import env from "../../config/env.js";
import { emitToUser } from "../../socket/io.js";
import { getIO } from "../../socket/index.js";

// Public user shape returned in search/friend results and self profile.
function publicUser(user) {
  const u = user.toObject ? user.toObject() : user;
  const io = getIO();
  const online = io?.isUserOnline ? io.isUserOnline(u._id.toString()) : false;
  return {
    id: u._id.toString(),
    displayName: u.displayName || null,
    username: u.username || null,
    email: u.email,
    bio: u.bio || null,
    status: u.status || null,
    avatarStyle: u.avatarStyle || null,
    avatarUrl: u.avatarUrl || null,
    banner: u.banner || null,
    country: u.country || null,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : null,
    online,
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
    .select("displayName username email lastActiveAt")
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
    "displayName username email bio status avatarStyle avatarUrl banner country role createdAt lastActiveAt",
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
    "displayName username email bio status avatarStyle avatarUrl banner country role createdAt lastActiveAt",
  );
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  return publicUser(user);
}

// Public-safe profile shape for GET /users/:username/profile.
// Explicitly omits email, role, avatarFileId, passwordHash.
function publicProfile(user) {
  const u = user.toObject ? user.toObject() : user;
  const io = getIO();
  const online = io?.isUserOnline ? io.isUserOnline(u._id.toString()) : false;
  return {
    id: u._id.toString(),
    username: u.username || null,
    displayName: u.displayName || null,
    avatarUrl: u.avatarUrl || null,
    avatarStyle: u.avatarStyle || null,
    banner: u.banner || null,
    country: u.country || null,
    bio: u.bio || null,
    status: u.status || null,
    joinedAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : null,
    online,
  };
}

export async function getProfileByUsername({ requesterId, username }) {
  const user = await User.findOne({ username }).select(
    "displayName username bio status avatarStyle avatarUrl banner country createdAt blockedUsers lastActiveAt",
  );
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");

  const targetId = user._id.toString();
  const isSelf = requesterId && requesterId.toString() === targetId;

  let isBlockedByMe = false;
  let isBlockedByOther = false;
  let rel = "none";

  if (requesterId && !isSelf) {
    const [requester, targetBlocked] = await Promise.all([
      User.findById(requesterId).select("blockedUsers").lean(),
      // user already has blockedUsers; no extra fetch needed for target side
      Promise.resolve(user),
    ]);
    const requesterBlocked = new Set((requester?.blockedUsers || []).map((id) => id.toString()));
    const targetBlockedSet = new Set((targetBlocked?.blockedUsers || []).map((id) => id.toString()));
    isBlockedByMe = requesterBlocked.has(targetId);
    isBlockedByOther = targetBlockedSet.has(requesterId.toString());
    rel = await relationship(requesterId.toString(), targetId);
  } else if (isSelf) {
    rel = "self";
  }

  return {
    ...publicProfile(user),
    relationship: rel,
    isBlockedByMe,
    isBlockedByOther,
  };
}

// Persist an uploaded display picture. The buffer comes from multer; we push it
// to Appwrite Storage, retire the previous file, and store the resulting public
// URL (and its file id) on the user.
export async function updateAvatar({ userId, buffer, contentType }) {
  const user = await User.findById(userId);
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  const { fileId, url } = await uploadAvatar(
    buffer,
    contentType,
    user.avatarFileId || null,
  );
  user.avatarUrl = url;
  user.avatarFileId = fileId;
  await user.save();
  return publicUser(user);
}

// Remove the uploaded display picture and (best-effort) its Appwrite file.
export async function deleteAvatar({ userId }) {
  const user = await User.findById(userId);
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  if (user.avatarFileId) {
    try {
      const store = getStorageSafe();
      if (store) await store.deleteFile(env.appwriteBucketId, user.avatarFileId);
    } catch {
      // Non-fatal — the DB record is what matters for the client.
    }
  }
  user.avatarUrl = null;
  user.avatarFileId = null;
  await user.save();
  return publicUser(user);
}

// --- Block / Unblock helpers ---

async function emitBlockSync({ blockerId, blockedId }) {
  const dms = await Conversation.find({ type: "dm", participants: { $all: [blockerId, blockedId] } })
    .populate("participants", "id displayName username email avatarStyle avatarUrl")
    .lean();
  if (dms.length === 0) return;
  // Fetch fresh blockedUsers for both to compute flags
  const [blocker, blocked] = await Promise.all([
    User.findById(blockerId).select("blockedUsers").lean(),
    User.findById(blockedId).select("blockedUsers").lean(),
  ]);
  const blockerSet = new Set((blocker?.blockedUsers || []).map((id) => id.toString()));
  const blockedSet = new Set((blocked?.blockedUsers || []).map((id) => id.toString()));

  const blockerHasBlocked = blockerSet.has(blockedId.toString());
  const blockedHasBlocked = blockedSet.has(blockerId.toString());

  for (const dm of dms) {
    // Build two viewer-specific payloads
    const baseForBlocker = buildPublicConversationForEmit(dm, blockerId.toString(), blockerHasBlocked, blockedHasBlocked);
    const baseForBlocked = buildPublicConversationForEmit(dm, blockedId.toString(), blockedHasBlocked, blockerHasBlocked);
    emitToUser(blockerId.toString(), "conversation:updated", { conversation: baseForBlocker });
    emitToUser(blockedId.toString(), "conversation:updated", { conversation: baseForBlocked });
  }
}

function normalizeParticipantForBlock(p) {
  const id = typeof p === "string" ? p : p?._id?.toString?.() || p?.toString?.();
  const populated = p && typeof p === "object" && (p.displayName !== undefined || p.username !== undefined);
  return {
    id,
    displayName: populated ? (p.displayName ?? null) : null,
    username: populated ? (p.username ?? null) : null,
    email: populated ? (p.email ?? null) : null,
    avatarStyle: populated ? (p.avatarStyle ?? null) : null,
    avatarUrl: populated ? (p.avatarUrl ?? null) : null,
  };
}
function toIdForBlock(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v._id) return v._id.toString();
  if (v.id) return v.id.toString();
  return v.toString();
}
function buildPublicConversationForEmit(conversation, viewerId, viewerHasBlockedOther, otherHasBlockedViewer) {
  const participants = (conversation.participants || []).map(normalizeParticipantForBlock);
  const otherParticipantIds = participants.map((p) => p.id).filter((id) => id !== viewerId);
  const admins = (conversation.admins || []).map(toIdForBlock).filter(Boolean);
  const io = getIO();
  const onlineLookup = io?.isUserOnline ? (id) => io.isUserOnline(id) : null;
  return {
    id: conversation._id.toString(),
    type: conversation.type,
    name: conversation.type === "group" || conversation.type === "space_channel" ? (conversation.name || null) : null,
    participants,
    otherParticipantIds,
    admins,
    createdBy: conversation.createdBy ? toIdForBlock(conversation.createdBy) : null,
    isAdmin: conversation.type === "group" ? admins.includes(viewerId) : false,
    avatarUrl: conversation.avatarUrl || null,
    lastMessageAt: conversation.lastMessageAt || null,
    createdAt: conversation.createdAt,
    spaceId: conversation.spaceId ? conversation.spaceId.toString() : null,
    channelId: conversation.channelId ? conversation.channelId.toString() : null,
    online: onlineLookup ? otherParticipantIds.map((id) => Boolean(onlineLookup(id))) : undefined,
    isBlockedByMe: conversation.type === "dm" ? Boolean(viewerHasBlockedOther) : false,
    isBlockedByOther: conversation.type === "dm" ? Boolean(otherHasBlockedViewer) : false,
  };
}

export async function listBlockedUsers({ userId }) {
  const user = await User.findById(userId).populate("blockedUsers", "displayName username email avatarStyle avatarUrl").lean();
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  return (user.blockedUsers || []).map((u) => ({
    id: u._id.toString(),
    displayName: u.displayName || null,
    username: u.username || null,
    email: u.email,
    avatarStyle: u.avatarStyle || null,
    avatarUrl: u.avatarUrl || null,
  }));
}

export async function blockUser({ userId, targetId }) {
  if (!mongoose.Types.ObjectId.isValid(targetId)) throw badRequest("Invalid user id", "INVALID_ID");
  if (userId.toString() === targetId.toString()) throw badRequest("You cannot block yourself", "SELF_BLOCK");

  const target = await User.findById(targetId).select("_id");
  if (!target) throw notFound("User not found", "USER_NOT_FOUND");

  const requester = await User.findById(userId).select("blockedUsers");
  if (!requester) throw notFound("User not found", "USER_NOT_FOUND");
  const already = (requester.blockedUsers || []).some((id) => id.toString() === targetId.toString());
  if (already) throw conflict("User already blocked", "ALREADY_BLOCKED");

  await User.findByIdAndUpdate(userId, { $addToSet: { blockedUsers: targetId } });

  // End friendship if exists (accepted edge) and remove any pending requests either direction
  await FriendRequest.deleteMany({
    $or: [
      { from: userId, to: targetId },
      { from: targetId, to: userId },
    ],
  });

  await emitBlockSync({ blockerId: userId, blockedId: targetId });

  return { blocked: true };
}

export async function unblockUser({ userId, targetId }) {
  if (!mongoose.Types.ObjectId.isValid(targetId)) throw badRequest("Invalid user id", "INVALID_ID");
  if (userId.toString() === targetId.toString()) throw badRequest("You cannot unblock yourself", "SELF_BLOCK");

  const target = await User.findById(targetId).select("_id");
  if (!target) throw notFound("User not found", "USER_NOT_FOUND");

  await User.findByIdAndUpdate(userId, { $pull: { blockedUsers: targetId } });

  await emitBlockSync({ blockerId: userId, blockedId: targetId });

  return { blocked: false };
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
  if (data.banner !== undefined) {
    update.banner = data.banner || null;
  }
  if (data.country !== undefined) {
    update.country = data.country || null;
  }

  const user = await User.findByIdAndUpdate(userId, update, {
    new: true,
    runValidators: true,
  }).select("displayName username email bio status avatarStyle banner country role createdAt");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  return publicUser(user);
}
