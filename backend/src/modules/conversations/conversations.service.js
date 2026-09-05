import mongoose from "mongoose";
import { notFound, badRequest, forbidden } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import { uploadAvatar } from "../../lib/appwrite.js";
import { publicMessage } from "../messages/messages.service.js";
import { getIO } from "../../socket/index.js";
import {
  emitToConversation,
  joinUserToRoom,
  leaveUserFromRoom,
  emitToUser,
} from "../../socket/io.js";

// Public representation of a conversation for the current user. Strips internal
// fields and leaves participants populated enough for the client to render a DM
// title (the "other" participant) or a group name + member list.
// Normalize a participant into the { id, displayName, username, email } shape
// the client expects for rendering a DM title or a group member row. Handles
// both bare ObjectId strings (not yet populated) and fully populated documents.
function normalizeParticipant(p) {
  const id =
    typeof p === "string" ? p : p?._id?.toString?.() || p?.toString?.();
  const populated =
    p && typeof p === "object" && (p.displayName !== undefined || p.username !== undefined);
  return {
    id,
    displayName: populated ? (p.displayName ?? null) : null,
    username: populated ? (p.username ?? null) : null,
    email: populated ? (p.email ?? null) : null,
    avatarStyle: populated ? (p.avatarStyle ?? null) : null,
    avatarUrl: populated ? (p.avatarUrl ?? null) : null,
    lastActiveAt: populated && p.lastActiveAt ? new Date(p.lastActiveAt).toISOString() : null,
  };
}

// Stringify an id that may be a populated doc ({ _id } / { id }) or a bare
// ObjectId, so the serializer works whether or not the field was `.populate`d.
function toId(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v._id) return v._id.toString();
  if (v.id) return v.id.toString();
  return v.toString();
}

function publicConversation(conversation, userId, onlineLookup, blockFlags) {
  const participants = (conversation.participants || []).map(normalizeParticipant);
  const otherParticipantIds = participants
    .map((p) => p.id)
    .filter((id) => id !== userId);

  const admins = (conversation.admins || []).map(toId).filter(Boolean);

  const isDm = conversation.type === "dm";
  const isBlockedByMe = isDm ? Boolean(blockFlags?.isBlockedByMe) : false;
  const isBlockedByOther = isDm ? Boolean(blockFlags?.isBlockedByOther) : false;

  return {
    id: conversation._id.toString(),
    type: conversation.type,
    name: conversation.type === "group" || conversation.type === "space_channel" ? (conversation.name || null) : null,
    participants,
    otherParticipantIds,
    admins,
    createdBy: conversation.createdBy ? toId(conversation.createdBy) : null,
    isAdmin: conversation.type === "group" ? admins.includes(userId) : false,
    avatarUrl: conversation.avatarUrl || null,
    // Shared chat look for this DM/group (wallpaper + bubble style). Null per
    // field = fall back to each member's own look.
    appearance: {
      wallpaper: conversation.appearance?.wallpaper || null,
      bubbleStyle: conversation.appearance?.bubbleStyle || null,
    },
    lastMessageAt: conversation.lastMessageAt || null,
    createdAt: conversation.createdAt,
    spaceId: conversation.spaceId ? conversation.spaceId.toString() : null,
    channelId: conversation.channelId ? conversation.channelId.toString() : null,
    online: onlineLookup
      ? otherParticipantIds.map((id) => Boolean(onlineLookup(id)))
      : undefined,
    isBlockedByMe,
    isBlockedByOther,
  };
}

// Resolve which participant ids of a conversation are currently online.
function onlineSnapshot() {
  const io = getIO();
  if (!io || !io.isUserOnline) return null;
  return (id) => io.isUserOnline(id);
}

// Create a system/info message (centered chip on the client) and broadcast it to
// the conversation room. Used for member join/leave/admin events.
async function emitSystemMessage({ conversationId, senderId, content }) {
  const message = await Message.create({
    conversationId,
    senderId,
    content,
    type: "system",
  });
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessageAt: message.createdAt,
  });
  emitToConversation(conversationId, "message:new", publicMessage(message));
}

