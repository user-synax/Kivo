import mongoose from "mongoose";
import crypto from "crypto";
import { notFound, badRequest, forbidden, conflict } from "../../utils/errors.js";
import Space from "../../models/Space.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import { uploadAvatar } from "../../lib/appwrite.js";
import { getIO } from "../../socket/index.js";
import { emitToConversation, joinUserToRoom, leaveUserFromRoom, emitToUser, emitToSpace, joinUserToSpace, leaveUserFromSpace } from "../../socket/io.js";

// ── helpers ──────────────────────────────────────────────────────────

function generateSlug(name) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
  const rand = crypto.randomBytes(3).toString("hex");
  return `${base || "space"}-${rand}`;
}

function generateInviteCode() {
  return crypto.randomBytes(6).toString("hex"); // 12 chars
}

async function enrichMembers(members) {
  if (!members || !members.length) return [];
  const ids = members.map((m) => m.userId);
  const users = await User.find({ _id: { $in: ids } })
    .select("displayName username email avatarUrl avatarStyle")
    .lean();
  const map = new Map(users.map((u) => [u._id.toString(), u]));
  return members.map((m) => {
    const u = map.get(m.userId.toString());
    return {
      userId: m.userId.toString(),
      role: m.role,
      joinedAt: m.joinedAt,
      displayName: u?.displayName || null,
      username: u?.username || null,
      email: u?.email || null,
      avatarUrl: u?.avatarUrl || null,
      avatarStyle: u?.avatarStyle || null,
    };
  });
}

