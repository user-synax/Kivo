import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import env from "../../config/env.js";
import { unauthorized, notFound, badRequest } from "../../utils/errors.js";
import User from "../../models/User.js";
import Conversation from "../../models/Conversation.js";
import Space from "../../models/Space.js";
import Message from "../../models/Message.js";
import Session from "../../models/Session.js";
import AdminActionLog from "../../models/AdminActionLog.js";
import { getIO } from "../../socket/index.js";

// ── Admin Auth ──────────────────────────────────────────────────────────────

export async function adminLogin({ email, password, ip }) {
  if (!env.adminEmail || !env.adminPasswordHash) {
    throw unauthorized("Admin login not configured", "ADMIN_NOT_CONFIGURED");
  }
  if (email.toLowerCase() !== env.adminEmail.toLowerCase()) {
    throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }
  const ok = await bcrypt.compare(password, env.adminPasswordHash);
  if (!ok) {
    throw unauthorized("Invalid credentials", "INVALID_CREDENTIALS");
  }

  const token = jwt.sign({ role: "admin" }, env.adminJwtSecret, {
    expiresIn: env.adminJwtTtl,
  });

  return { token };
}

export function adminLogout() {
  // Cookie clearing is handled by the controller — nothing server-side to revoke.
  return { loggedOut: true };
}

// ── Audit Log ───────────────────────────────────────────────────────────────

async function logAction({ action, targetType, targetId, targetName, reason, ip }) {
  await AdminActionLog.create({
    action,
    targetType,
    targetId,
    targetName: targetName || null,
    reason: reason || null,
    ip: ip || null,
  }).catch(() => {});
}

// ── Stats ───────────────────────────────────────────────────────────────────

export async function getStats() {
  const [totalUsers, bannedUsers, totalGroups, totalSpaces, totalMessages] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isBanned: true }),
      Conversation.countDocuments({ type: "group" }),
      Space.countDocuments(),
      Message.countDocuments(),
    ]);
  return { totalUsers, bannedUsers, totalGroups, totalSpaces, totalMessages };
}

// ── User Management ─────────────────────────────────────────────────────────

export async function listUsers({ page = 1, limit = 20, q, banned }) {
  const filter = {};
  if (q && q.trim()) {
    const regex = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ username: regex }, { email: regex }, { displayName: regex }];
  }
  if (banned === "true") filter.isBanned = true;
  else if (banned === "false") filter.isBanned = false;

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [users, total] = await Promise.all([
    User.find(filter)
      .select("displayName username email avatarUrl isBanned bannedAt bannedReason plan createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments(filter),
  ]);

  return {
    users: users.map((u) => ({
      id: u._id.toString(),
      displayName: u.displayName || null,
      username: u.username || null,
      email: u.email,
      avatarUrl: u.avatarUrl || null,
      isBanned: Boolean(u.isBanned),
      bannedAt: u.bannedAt || null,
      bannedReason: u.bannedReason || null,
      plan: u.plan || "free",
      createdAt: u.createdAt,
    })),
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function getUserDetail(userId) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw badRequest("Invalid user id", "INVALID_ID");
  }
  const user = await User.findById(userId)
    .select("displayName username email avatarUrl bio status isBanned bannedAt bannedReason plan profileEffect twoFactorEnabled createdAt")
    .lean();
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");

  const [conversationCount, groupCount, spaceCount] = await Promise.all([
    Conversation.countDocuments({ participants: userId, type: "dm" }),
    Conversation.countDocuments({ participants: userId, type: "group" }),
    Space.countDocuments({ "members.userId": userId }),
  ]);

  // Ban history: every ban_user / unban_user action targeting this user,
  // newest first. AdminActionLog carries action, reason, ip, performedAt.
  const banHistory = await AdminActionLog.find({
    targetType: "user",
    targetId: userId,
    action: { $in: ["ban_user", "unban_user"] },
  })
    .sort({ performedAt: -1 })
    .limit(50)
    .lean();

  return {
    id: user._id.toString(),
    displayName: user.displayName || null,
    username: user.username || null,
    email: user.email,
    avatarUrl: user.avatarUrl || null,
    bio: user.bio || null,
    status: user.status || null,
    isBanned: Boolean(user.isBanned),
    bannedAt: user.bannedAt || null,
    bannedReason: user.bannedReason || null,
    plan: user.plan || "free",
    profileEffect: user.profileEffect || "none",
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    createdAt: user.createdAt,
    conversationCount,
    groupCount,
    spaceCount,
    banHistory: banHistory.map((h) => ({
      action: h.action,
      reason: h.reason || null,
      ip: h.ip || null,
      performedAt: h.performedAt,
      targetName: h.targetName || null,
    })),
  };
}

export async function banUser({ userId, reason, ip }) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw badRequest("Invalid user id", "INVALID_ID");
  }
  const user = await User.findById(userId).select("displayName username isBanned");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  if (user.isBanned) throw badRequest("User is already banned", "ALREADY_BANNED");

  await User.findByIdAndUpdate(userId, {
    isBanned: true,
    bannedAt: new Date(),
    bannedReason: reason || null,
  });

  // Force-logout: revoke all sessions
  await Session.deleteMany({ userId });

  // Disconnect live sockets
  const io = getIO();
  if (io) {
    for (const [, sock] of io.sockets.sockets) {
      if (sock.userId === userId) {
        sock.disconnect(true);
      }
    }
  }

  await logAction({
    action: "ban_user",
    targetType: "user",
    targetId: user._id,
    targetName: user.displayName || user.username || userId,
    reason,
    ip,
  });

  return { banned: true };
}

