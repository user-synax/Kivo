import { unauthorized, notFound, conflict, badRequest, forbidden } from "../../utils/errors.js";
import mongoose from "mongoose";
import User from "../../models/User.js";
import FriendRequest from "../../models/FriendRequest.js";
import Conversation from "../../models/Conversation.js";
import { uploadAvatar, getStorageSafe } from "../../lib/appwrite.js";
import env from "../../config/env.js";
import { getEffectivePlan } from "../../lib/plus.js";
import { emitToUser } from "../../socket/io.js";
import { getIO } from "../../socket/index.js";

export function isStatusExpired(user) {
  if (!user?.statusExpiresAt) return false;
  const exp = new Date(user.statusExpiresAt).getTime();
  return Number.isFinite(exp) && exp <= Date.now();
}

export async function clearExpiredStatuses() {
  const now = new Date();
  const res = await User.updateMany(
    { statusExpiresAt: { $lte: now } },
    { $set: { status: null, statusEmoji: null, statusExpiresAt: null } }
  );
  return res.modifiedCount || 0;
}

export async function completeOnboarding({ userId }) {
  const user = await User.findByIdAndUpdate(
    userId,
    { onboardingCompletedAt: new Date() },
    { new: true }
  ).select("onboardingCompletedAt");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  return { onboardingCompletedAt: user.onboardingCompletedAt ? new Date(user.onboardingCompletedAt).toISOString() : null, onboardingCompleted: true };
}

// Public user shape returned in search/friend results and other-user views.
// Never includes email — see selfUser() for the own-profile shape.
function publicUser(user) {
  const u = user.toObject ? user.toObject() : user;
  // Clear expired status in-memory (DB sweep is hourly; this keeps reads fresh)
  const expired = isStatusExpired(u);
  const io = getIO();
  const online = io?.isUserOnline ? io.isUserOnline(u._id.toString()) : false;
  const isPlus = getEffectivePlan(u) === "plus";
  return {
    id: u._id.toString(),
    displayName: u.displayName || null,
    username: u.username || null,
    bio: u.bio || null,
    pronouns: u.pronouns || null,
    status: expired ? null : (u.status || null),
    statusEmoji: expired ? null : (u.statusEmoji || null),
    statusExpiresAt: expired ? null : (u.statusExpiresAt ? new Date(u.statusExpiresAt).toISOString() : null),
    avatarStyle: u.avatarStyle || null,
    avatarUrl: u.avatarUrl || null,
    banner: u.banner || null,
    country: u.country || null,
    githubUsername: u.githubUsername || null,
    xUsername: u.xUsername || null,
    instagramUsername: u.instagramUsername || null,
    youtubeUrl: u.youtubeUrl || null,
    websiteUrl: u.websiteUrl || null,
    verified: Boolean(u.verified),
    showBadge: Boolean(u.showBadge),
    // OAuth provider verification badges (Google / GitHub chips).
    googleVerified: Boolean(u.googleVerified),
    githubVerified: Boolean(u.githubVerified),
    // Plus profile effect ("none" | "glow" | "gradient-name" | "aura") —
    // public so any visitor renders the user's chosen effect on their profile.
    profileEffect: u.profileEffect || "none",
    // Plus username color for chat name pills — hex or null. Free users never
    // expose a color (server clamps to null).
    usernameColor: isPlus ? u.usernameColor || null : null,
    isPlus,
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
    lastActiveAt: u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : null,
    online,
  };
}

// Flat appearance shape echoed to clients (colors + chat look). Every field is
// null when unset so the client can fall back to its own defaults.
function flatAppearance(a = {}) {
  return {
    accent: a.accent || null,
    tint: a.tint || null,
    wallpaper: a.wallpaper || null,
    bubbleStyle: a.bubbleStyle || null,
  };
}

// Layer an appearance update onto the existing values: absent keys are kept
// (partial updates never wipe sibling fields), null clears, provided values
// replace.
function mergeAppearance(existing = {}, incoming = {}) {
  return {
    accent:
      incoming.accent !== undefined
        ? incoming.accent
        : existing.accent ?? null,
    tint:
      incoming.tint !== undefined ? incoming.tint : existing.tint ?? null,
    wallpaper:
      incoming.wallpaper !== undefined
        ? incoming.wallpaper
        : existing.wallpaper ?? null,
    bubbleStyle:
      incoming.bubbleStyle !== undefined
        ? incoming.bubbleStyle
        : existing.bubbleStyle ?? null,
  };
}