// Create a DM, or return the existing one if a thread already exists between the
// two users. Prevents duplicate DM threads via a $all lookup on participants.
export async function createOrGetDm({ userId, participantId }) {
  if (userId === participantId) {
    throw badRequest("Cannot start a conversation with yourself", "SELF_CONVERSATION");
  }
  if (!mongoose.Types.ObjectId.isValid(participantId)) {
    throw badRequest("Invalid participantId", "INVALID_PARTICIPANT");
  }

  const other = await User.findById(participantId).select("_id");
  if (!other) {
    throw notFound("User not found", "USER_NOT_FOUND");
  }

  const [me, them] = await Promise.all([
    User.findById(userId).select("blockedUsers").lean(),
    User.findById(participantId).select("blockedUsers").lean(),
  ]);
  const meBlocked = new Set((me?.blockedUsers || []).map((id) => id.toString()));
  const themBlocked = new Set((them?.blockedUsers || []).map((id) => id.toString()));
  const isBlockedByMe = meBlocked.has(participantId.toString());
  const isBlockedByOther = themBlocked.has(userId.toString());
  const blockFlags = { isBlockedByMe, isBlockedByOther };

  // Normalize participant order so the $all query is order-independent.
  const existing = await Conversation.findOne({
    type: "dm",
    participants: { $all: [userId, participantId] },
  }).populate("participants", "id displayName username email avatarStyle avatarUrl lastActiveAt");
  if (existing) {
    return publicConversation(existing, userId, onlineSnapshot(), blockFlags);
  }

  const created = await Conversation.create({
    type: "dm",
    participants: [userId, participantId],
  });
  await created.populate("participants", "id displayName username email avatarStyle avatarUrl lastActiveAt");

  // Join both users' live sockets to the room immediately.
  joinUserToRoom(userId, created._id.toString());
  joinUserToRoom(participantId, created._id.toString());

  return publicConversation(created, userId, onlineSnapshot(), blockFlags);
}