export async function unbanUser({ userId, ip }) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw badRequest("Invalid user id", "INVALID_ID");
  }
  const user = await User.findById(userId).select("displayName username isBanned");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  if (!user.isBanned) throw badRequest("User is not banned", "NOT_BANNED");

  await User.findByIdAndUpdate(userId, {
    isBanned: false,
    bannedAt: null,
    bannedReason: null,
  });

  await logAction({
    action: "unban_user",
    targetType: "user",
    targetId: user._id,
    targetName: user.displayName || user.username || userId,
    ip,
  });

  return { unbanned: true };
}

// Grant or revoke the Kivo Plus plan (admin-only entitlement; there is no
// self-serve payment flow yet, so a grant is the only way to become plus).
export async function setUserPlan({ userId, plan, ip }) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw badRequest("Invalid user id", "INVALID_ID");
  }
  if (!["free", "plus"].includes(plan)) {
    throw badRequest("Plan must be 'free' or 'plus'", "INVALID_PLAN");
  }
  const user = await User.findById(userId).select("displayName username plan");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  if (user.plan === plan) {
    throw badRequest(`User is already on the ${plan} plan`, "ALREADY_PLAN");
  }

  await User.findByIdAndUpdate(userId, { plan });
  // Downgrading also clears any Plus-only profile effect.
  if (plan === "free") {
    await User.findByIdAndUpdate(userId, { profileEffect: "none" });
  }

  await logAction({
    action: plan === "plus" ? "grant_plus" : "revoke_plus",
    targetType: "user",
    targetId: user._id,
    targetName: user.displayName || user.username || userId,
    reason: null,
    ip,
  });

  return { plan };
}

// ── Groups Management ───────────────────────────────────────────────────────

export async function listGroups({ page = 1, limit = 20 }) {
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [groups, total] = await Promise.all([
    Conversation.find({ type: "group" })
      .populate("participants", "displayName username")
      .populate("admins", "displayName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Conversation.countDocuments({ type: "group" }),
  ]);

  return {
    groups: groups.map((g) => ({
      id: g._id.toString(),
      name: g.name,
      memberCount: (g.participants || []).length,
      admins: (g.admins || []).map((a) => ({
        id: a._id?.toString?.() || a.toString(),
        displayName: a.displayName || null,
        username: a.username || null,
      })),
      createdBy: g.createdBy?.toString?.() || null,
      createdAt: g.createdAt,
      lastMessageAt: g.lastMessageAt || null,
    })),
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function deleteGroup({ groupId, ip }) {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw badRequest("Invalid group id", "INVALID_ID");
  }
  const group = await Conversation.findOne({ _id: groupId, type: "group" })
    .select("name")
    .lean();
  if (!group) throw notFound("Group not found", "GROUP_NOT_FOUND");

  // Hard delete: messages first, then the conversation
  await Message.deleteMany({ conversationId: groupId });
  await Conversation.deleteOne({ _id: groupId });

  await logAction({
    action: "delete_group",
    targetType: "group",
    targetId: group._id,
    targetName: group.name,
    ip,
  });

  return { deleted: true };
}

// ── Spaces Management ───────────────────────────────────────────────────────

export async function listSpaces({ page = 1, limit = 20 }) {
  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
  const [spaces, total] = await Promise.all([
    Space.find()
      .populate("owner", "displayName username")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Space.countDocuments(),
  ]);

  return {
    spaces: spaces.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      slug: s.slug,
      category: s.category,
      memberCount: (s.members || []).length,
      channelCount: (s.channels || []).length,
      owner: s.owner
        ? {
            id: s.owner._id?.toString?.() || s.owner.toString(),
            displayName: s.owner.displayName || null,
            username: s.owner.username || null,
          }
        : null,
      createdAt: s.createdAt,
    })),
    total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(total / Number(limit)),
  };
}

export async function deleteSpace({ spaceId, ip }) {
  if (!mongoose.Types.ObjectId.isValid(spaceId)) {
    throw badRequest("Invalid space id", "INVALID_ID");
  }
  const space = await Space.findById(spaceId).select("name channels").lean();
  if (!space) throw notFound("Space not found", "SPACE_NOT_FOUND");

  // Find all channel conversations for this space so we can delete their messages
  const channelConvIds = await Conversation.find({
    type: "space_channel",
    spaceId,
  })
    .select("_id")
    .lean();

  // Delete messages in all channel conversations
  if (channelConvIds.length > 0) {
    await Message.deleteMany({
      conversationId: { $in: channelConvIds.map((c) => c._id) },
    });
    await Conversation.deleteMany({
      _id: { $in: channelConvIds.map((c) => c._id) },
    });
  }

  await Space.deleteOne({ _id: spaceId });

  await logAction({
    action: "delete_space",
    targetType: "space",
    targetId: space._id,
    targetName: space.name,
    ip,
  });

  return { deleted: true };
}
