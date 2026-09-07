import { Status, STATUS_TTL_MS } from "../../models/Status.js";
import FriendRequest from "../../models/FriendRequest.js";
import User from "../../models/User.js";
import { badRequest, notFound, forbidden } from "../../utils/errors.js";

async function getFriendIds(userId) {
  const accepted = await FriendRequest.find({ $or: [{ from: userId, status: "accepted" }, { to: userId, status: "accepted" }] }).select("from to").lean();
  const ids = new Set();
  for (const r of accepted) {
    const other = String(r.from) === String(userId) ? r.to : r.from;
    ids.add(String(other));
  }
  return [...ids];
}

export async function createStatus({ userId, text, background }) {
  const now = new Date();
  const doc = await Status.create({ userId, text, background: background || "default", expiresAt: new Date(now.getTime() + STATUS_TTL_MS), viewers: [] });
  return doc;
}

export async function listFeed({ currentUserId }) {
  const friendIds = await getFriendIds(currentUserId);
  const me = await User.findById(currentUserId).select("blockedUsers").lean();
  const blocked = new Set((me?.blockedUsers || []).map(String));
  const blockers = await User.find({ blockedUsers: currentUserId }).select("_id").lean();
  const blockedBy = new Set(blockers.map(b=>String(b._id)));
  const allowedFriendIds = friendIds.filter(id => !blocked.has(id) && !blockedBy.has(id));
  if (allowedFriendIds.length === 0) return [];
  const rows = await Status.find({ userId: { $in: allowedFriendIds }, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 }).populate("userId", "displayName username avatarUrl avatarStyle").lean();
  const byUser = new Map();
  for (const s of rows) {
    const uid = String(s.userId._id);
    if (!byUser.has(uid)) byUser.set(uid, { user: s.userId, statuses: [] });
    byUser.get(uid).statuses.push({ ...s, id: String(s._id), userId: uid, isViewed: s.viewers.some(v=>String(v.userId)===String(currentUserId)) });
  }
  return [...byUser.values()];
}

export async function listMyStatuses({ currentUserId }) {
  const rows = await Status.find({ userId: currentUserId, expiresAt: { $gt: new Date() } }).sort({ createdAt: 1 }).lean();
  return rows.map(r=>({ ...r, id: String(r._id), userId: String(r.userId) }));
}

export async function viewStatus({ currentUserId, statusId }) {
  const st = await Status.findById(statusId);
  if (!st || st.expiresAt <= new Date()) throw notFound("Status not found or expired");
  if (String(st.userId) === String(currentUserId)) return st;
  const friendIds = await getFriendIds(st.userId);
  if (!friendIds.map(String).includes(String(currentUserId))) throw forbidden("Not allowed to view this status");
  const meBlocked = await User.findById(st.userId).select("blockedUsers").lean();
  if ((meBlocked?.blockedUsers || []).map(String).includes(String(currentUserId))) throw forbidden("Not allowed");
  const already = st.viewers.some(v=>String(v.userId)===String(currentUserId));
  if (!already) {
    st.viewers.push({ userId: currentUserId, viewedAt: new Date() });
    await st.save();
  }
  return st;
}

export async function deleteStatus({ currentUserId, statusId }) {
  const st = await Status.findById(statusId);
  if (!st) throw notFound("Status not found");
  if (String(st.userId) !== String(currentUserId)) throw forbidden("Not your status");
  await st.deleteOne();
  return true;
}

export async function viewedBy({ statusId }) {
  const st = await Status.findById(statusId).select("viewers").lean();
  return st?.viewers || [];
}