// Per-conversation unread counts for a user, computed in ONE aggregation.
// The conversation-list endpoint runs on every app load and socket reconnect,
// so the previous per-conversation countDocuments loop (an N+1 MongoDB
// round-trip pattern) made that hot path scale linearly with chat count.
// Filter semantics are identical to the old countDocuments query.
async function unreadCountsByConversation(conversationIds, userId) {
  if (!conversationIds || conversationIds.length === 0) return new Map();
  const uid = new mongoose.Types.ObjectId(userId);
  const rows = await Message.aggregate([
    {
      $match: {
        conversationId: { $in: conversationIds },
        senderId: { $ne: uid },
        type: { $ne: "system" },
        threadId: null, // thread replies never bump the main unread badge
        isDeleted: false,
        readBy: { $not: { $elemMatch: { userId: uid } } },
      },
    },
    { $group: { _id: "$conversationId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id.toString(), r.count]));
}

// List the current user's conversations, newest activity first. Includes a
// lightweight unread count (messages not authored by the user and not yet read).
export async function listConversations({ userId }) {
  const conversations = await Conversation.find({ participants: userId })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .populate("participants", "id displayName username email avatarStyle avatarUrl lastActiveAt")
    .populate("admins", "id")
    .lean();

  const lookup = onlineSnapshot();

  // Pre-fetch blockedUsers for DM flag computation
  const me = await User.findById(userId).select("blockedUsers").lean();
  const meBlocked = new Set((me?.blockedUsers || []).map((id) => id.toString()));
  const dmOtherIds = [
    ...new Set(
      conversations
        .filter((c) => c.type === "dm")
        .flatMap((c) => (c.participants || []).map((p) => (p._id || p).toString()).filter((id) => id !== userId.toString()))
    ),
  ];
  const otherUsers = dmOtherIds.length
    ? await User.find({ _id: { $in: dmOtherIds } }).select("blockedUsers").lean()
    : [];
  const otherBlockedMap = new Map(otherUsers.map((u) => [u._id.toString(), new Set((u.blockedUsers || []).map((id) => id.toString()))]));

  const unreadByConv = await unreadCountsByConversation(
    conversations.map((c) => c._id),
    userId,
  );

  const result = [];
  for (const c of conversations) {
    let blockFlags = null;
    if (c.type === "dm") {
      const otherId = (c.participants || [])
        .map((p) => (p._id || p).toString())
        .find((id) => id !== userId.toString());
      const isBlockedByMe = otherId ? meBlocked.has(otherId) : false;
      const isBlockedByOther = otherId ? (otherBlockedMap.get(otherId)?.has(userId.toString()) || false) : false;
      blockFlags = { isBlockedByMe, isBlockedByOther };
    }
    const base = publicConversation(c, userId, lookup, blockFlags);
    base.unreadCount = unreadByConv.get(c._id.toString()) || 0;
    result.push(base);
  }
  return result;
}

// Ensure the user is a participant of the conversation; throws otherwise.
async function assertMembership(conversationId, userId) {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  }
  const participantIds = conversation.participants.map((p) => p.toString());
  if (!participantIds.includes(userId)) {
    throw forbidden("You are not a participant of this conversation", "NOT_PARTICIPANT");
  }
  return conversation;
}

// Ensure the user is a group admin; throws otherwise. DMs have no admins.
function assertAdmin(conversation, userId) {
  if (conversation.type !== "group") {
    throw forbidden("This action is only available in group conversations", "NOT_GROUP");
  }
  const adminIds = (conversation.admins || []).map((id) => id.toString());
  if (!adminIds.includes(userId)) {
    throw forbidden("Only group admins can do this", "NOT_ADMIN");
  }
}

// Resolve a list of user ids to existing users, throwing on any unknown id.
async function resolveUsers(userIds) {
  const users = await User.find({ _id: { $in: userIds } }).select("_id").lean();
  const found = new Set(users.map((u) => u._id.toString()));
  const missing = userIds.filter((id) => !found.has(id));
  if (missing.length) {
    throw notFound("One or more users were not found", "USER_NOT_FOUND");
  }
  return found;
}

// Create a group conversation. The creator is auto-added as a participant and
// the sole admin. Requires at least 2 other participants (3 total).
export async function createGroup({ userId, name, participantIds, avatar }) {
  if (!Array.isArray(participantIds) || participantIds.length < 2) {
    throw badRequest("A group needs at least 2 other members", "TOO_FEW_MEMBERS");
  }
  const allIds = [...new Set([userId, ...participantIds])];
  if (allIds.length < 3) {
    throw badRequest("A group needs at least 2 other members", "TOO_FEW_MEMBERS");
  }
  for (const id of participantIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw badRequest("Invalid participant id", "INVALID_PARTICIPANT");
    }
  }
  await resolveUsers(participantIds);

  let avatarUrl = null;
  let avatarFileId = null;
  if (avatar && avatar.buffer) {
    const uploaded = await uploadAvatar(avatar.buffer, avatar.contentType, null);
    avatarUrl = uploaded.url;
    avatarFileId = uploaded.fileId;
  }

  const created = await Conversation.create({
    type: "group",
    name: name.trim(),
    participants: allIds,
    createdBy: userId,
    admins: [userId],
    avatarUrl,
    avatarFileId,
  });
  await created.populate("participants", "id displayName username email avatarStyle avatarUrl lastActiveAt");
  await created.populate("admins", "id");

  // Join every member's live sockets so they receive the new thread.
  for (const id of allIds) {
    joinUserToRoom(id, created._id.toString());
  }

  const payload = publicConversation(created, userId, onlineSnapshot());
  // Notify all members (including the creator) so the new group appears in their
  // conversation lists without a refresh.
  emitToConversation(created._id.toString(), "conversation:member-added", {
    conversation: payload,
    addedBy: userId,
  });
  return payload;
}

// Update a group's name and/or avatar. Admin only.
export async function updateGroup({ conversationId, userId, name, avatar }) {
  const conversation = await assertMembership(conversationId, userId);
  assertAdmin(conversation, userId);

  const update = {};
  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) throw badRequest("Group name cannot be empty", "INVALID_NAME");
    update.name = trimmed;
  }

  if (avatar && avatar.buffer) {
    const uploaded = await uploadAvatar(
      avatar.buffer,
      avatar.contentType,
      conversation.avatarFileId || null,
    );
    update.avatarUrl = uploaded.url;
    update.avatarFileId = uploaded.fileId;
  }

  if (Object.keys(update).length === 0) {
    throw badRequest("Nothing to update", "NO_UPDATE");
  }

  const updated = await Conversation.findByIdAndUpdate(conversationId, update, {
    new: true,
  })
    .populate("participants", "id displayName username email avatarStyle avatarUrl lastActiveAt")
    .populate("admins", "id")
    .lean();

  const payload = publicConversation(updated, userId, onlineSnapshot());
  emitToConversation(conversationId, "conversation:updated", { conversation: payload });
  return payload;
}