// Self profile shape — everything from publicUser plus the user's own
// appearance customization and tier. Appearance/plan are deliberately NOT
// included in publicUser, so other people's search results / profiles never
// carry them.
function selfUser(user) {
  const base = publicUser(user);
  const u = user.toObject ? user.toObject() : user;
  const expired = isStatusExpired(u);
  return {
    ...base,
    email: u.email || null,
    pronouns: u.pronouns || null,
    status: expired ? null : (u.status || null),
    statusEmoji: expired ? null : (u.statusEmoji || null),
    statusExpiresAt: expired ? null : (u.statusExpiresAt ? new Date(u.statusExpiresAt).toISOString() : null),
    plan: getEffectivePlan(u),
    planExpiresAt: u.planExpiresAt
      ? new Date(u.planExpiresAt).toISOString()
      : null,
    // Lets the editor show a "custom upload" affordance and clean removal.
    bannerUploaded: Boolean(user.bannerFileId || u.bannerFileId),
    // Own linked provider emails (Settings shows which account is linked).
    googleEmail: u.googleEmail || null,
    githubEmail: u.githubEmail || null,
    appearance: flatAppearance(user.appearance),
    privacyPreferences: {
      discoverableByNearby: user.privacyPreferences?.discoverableByNearby ?? true,
      showOnline: user.privacyPreferences?.showOnline ?? true,
      showJoinedDate: user.privacyPreferences?.showJoinedDate ?? true,
      showSocialLinks: user.privacyPreferences?.showSocialLinks ?? true,
    },
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

  // Fetch requester blocked sets to filter
  const [me, blockers] = await Promise.all([
    User.findById(userId).select("blockedUsers").lean(),
    User.find({ blockedUsers: userId }).select("_id").lean(),
  ]);
  const myBlocked = new Set((me?.blockedUsers || []).map((id) => id.toString()));
  const blockedByOthers = new Set(blockers.map((u) => u._id.toString()));

  const users = await User.find({
    _id: { $ne: userId },
    isBanned: { $ne: true },
    $or: [{ username: regex }, { displayName: regex }],
  })
    .select("displayName username bio pronouns status statusEmoji statusExpiresAt avatarStyle avatarUrl banner country verified showBadge googleVerified githubVerified lastActiveAt usernameColor plan planExpiresAt privacyPreferences")
    .limit(20)
    .lean();

  const filtered = users.filter((u) => {
    const id = u._id.toString();
    return !myBlocked.has(id) && !blockedByOthers.has(id);
  });

  const withRel = await Promise.all(
    filtered.map(async (u) => ({
      ...publicUser(u),
      relationship: await relationship(userId, u._id.toString()),
    }))
  );
  return withRel;
}

// Helpers for nearby distance fuzzing (privacy — never expose exact meters)
function fuzzDistanceMeters(meters) {
  if (meters < 1000) {
    // round to nearest 50m, min 50m
    const rounded = Math.max(50, Math.round(meters / 50) * 50);
    return rounded;
  }
  // 1km+ -> 0.1km steps
  const km = Math.round((meters / 1000) * 10) / 10;
  return Math.round(km * 1000);
}
function formatDistance(meters) {
  const d = fuzzDistanceMeters(meters);
  if (d < 1000) return `${d} m away`;
  return `${(d / 1000).toFixed(1)} km away`;
}

// Update privacy toggles (discovery + profile visibility)
export async function updatePrivacy({ userId, ...prefs }) {
  const user = await User.findById(userId).select("privacyPreferences location locationUpdatedAt");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  const update = {};
  for (const k of ["discoverableByNearby", "showOnline", "showJoinedDate", "showSocialLinks"]) {
    if (prefs[k] !== undefined) update[`privacyPreferences.${k}`] = prefs[k];
  }
  if (Object.keys(update).length === 0) {
    return {
      discoverableByNearby: user.privacyPreferences?.discoverableByNearby ?? true,
      showOnline: user.privacyPreferences?.showOnline ?? true,
      showJoinedDate: user.privacyPreferences?.showJoinedDate ?? true,
      showSocialLinks: user.privacyPreferences?.showSocialLinks ?? true,
      locationUpdatedAt: user.locationUpdatedAt ? new Date(user.locationUpdatedAt).toISOString() : null,
      hasLocation: Boolean(user.location?.coordinates),
    };
  }
  const updated = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true }).select("privacyPreferences location locationUpdatedAt");
  if (!updated) throw notFound("User not found", "USER_NOT_FOUND");
  // If turning off nearby discovery, clear stored location for privacy
  if (prefs.discoverableByNearby === false && updated.location?.coordinates) {
    updated.location = undefined;
    updated.locationUpdatedAt = null;
    await updated.save();
  }
  return {
    discoverableByNearby: updated.privacyPreferences?.discoverableByNearby ?? true,
    showOnline: updated.privacyPreferences?.showOnline ?? true,
    showJoinedDate: updated.privacyPreferences?.showJoinedDate ?? true,
    showSocialLinks: updated.privacyPreferences?.showSocialLinks ?? true,
    locationUpdatedAt: updated.locationUpdatedAt ? new Date(updated.locationUpdatedAt).toISOString() : null,
    hasLocation: Boolean(updated.location?.coordinates),
  };
}