async function toPublicSpace(space, userId) {
  const obj = space.toObject ? space.toObject() : space;
  const rawMembers = obj.members || [];
  const members = await enrichMembers(rawMembers);
  const channels = (obj.channels || []).map((c) => ({
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
    description: c.description,
    type: c.type,
    createdBy: c.createdBy ? c.createdBy.toString() : null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
  const myMember = members.find((m) => m.userId === userId);
  return {
    id: obj._id.toString(),
    name: obj.name,
    slug: obj.slug,
    description: obj.description,
    category: obj.category,
    avatarUrl: obj.avatarUrl || null,
    banner: obj.banner || null,
    owner: obj.owner.toString(),
    members,
    myRole: myMember ? myMember.role : null,
    isOwner: obj.owner.toString() === userId,
    isAdmin: myMember ? ["owner", "admin"].includes(myMember.role) : false,
    channels,
    memberCount: members.length,
    channelCount: channels.length,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

async function assertSpace(spaceId, userId, { requireMember = false, requireRole = null } = {}) {
  if (!mongoose.Types.ObjectId.isValid(spaceId)) throw badRequest("Invalid space id", "INVALID_ID");
  const space = await Space.findById(spaceId);
  if (!space) throw notFound("Space not found", "SPACE_NOT_FOUND");
  if (requireMember) {
    const member = space.members.find((m) => m.userId.toString() === userId);
    if (!member) throw forbidden("You are not a member of this space", "NOT_MEMBER");
    if (requireRole) {
      const rank = { owner: 4, admin: 3, moderator: 2, member: 1 };
      if ((rank[member.role] || 0) < (rank[requireRole] || 0)) {
        throw forbidden("Insufficient permissions", "FORBIDDEN");
      }
    }
    return { space, member };
  }
  return { space, member: space.members.find((m) => m.userId.toString() === userId) || null };
}

function slugFromName(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Space CRUD ────────────────────────────────────────────────────────

export async function createSpace({ userId, name, description, category, banner, avatar }) {
  const slug = generateSlug(name);

  let avatarUrl = null;
  let avatarFileId = null;
  if (avatar && avatar.buffer) {
    const up = await uploadAvatar(avatar.buffer, avatar.contentType, null);
    avatarUrl = up.url;
    avatarFileId = up.fileId;
  }

  const space = await Space.create({
    name: name.trim(),
    slug,
    description: (description || "").trim(),
    category: category || "Other",
    banner: banner || null,
    avatarUrl,
    avatarFileId,
    owner: userId,
    members: [{ userId, role: "owner", joinedAt: new Date() }],
    channels: [],
  });

  // default #general channel + backing Conversation
  const generalChannelId = new mongoose.Types.ObjectId();
  const generalSlug = "general";
  space.channels.push({
    _id: generalChannelId,
    name: "general",
    slug: generalSlug,
    description: "General discussion",
    type: "text",
    createdBy: userId,
  });
  await space.save();

  const conv = await Conversation.create({
    type: "space_channel",
    spaceId: space._id,
    channelId: generalChannelId,
    name: "general",
    participants: [userId],
    createdBy: userId,
  });

  // join owner socket to space + channel
  try { joinUserToSpace(userId, space._id.toString()); } catch {}
  joinUserToRoom(userId, conv._id.toString());

  const populated = await Space.findById(space._id);
  return await toPublicSpace(populated, userId);
}

export async function listSpaces({ userId }) {
  const spaces = await Space.find({ "members.userId": userId }).sort({ updatedAt: -1 }).lean();
  const result = [];
  for (const s of spaces) {
    const members = await enrichMembers(s.members || []);
    const channels = (s.channels || []).map((c) => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
      description: c.description,
      type: c.type,
      createdBy: c.createdBy ? c.createdBy.toString() : null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
    const myMember = members.find((m) => m.userId === userId);
    result.push({
      id: s._id.toString(),
      name: s.name,
      slug: s.slug,
      description: s.description,
      category: s.category,
      avatarUrl: s.avatarUrl || null,
      banner: s.banner || null,
      owner: s.owner.toString(),
      members,
      myRole: myMember ? myMember.role : null,
      isOwner: s.owner.toString() === userId,
      isAdmin: myMember ? ["owner", "admin"].includes(myMember.role) : false,
      channels,
      memberCount: members.length,
      channelCount: channels.length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    });
  }
  return result;
}

export async function listPublicSpaces({ q, category, limit = 20 }) {
  const filter = {};
  if (category && category !== "All") filter.category = category;
  if (q && q.trim()) {
    const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: regex }, { description: regex }];
  }
  const spaces = await Space.find(filter).sort({ updatedAt: -1 }).limit(Math.min(limit, 50)).select("name slug description category avatarUrl banner owner members channels createdAt").lean();
  return spaces.map((s) => ({
    id: s._id.toString(),
    name: s.name,
    slug: s.slug,
    description: s.description,
    category: s.category,
    avatarUrl: s.avatarUrl || null,
    banner: s.banner || null,
    owner: s.owner.toString(),
    memberCount: (s.members || []).length,
    channelCount: (s.channels || []).length,
    createdAt: s.createdAt,
  }));
}

export async function getSpace({ spaceId, userId }) {
  const { space } = await assertSpace(spaceId, userId);
  return await toPublicSpace(space, userId);
}

export async function updateSpace({ spaceId, userId, data, avatar }) {
  const { space, member } = await assertSpace(spaceId, userId, { requireMember: true, requireRole: "admin" });
  // owner and admin can update
  const update = {};
  if (data.name !== undefined) update.name = data.name.trim();
  if (data.description !== undefined) update.description = data.description;
  if (data.category !== undefined) update.category = data.category;
  if (data.banner !== undefined) update.banner = data.banner || null;
  if (data.slug !== undefined) {
    // allow slug change only if unique
    const s = slugFromName(data.slug);
    if (s !== space.slug) {
      const exists = await Space.findOne({ slug: s, _id: { $ne: spaceId } });
      if (exists) throw conflict("Slug already taken", "SLUG_TAKEN");
      update.slug = s;
    }
  }
  if (avatar && avatar.buffer) {
    const up = await uploadAvatar(avatar.buffer, avatar.contentType, space.avatarFileId || null);
    update.avatarUrl = up.url;
    update.avatarFileId = up.fileId;
  }
  if (Object.keys(update).length === 0) throw badRequest("Nothing to update", "NO_UPDATE");
  const updated = await Space.findByIdAndUpdate(spaceId, update, { new: true });
  return await toPublicSpace(updated, userId);
}

export async function deleteSpace({ spaceId, userId }) {
  const { space } = await assertSpace(spaceId, userId);
  if (space.owner.toString() !== userId) throw forbidden("Only owner can delete space", "NOT_OWNER");
  await Conversation.deleteMany({ spaceId: space._id });
  await Space.findByIdAndDelete(spaceId);
  // emit to space room if needed
  const io = getIO();
  if (io) {
    try { io.to(`space:${spaceId}`).emit("space:deleted", { spaceId }); } catch {}
  }
  return { success: true };
}

// ── Members ───────────────────────────────────────────────────────────

export async function addMember({ spaceId, userId, targetUserId }) {
  const { space } = await assertSpace(spaceId, userId, { requireMember: true, requireRole: "admin" });
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) throw badRequest("Invalid user id", "INVALID_ID");
  const exists = space.members.some((m) => m.userId.toString() === targetUserId);
  if (exists) throw badRequest("User is already a member", "ALREADY_MEMBER");
  const user = await User.findById(targetUserId).select("_id");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  space.members.push({ userId: targetUserId, role: "member", joinedAt: new Date() });
  await space.save();
  // add to all channel conversations
  const convs = await Conversation.find({ spaceId: space._id, type: "space_channel" });
  for (const c of convs) {
    if (!c.participants.map((p) => p.toString()).includes(targetUserId)) {
      c.participants.push(targetUserId);
      await c.save();
      joinUserToRoom(targetUserId, c._id.toString());
    }
  }
  try { emitToSpace(spaceId, "space:member-added", { spaceId, userId: targetUserId, space: await toPublicSpace(space, userId) }); } catch {}
  try { emitToUser(targetUserId, "space:joined", { space: await toPublicSpace(space, targetUserId) }); } catch {}
  return await toPublicSpace(space, userId);
}

export async function removeMember({ spaceId, userId, targetUserId }) {
  const { space } = await assertSpace(spaceId, userId);
  const isSelf = targetUserId === userId;
  const actorMember = space.members.find((m) => m.userId.toString() === userId);
  const targetMember = space.members.find((m) => m.userId.toString() === targetUserId);
  if (!targetMember) throw badRequest("User is not a member", "NOT_MEMBER");
  if (targetMember.role === "owner" && space.members.filter((m) => m.role === "owner").length <= 1) {
    throw forbidden("Cannot remove the last owner", "LAST_OWNER");
  }
  if (!isSelf) {
    if (!actorMember) throw forbidden("You are not a member", "NOT_MEMBER");
    const rank = { owner: 4, admin: 3, moderator: 2, member: 1 };
    if ((rank[actorMember.role] || 0) <= (rank[targetMember.role] || 0) && actorMember.role !== "owner") {
      throw forbidden("Insufficient permissions", "FORBIDDEN");
    }
    if (!["owner", "admin"].includes(actorMember.role)) throw forbidden("Only admins can remove members", "NOT_ADMIN");
  }
  space.members = space.members.filter((m) => m.userId.toString() !== targetUserId);
  // if owner left and no owner remains, promote first admin or first member
  if (targetMember.role === "owner" && !space.members.some((m) => m.role === "owner") && space.members.length > 0) {
    // promote highest ranking
    space.members[0].role = "owner";
    space.owner = space.members[0].userId;
  }
  await space.save();
  // remove from channel conversations
  const convs = await Conversation.find({ spaceId: space._id, type: "space_channel" });
  for (const c of convs) {
    c.participants = c.participants.filter((p) => p.toString() !== targetUserId);
    await c.save();
    leaveUserFromRoom(targetUserId, c._id.toString());
  }
  const io = getIO();
  if (io) {
    try { io.to(`space:${spaceId}`).emit("space:member-removed", { spaceId, userId: targetUserId, space: await toPublicSpace(space, userId) }); } catch {}
    try { emitToUser(targetUserId, "space:removed", { spaceId }); } catch {}
    // also leave space room
    try { for (const s of io.sockets.sockets.values()) { if (s.userId === targetUserId) s.leave(`space:${spaceId}`); } } catch {}
  }
  // system message in each channel — use display name, not mongo id
  const targetUserDoc = await User.findById(targetUserId).select("displayName username").lean();
  const targetName = targetUserDoc?.displayName || targetUserDoc?.username || "A member";
  for (const c of convs) {
    try {
      const content = isSelf ? `${targetName} left the space` : `Admin removed ${targetName} from the space`;
      const sys = await Message.create({ conversationId: c._id, senderId: userId, content, type: "system" });
      const pub = { id: sys._id.toString(), conversationId: c._id.toString(), senderId: userId, content: sys.content, type: "system", createdAt: sys.createdAt };
      emitToConversation(c._id.toString(), "message:new", pub);
    } catch {}
  }
  return await toPublicSpace(space, userId);
}

export async function updateMemberRole({ spaceId, userId, targetUserId, role }) {
  const { space } = await assertSpace(spaceId, userId, { requireMember: true, requireRole: "admin" });
  const actor = space.members.find((m) => m.userId.toString() === userId);
  const target = space.members.find((m) => m.userId.toString() === targetUserId);
  if (!target) throw notFound("Member not found", "NOT_MEMBER");
  if (role === "owner") throw badRequest("Use transfer ownership", "INVALID_ROLE");
  // only owner can promote to admin
  if (role === "admin" && actor.role !== "owner") throw forbidden("Only owner can promote to admin", "FORBIDDEN");
  if (target.role === "owner") throw forbidden("Cannot change owner role", "FORBIDDEN");
  target.role = role;
  await space.save();
  const io = getIO();
  if (io) try { io.to(`space:${spaceId}`).emit("space:member-updated", { spaceId, userId: targetUserId, role, space: await toPublicSpace(space, userId) }); } catch {}
  return await toPublicSpace(space, userId);
}

// ── Join (public spaces) ───────────────────────────────────────────────

export async function joinSpace({ spaceId, userId }) {
  const space = await Space.findById(spaceId);
  if (!space) throw notFound("Space not found", "SPACE_NOT_FOUND");
  const exists = space.members.some((m) => m.userId.toString() === userId);
  if (exists) throw badRequest("Already a member", "ALREADY_MEMBER");
  space.members.push({ userId, role: "member", joinedAt: new Date() });
  await space.save();
  const convs = await Conversation.find({ spaceId: space._id, type: "space_channel" });
  for (const c of convs) {
    if (!c.participants.map((p) => p.toString()).includes(userId)) {
      c.participants.push(userId);
      await c.save();
      joinUserToRoom(userId, c._id.toString());
    }
  }
  const io = getIO();
  if (io) {
    try { for (const s of io.sockets.sockets.values()) { if (s.userId === userId) s.join(`space:${space._id}`); } } catch {}
    try { io.to(`space:${space._id}`).emit("space:member-added", { spaceId: space._id.toString(), userId, space: await toPublicSpace(space, userId) }); } catch {}
  }
  return await toPublicSpace(space, userId);
}

// Keep for backwards compat (invite links) — now just delegates to joinSpace via code lookup
export async function joinByInvite({ code, userId }) {
  const space = await Space.findOne({ inviteCode: code });
  if (!space) throw notFound("Invite not found", "INVITE_NOT_FOUND");
  return joinSpace({ spaceId: space._id.toString(), userId });
}
export async function createInvite({ spaceId, userId, expiresInHours }) {
  // Deprecated — invite links removed. Keep stub to avoid 404.
  throw badRequest("Invite links have been removed. Use Discover to join public spaces.", "INVITE_REMOVED");
}

// ── Channels ──────────────────────────────────────────────────────────

export async function createChannel({ spaceId, userId, name, description, type }) {
  const { space } = await assertSpace(spaceId, userId, { requireMember: true, requireRole: "admin" });
  const slug = slugFromName(name);
  if (space.channels.some((c) => c.slug === slug)) throw conflict("Channel already exists", "CHANNEL_EXISTS");
  const channelId = new mongoose.Types.ObjectId();
  const channel = { _id: channelId, name, slug, description: description || "", type: type || "text", createdBy: userId };
  space.channels.push(channel);
  await space.save();
  const memberIds = space.members.map((m) => m.userId);
  const conv = await Conversation.create({
    type: "space_channel",
    spaceId: space._id,
    channelId,
    name,
    participants: memberIds,
    createdBy: userId,
  });
  // join all members to channel room
  for (const uid of memberIds) joinUserToRoom(uid.toString(), conv._id.toString());
  const io = getIO();
  const pubForChannel = await toPublicSpace(space, userId);
  if (io) try { io.to(`space:${spaceId}`).emit("space:channel-created", { spaceId, channel: pubForChannel.channels.find((c) => c.id === channelId.toString()), conversationId: conv._id.toString() }); } catch {}
  return { channel, conversationId: conv._id.toString(), space: pubForChannel };
}

export async function updateChannel({ spaceId, channelId, userId, data }) {
  const { space } = await assertSpace(spaceId, userId, { requireMember: true, requireRole: "admin" });
  const ch = space.channels.id(channelId);
  if (!ch) throw notFound("Channel not found", "CHANNEL_NOT_FOUND");
  if (data.name !== undefined) {
    const slug = slugFromName(data.name);
    if (space.channels.some((c) => c.slug === slug && c._id.toString() !== channelId)) throw conflict("Channel name taken", "CHANNEL_EXISTS");
    ch.name = data.name;
    ch.slug = slug;
  }
  if (data.description !== undefined) ch.description = data.description;
  if (data.type !== undefined) ch.type = data.type;
  await space.save();
  // also update conversation name if needed
  if (data.name) await Conversation.findOneAndUpdate({ spaceId, channelId }, { name: data.name });
  const io = getIO();
  if (io) try { io.to(`space:${spaceId}`).emit("space:channel-updated", { spaceId, channelId, space: await toPublicSpace(space, userId) }); } catch {}
  return await toPublicSpace(space, userId);
}

export async function deleteChannel({ spaceId, channelId, userId }) {
  const { space } = await assertSpace(spaceId, userId, { requireMember: true, requireRole: "admin" });
  const ch = space.channels.id(channelId);
  if (!ch) throw notFound("Channel not found", "CHANNEL_NOT_FOUND");
  if (space.channels.length <= 1) throw badRequest("Cannot delete the last channel", "LAST_CHANNEL");
  ch.deleteOne();
  await space.save();
  const conv = await Conversation.findOne({ spaceId, channelId });
  if (conv) {
    await Message.deleteMany({ conversationId: conv._id });
    await Conversation.findByIdAndDelete(conv._id);
  }
  const io = getIO();
  if (io) try { io.to(`space:${spaceId}`).emit("space:channel-deleted", { spaceId, channelId }); } catch {}
  return await toPublicSpace(space, userId);
}

export async function listChannels({ spaceId, userId }) {
  const { space } = await assertSpace(spaceId, userId, { requireMember: true });
  return space.channels.map((c) => ({
    id: c._id.toString(),
    name: c.name,
    slug: c.slug,
    description: c.description,
    type: c.type,
    createdBy: c.createdBy ? c.createdBy.toString() : null,
    createdAt: c.createdAt,
  }));
}