// Set a conversation's shared chat look (wallpaper + bubble style). Either DM
// participant may set it; group changes are admin-only. Space channels are
// rejected — their Space owns the look members see.
export async function updateConversationLook({ conversationId, userId, wallpaper, bubbleStyle }) {
  const conversation = await assertMembership(conversationId, userId);
  if (conversation.type === "space_channel") {
    throw badRequest("Space channels use their Space's look", "NOT_ALLOWED");
  }
  if (conversation.type === "group") {
    assertAdmin(conversation, userId);
  }

  // Partial merge: absent keys are kept, null clears a field back to inherit.
  const update = {
    appearance: {
      wallpaper:
        wallpaper !== undefined
          ? wallpaper
          : conversation.appearance?.wallpaper ?? null,
      bubbleStyle:
        bubbleStyle !== undefined
          ? bubbleStyle
          : conversation.appearance?.bubbleStyle ?? null,
    },
  };

  const updated = await Conversation.findByIdAndUpdate(conversationId, update, {
    new: true,
  })
    .populate("participants", "id displayName username email avatarStyle avatarUrl lastActiveAt")
    .populate("admins", "id")
    .lean();

  const payload = publicConversation(updated, userId, onlineSnapshot());
  emitToConversation(conversationId, "conversation:updated", { conversation: payload });
  return payload;
}

// Add one or more members to a group. Admin only. New members' sockets join
// the room and all members receive the updated conversation.
export async function addMembers({ conversationId, userId, memberIds }) {
  const conversation = await assertMembership(conversationId, userId);
  assertAdmin(conversation, userId);

  const unique = [...new Set(memberIds)];
  if (unique.length === 0) {
    throw badRequest("No members to add", "NO_MEMBERS");
  }
  for (const id of unique) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw badRequest("Invalid member id", "INVALID_MEMBER");
    }
  }
  const existing = new Set(conversation.participants.map((p) => p.toString()));
  const toAdd = unique.filter((id) => !existing.has(id));
  if (toAdd.length === 0) {
    throw badRequest("User is already a member", "ALREADY_MEMBER");
  }
  await resolveUsers(toAdd);

  const updated = await Conversation.findByIdAndUpdate(
    conversationId,
    { $addToSet: { participants: { $each: toAdd } } },
    { new: true },
  )
    .populate("participants", "id displayName username email avatarStyle avatarUrl lastActiveAt")
    .populate("admins", "id")
    .lean();

  const payload = publicConversation(updated, userId, onlineSnapshot());
  for (const id of toAdd) {
    joinUserToRoom(id, conversationId);
  }
  emitToConversation(conversationId, "conversation:member-added", {
    conversation: payload,
    addedBy: userId,
  });

  // Centered info chip(s): "Admin added {name}" for each new member.
  const addedUsers = await User.find({ _id: { $in: toAdd } })
    .select("displayName username")
    .lean();
  for (const u of addedUsers) {
    const name = u.displayName || u.username || "A member";
    await emitSystemMessage({
      conversationId,
      senderId: userId,
      content: `Admin added ${name}`,
    });
  }

  return payload;
}

// Remove a member from a group. Admins can remove anyone; any member can remove
// themselves (leave). Blocked if it would leave the group with zero admins.
export async function removeMember({ conversationId, userId, targetUserId }) {
  const conversation = await assertMembership(conversationId, userId);
  if (conversation.type !== "group") {
    throw forbidden("This action is only available in group conversations", "NOT_GROUP");
  }

  const participantIds = conversation.participants.map((p) => p.toString());
  if (!participantIds.includes(targetUserId)) {
    throw badRequest("User is not a member of this group", "NOT_MEMBER");
  }

  const isSelf = targetUserId === userId;
  const isAdminUser = (conversation.admins || []).map((id) => id.toString()).includes(userId);
  if (!isSelf && !isAdminUser) {
    throw forbidden("Only group admins can remove members", "NOT_ADMIN");
  }

  // Removing the last remaining admin is not allowed (group would be orphaned).
  const adminIds = (conversation.admins || []).map((id) => id.toString());
  const targetIsAdmin = adminIds.includes(targetUserId);
  if (targetIsAdmin && adminIds.length <= 1) {
    throw forbidden(
      "Cannot remove the last admin. Promote someone first.",
      "LAST_ADMIN",
    );
  }

  const updated = await Conversation.findByIdAndUpdate(
    conversationId,
    {
      $pull: {
        participants: targetUserId,
        admins: targetUserId,
      },
    },
    { new: true },
  )
    .populate("participants", "id displayName username email avatarStyle avatarUrl lastActiveAt")
    .populate("admins", "id")
    .lean();

  // Build the centered info chip text shown in the chat for everyone.
  const targetUser = await User.findById(targetUserId)
    .select("displayName username")
    .lean();
  const targetName =
    targetUser?.displayName || targetUser?.username || "A member";
  const notice = isSelf
    ? `${targetName} left the group`
    : `Admin removed ${targetName}`;

  if (isSelf) {
    leaveUserFromRoom(userId, conversationId);
    // Tell the leaving member's client to drop the thread from their list.
    emitToUser(userId, "conversation:removed", { conversationId });
  } else {
    // Removed by an admin: kick them from the live room and tell their client to
    // drop the thread in real time (no page refresh needed).
    leaveUserFromRoom(targetUserId, conversationId);
    emitToUser(targetUserId, "conversation:removed", { conversationId });
  }

  // Broadcast the info chip to everyone still in the room.
  await emitSystemMessage({
    conversationId,
    senderId: userId,
    content: notice,
  });

  const payload = publicConversation(updated, userId, onlineSnapshot());
  emitToConversation(conversationId, "conversation:member-removed", {
    conversationId,
    userId: targetUserId,
    conversation: payload,
    removedBy: userId,
  });
  return payload;
}