export async function updateLocation({ userId, lat, lng, accuracy }) {
  const user = await User.findById(userId).select("privacyPreferences");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  if (user.privacyPreferences?.discoverableByNearby === false) {
    throw forbidden("Nearby discovery is disabled — enable it in Settings to share location", "DISCOVERY_DISABLED");
  }
  if (accuracy != null && accuracy > 200) {
    throw badRequest("Location accuracy too low — please try again in an open area", "LOW_ACCURACY");
  }
  const updated = await User.findByIdAndUpdate(
    userId,
    {
      location: { type: "Point", coordinates: [lng, lat] },
      locationUpdatedAt: new Date(),
    },
    { new: true }
  ).select("location locationUpdatedAt privacyPreferences");
  return {
    hasLocation: true,
    locationUpdatedAt: updated.locationUpdatedAt ? new Date(updated.locationUpdatedAt).toISOString() : null,
    discoverableByNearby: updated.privacyPreferences?.discoverableByNearby ?? true,
  };
}

export async function clearLocation({ userId }) {
  const user = await User.findById(userId);
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  user.location = undefined;
  user.locationUpdatedAt = null;
  await user.save();
  return { hasLocation: false, locationUpdatedAt: null };
}

export async function getNearbyUsers({ userId, radius = 5000, limit = 20 }) {
  const me = await User.findById(userId).select("location blockedUsers privacyPreferences locationUpdatedAt");
  if (!me) throw notFound("User not found", "USER_NOT_FOUND");
  if (!me.location?.coordinates) {
    throw badRequest("Share your location first to see nearby people", "NO_LOCATION");
  }
  if (me.privacyPreferences?.discoverableByNearby === false) {
    throw forbidden("Nearby discovery is disabled", "DISCOVERY_DISABLED");
  }
  // Stale check: location older than 30 min requires refresh
  if (me.locationUpdatedAt && Date.now() - new Date(me.locationUpdatedAt).getTime() > 30 * 60 * 1000) {
    throw badRequest("Your location is stale — please refresh", "STALE_LOCATION");
  }
  const fifteenAgo = new Date(Date.now() - 15 * 60 * 1000);
  // Gather blocked sets both ways + friend/pending ids to exclude
  const [blockers, pendingEdges, acceptedEdges] = await Promise.all([
    User.find({ blockedUsers: userId }).select("_id").lean(),
    FriendRequest.find({ $or: [{ from: userId }, { to: userId }], status: { $in: ["pending", "declined"] } }).select("from to").lean(),
    FriendRequest.find({ $or: [{ from: userId }, { to: userId }], status: "accepted" }).select("from to").lean(),
  ]);
  const blockedByOthers = new Set(blockers.map((u) => u._id.toString()));
  const myBlocked = new Set((me.blockedUsers || []).map((id) => id.toString()));
  const excludeIds = new Set([userId.toString()]);
  for (const e of [...pendingEdges, ...acceptedEdges]) {
    excludeIds.add(e.from.toString());
    excludeIds.add(e.to.toString());
  }
  for (const id of myBlocked) excludeIds.add(id);
  for (const id of blockedByOthers) excludeIds.add(id);

  // Use $geoNear via aggregation for distance sorting
  const pipeline = [
    {
      $geoNear: {
        near: { type: "Point", coordinates: me.location.coordinates },
        distanceField: "dist",
        maxDistance: Number(radius),
        spherical: true,
        query: {
          _id: { $nin: Array.from(excludeIds).map((id) => new mongoose.Types.ObjectId(id)) },
          location: { $exists: true, $ne: null },
          locationUpdatedAt: { $gt: fifteenAgo },
          "privacyPreferences.discoverableByNearby": { $ne: false },
          isBanned: { $ne: true },
        },
      },
    },
    { $limit: Number(limit) },
    {
      $project: {
        displayName: 1,
        username: 1,
        bio: 1,
        status: 1,
        statusEmoji: 1,
        avatarStyle: 1,
        avatarUrl: 1,
        banner: 1,
        country: 1,
        verified: 1,
        showBadge: 1,
        googleVerified: 1,
        githubVerified: 1,
        profileEffect: 1,
        usernameColor: 1,
        plan: 1,
        planExpiresAt: 1,
        createdAt: 1,
        lastActiveAt: 1,
        dist: 1,
      },
    },
  ];
  const results = await User.aggregate(pipeline);
  // Fallback if geo index missing or no results but allow empty
  return results.map((u) => {
    const base = publicUser({ ...u, _id: u._id });
    const raw = Math.round(u.dist || 0);
    const fuzzed = fuzzDistanceMeters(raw);
    return {
      ...base,
      distanceMeters: fuzzed,
      distanceLabel: formatDistance(raw),
      rawDistance: raw,
    };
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);
}

// Return the current user's own profile (self view).
export async function getMe({ userId }) {
  const user = await User.findById(userId).select(
    "displayName username email bio pronouns status statusEmoji statusExpiresAt avatarStyle avatarUrl banner country githubUsername xUsername instagramUsername youtubeUrl websiteUrl verified showBadge googleVerified githubVerified googleEmail githubEmail role plan planExpiresAt profileEffect usernameColor appearance bannerFileId createdAt lastActiveAt privacyPreferences location locationUpdatedAt onboardingCompletedAt",
  );
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  const base = selfUser(user);
  return {
    ...base,
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    onboardingCompletedAt: user.onboardingCompletedAt ? new Date(user.onboardingCompletedAt).toISOString() : null,
    privacyPreferences: {
      discoverableByNearby: user.privacyPreferences?.discoverableByNearby ?? true,
      showOnline: user.privacyPreferences?.showOnline ?? true,
      showJoinedDate: user.privacyPreferences?.showJoinedDate ?? true,
      showSocialLinks: user.privacyPreferences?.showSocialLinks ?? true,
    },
    location: user.location?.coordinates ? { hasLocation: true, updatedAt: user.locationUpdatedAt ? new Date(user.locationUpdatedAt).toISOString() : null } : { hasLocation: false, updatedAt: null },
  };
}

// Public profile of any user by id — used by the conversation detail panel.
export async function getUserById({ otherId }) {
  if (!mongoose.Types.ObjectId.isValid(otherId)) {
    throw badRequest("Invalid user id", "INVALID_ID");
  }
  const user = await User.findById(otherId).select(
    "displayName username bio pronouns status statusEmoji statusExpiresAt avatarStyle avatarUrl banner country githubUsername xUsername instagramUsername youtubeUrl websiteUrl verified showBadge googleVerified githubVerified role profileEffect usernameColor plan planExpiresAt createdAt lastActiveAt privacyPreferences",
  );
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  return publicUser(user);
}

// Public-safe profile shape for GET /users/:username/profile.
// Explicitly omits email, role, avatarFileId, passwordHash.
function publicProfile(user) {
  const u = user.toObject ? user.toObject() : user;
  const expired = isStatusExpired(u);
  const io = getIO();
  const online = io?.isUserOnline ? io.isUserOnline(u._id.toString()) : false;
  const isPlus = getEffectivePlan(u) === "plus";
  const showOnline = u.privacyPreferences?.showOnline !== false;
  const showJoined = u.privacyPreferences?.showJoinedDate !== false;
  const showSocial = u.privacyPreferences?.showSocialLinks !== false;
  return {
    id: u._id.toString(),
    username: u.username || null,
    displayName: u.displayName || null,
    pronouns: u.pronouns || null,
    avatarUrl: u.avatarUrl || null,
    avatarStyle: u.avatarStyle || null,
    banner: u.banner || null,
    country: u.country || null,
    githubUsername: showSocial ? (u.githubUsername || null) : null,
    xUsername: showSocial ? (u.xUsername || null) : null,
    instagramUsername: showSocial ? (u.instagramUsername || null) : null,
    youtubeUrl: showSocial ? (u.youtubeUrl || null) : null,
    websiteUrl: showSocial ? (u.websiteUrl || null) : null,
    verified: Boolean(u.verified),
    showBadge: Boolean(u.showBadge),
    googleVerified: Boolean(u.googleVerified),
    githubVerified: Boolean(u.githubVerified),
    profileEffect: u.profileEffect || "none",
    usernameColor: isPlus ? u.usernameColor || null : null,
    isPlus,
    // The owner's colors/look — public so their /u/username page can render
    // in *their* theme (accent + canvas tint). Colors only; never plan/tier.
    appearance: flatAppearance(u.appearance),
    bio: u.bio || null,
    status: expired ? null : (u.status || null),
    statusEmoji: expired ? null : (u.statusEmoji || null),
    statusExpiresAt: expired ? null : (u.statusExpiresAt ? new Date(u.statusExpiresAt).toISOString() : null),
    joinedAt: showJoined && u.createdAt ? new Date(u.createdAt).toISOString() : null,
    lastActiveAt: showOnline && u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : null,
    online: showOnline ? online : false,
  };
}

export async function getProfileByUsername({ requesterId, username }) {
  const user = await User.findOne({ username }).select(
    "displayName username bio pronouns status statusEmoji statusExpiresAt avatarStyle avatarUrl banner appearance country githubUsername xUsername instagramUsername youtubeUrl websiteUrl verified showBadge googleVerified githubVerified profileEffect usernameColor plan planExpiresAt createdAt blockedUsers lastActiveAt privacyPreferences",
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
  return selfUser(user);
}

// Upload a custom profile banner (Kivo Plus perk). Stored in the avatar
// bucket like display pictures; switching away later (curated/none) retires
// the file through the updateMe banner branch.
export async function updateBanner({ userId, buffer, contentType }) {
  const user = await User.findById(userId).select("email plan planExpiresAt banner bannerFileId");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  if (getEffectivePlan(user) !== "plus") {
    throw forbidden(
      "Custom banners are a Kivo Plus perk",
      "PLUS_REQUIRED",
    );
  }
  const { fileId, url } = await uploadAvatar(
    buffer,
    contentType,
    user.bannerFileId || null,
  );
  user.banner = url;
  user.bannerFileId = fileId;
  await user.save();
  return selfUser(user);
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
  return selfUser(user);
}

// --- Block / Unblock helpers ---

async function emitBlockSync({ blockerId, blockedId }) {
  const dms = await Conversation.find({ type: "dm", participants: { $all: [blockerId, blockedId] } })
    .populate("participants", "id displayName username avatarStyle avatarUrl usernameColor plan planExpiresAt")
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
  const isPlus = populated
    ? getEffectivePlan(p) === "plus"
    : false;
  return {
    id,
    displayName: populated ? (p.displayName ?? null) : null,
    username: populated ? (p.username ?? null) : null,
    avatarStyle: populated ? (p.avatarStyle ?? null) : null,
    avatarUrl: populated ? (p.avatarUrl ?? null) : null,
    usernameColor: populated && isPlus ? p.usernameColor || null : null,
    isPlus: populated ? isPlus : false,
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
  const user = await User.findById(userId).populate("blockedUsers", "displayName username email avatarStyle avatarUrl usernameColor plan planExpiresAt").lean();
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  return (user.blockedUsers || []).map((u) => {
    const isPlus = getEffectivePlan(u) === "plus";
    return {
      id: u._id.toString(),
      displayName: u.displayName || null,
      username: u.username || null,
      email: u.email,
      avatarStyle: u.avatarStyle || null,
      avatarUrl: u.avatarUrl || null,
      usernameColor: isPlus ? u.usernameColor || null : null,
      isPlus,
    };
  });
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

  // Mid-call block: actively eject the blocked user from shared DM call rooms
  // instead of waiting for their LiveKit token to expire.
  try {
    const dms = await Conversation.find({ type: "dm", participants: { $all: [userId, targetId] } })
      .select("_id")
      .lean();
    if (dms.length) {
      const calls = await import("../calls/calls.service.js");
      await Promise.all(
        dms.map((d) =>
          calls.ejectParticipantFromRoom({ conversationId: d._id.toString(), userId: targetId }).catch(() => {}),
        ),
      );
    }
  } catch {}

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
  if (data.statusEmoji !== undefined) {
    update.statusEmoji = data.statusEmoji ? String(data.statusEmoji).trim() : null;
  }
  if (data.avatarStyle !== undefined) {
    update.avatarStyle = data.avatarStyle || null;
  }
  if (data.banner !== undefined) {
    const nextBanner = data.banner || null;
    update.banner = nextBanner;
    // Switching from an uploaded (Plus) banner to a curated one (or none)
    // retires the Appwrite file so storage doesn't leak. Only when the value
    // actually changes — re-saving the same banner keeps its file.
    const current = await User.findById(userId).select("banner bannerFileId").lean();
    const oldFile = current?.bannerFileId ? String(current.bannerFileId) : null;
    if (oldFile && (current?.banner ?? null) !== nextBanner) {
      update.bannerFileId = null;
      try {
        const store = getStorageSafe();
        if (store) await store.deleteFile(env.appwriteBucketId, oldFile);
      } catch {
        // Non-fatal — the DB record is what matters for the client.
      }
    }
  }
  if (data.profileEffect !== undefined) {
    // Plus-only field; a free/expired user trying to set it is downgraded to none.
    const me = await User.findById(userId).select("plan planExpiresAt").lean();
    update.profileEffect =
      getEffectivePlan(me) === "plus" ? data.profileEffect || "none" : "none";
  }
  if (data.usernameColor !== undefined) {
    const raw = data.usernameColor ? String(data.usernameColor).trim() : "";
    const me = await User.findById(userId).select("plan planExpiresAt").lean();
    if (getEffectivePlan(me) !== "plus") {
      update.usernameColor = null;
    } else {
      update.usernameColor = raw ? raw : null;
    }
  }
  if (data.country !== undefined) {
    update.country = data.country || null;
  }
  if (data.githubUsername !== undefined) {
    update.githubUsername = data.githubUsername || null;
  }
  if (data.showBadge !== undefined) {
    update.showBadge = Boolean(data.showBadge);
  }
  if (data.appearance !== undefined) {
    // Merge onto the current appearance: absent keys are kept, explicit null
    // clears (so "reset colors" doesn't wipe the chat look and vice versa).
    const currentUser = await User.findById(userId).select("appearance").lean();
    update.appearance = mergeAppearance(currentUser?.appearance, data.appearance);
  }

  // Social links — each is nullable so an empty string clears the field.
  for (const key of [
    "xUsername",
    "instagramUsername",
    "youtubeUrl",
    "websiteUrl",
  ]) {
    if (data[key] !== undefined) {
      update[key] = data[key] ? String(data[key]).trim() : null;
    }
  }
  if (data.pronouns !== undefined) {
    update.pronouns = data.pronouns ? String(data.pronouns).trim() : null;
  }
  if (data.statusExpiresAt !== undefined) {
    // Empty/null = clear; otherwise future ISO (validated)
    if (!data.statusExpiresAt) update.statusExpiresAt = null;
    else update.statusExpiresAt = new Date(data.statusExpiresAt);
  }
  // When status is cleared but expiry remains, clear expiry too
  if (data.status === "" && data.statusEmoji === "") {
    update.statusExpiresAt = null;
  }

  const user = await User.findByIdAndUpdate(userId, update, {
    new: true,
    runValidators: true,
  }).select(
    "displayName username email bio pronouns status statusEmoji statusExpiresAt avatarStyle banner country githubUsername xUsername instagramUsername youtubeUrl websiteUrl verified showBadge googleVerified githubVerified googleEmail githubEmail role plan planExpiresAt profileEffect usernameColor appearance bannerFileId createdAt lastActiveAt privacyPreferences",
  );
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  return selfUser(user);
}