// Promote a member to admin. Admin only. Target must already be a participant.
export async function promoteMember({ conversationId, userId, targetUserId }) {
  const conversation = await assertMembership(conversationId, userId);
  assertAdmin(conversation, userId);

  const participantIds = conversation.participants.map((p) => p.toString());
  if (!participantIds.includes(targetUserId)) {
    throw badRequest("User is not a member of this group", "NOT_MEMBER");
  }
  if ((conversation.admins || []).map((id) => id.toString()).includes(targetUserId)) {
    throw badRequest("User is already an admin", "ALREADY_ADMIN");
  }

  const updated = await Conversation.findByIdAndUpdate(
    conversationId,
    { $addToSet: { admins: targetUserId } },
    { new: true },
  )
    .populate("participants", "id displayName username email avatarStyle avatarUrl lastActiveAt")
    .populate("admins", "id")
    .lean();

  const payload = publicConversation(updated, userId, onlineSnapshot());
  emitToConversation(conversationId, "conversation:admin-changed", {
    conversationId,
    userId: targetUserId,
    isAdmin: true,
    conversation: payload,
    changedBy: userId,
  });
  return payload;
}

// Demote an admin to a regular member. Admin only. Blocked if it would leave
// the group with zero admins.
export async function demoteMember({ conversationId, userId, targetUserId }) {
  const conversation = await assertMembership(conversationId, userId);
  assertAdmin(conversation, userId);

  const adminIds = (conversation.admins || []).map((id) => id.toString());
  if (!adminIds.includes(targetUserId)) {
    throw badRequest("User is not an admin", "NOT_ADMIN_MEMBER");
  }
  if (adminIds.length <= 1) {
    throw forbidden("A group must have at least one admin", "LAST_ADMIN");
  }

  const updated = await Conversation.findByIdAndUpdate(
    conversationId,
    { $pull: { admins: targetUserId } },
    { new: true },
  )
    .populate("participants", "id displayName username email avatarStyle avatarUrl lastActiveAt")
    .populate("admins", "id")
    .lean();

  const payload = publicConversation(updated, userId, onlineSnapshot());
  emitToConversation(conversationId, "conversation:admin-changed", {
    conversationId,
    userId: targetUserId,
    isAdmin: false,
    conversation: payload,
    changedBy: userId,
  });
  return payload;
}

// Permanently delete a conversation and all its messages. DMs: either
// participant (the thread is shared, so both sides lose it — the client
// confirm modal says so explicitly). Groups: admin only. Space channels are
// rejected — channels are deleted through Space settings instead.
export async function deleteConversation({ conversationId, userId }) {
  const conversation = await assertMembership(conversationId, userId);
  if (conversation.type === "space_channel") {
    throw forbidden(
      "Space channels can only be deleted from Space settings",
      "NOT_ALLOWED",
    );
  }
  if (conversation.type === "group") {
    assertAdmin(conversation, userId);
  }

  const participantIds = (conversation.participants || []).map((p) =>
    p.toString(),
  );
  await Message.deleteMany({ conversationId: conversation._id });
  await Conversation.deleteOne({ _id: conversation._id });

  // Tell every live client to drop the thread: room members via broadcast,
  // then kick everyone out of the room so no further events leak in.
  emitToConversation(conversationId, "conversation:removed", {
    conversationId,
  });
  for (const pid of participantIds) {
    leaveUserFromRoom(pid, conversationId);
    emitToUser(pid, "conversation:removed", { conversationId });
  }
  return { removed: true, conversationId };
}
