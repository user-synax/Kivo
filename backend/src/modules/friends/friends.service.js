import mongoose from "mongoose";
import { unauthorized, notFound, conflict, badRequest } from "../../utils/errors.js";
import User from "../../models/User.js";
import FriendRequest from "../../models/FriendRequest.js";
import { emitToUser } from "../../socket/io.js";
import * as notificationsService from "../notifications/notifications.service.js";

function isPlusEffective(u) {
  if (!u || u.plan !== "plus") return false;
  const exp = u.planExpiresAt ? new Date(u.planExpiresAt).getTime() : null;
  if (exp != null && Number.isFinite(exp) && exp < Date.now()) return false;
  return true;
}

function publicUser(user) {
  const u = user.toObject ? user.toObject() : user;
  const isPlus = isPlusEffective(u);
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
}

function publicRequest(req, user) {
  return {
    id: req._id.toString(),
    status: req.status,
    createdAt: req.createdAt,
    from: publicUser(user),
    welcomeMessage: req.welcomeMessage || null,
    welcomeMessageAt: req.welcomeMessageAt ? new Date(req.welcomeMessageAt).toISOString() : null,
  };
}

// Send a friend request to a user identified by username or email.
export async function sendRequest({ userId, identifier, welcomeMessage }) {
  if (!mongoose.Types.ObjectId.isValid(identifier)) {
    // identifier is a username/email, not an id
  } else if (identifier === userId) {
    throw badRequest("You cannot add yourself", "SELF_FRIEND");
  }

  const target = await User.findOne({
    $or: [{ username: identifier }, { email: identifier.toLowerCase() }],
  }).select("_id blockedUsers");
  if (!target) {
    throw notFound("User not found", "USER_NOT_FOUND");
  }
  if (target._id.toString() === userId) {
    throw badRequest("You cannot add yourself", "SELF_FRIEND");
  }

  // Block guards — either side blocked should not allow request
  const [me, targetBlocked] = await Promise.all([
    User.findById(userId).select("blockedUsers").lean(),
    User.findById(target._id).select("blockedUsers").lean(),
  ]);
  const myBlocked = new Set((me?.blockedUsers || []).map((id) => id.toString()));
  const theyBlocked = new Set((targetBlocked?.blockedUsers || []).map((id) => id.toString()));
  if (myBlocked.has(target._id.toString()) || theyBlocked.has(userId.toString())) {
    throw badRequest("You cannot send a request to this user", "BLOCKED_USER");
  }

  // Sanitize welcome message
  let cleanWelcome = null;
  if (welcomeMessage && String(welcomeMessage).trim()) {
    cleanWelcome = String(welcomeMessage).trim().slice(0, 280);
    if (cleanWelcome.length === 0) cleanWelcome = null;
  }

  // Already friends?
  const existingFriends = await FriendRequest.findOne({
    status: "accepted",
    $or: [
      { from: userId, to: target._id },
      { from: target._id, to: userId },
    ],
  });
  if (existingFriends) {
    throw conflict("Already friends", "ALREADY_FRIENDS");
  }

  // Pending request from me to them already?
  const outgoing = await FriendRequest.findOne({ from: userId, to: target._id, status: "pending" });
  if (outgoing) {
    return { request: publicRequest(outgoing, target), alreadySent: true };
  }
  // Pending request from them to me? Don't let the sender re-create; surface it.
  const incoming = await FriendRequest.findOne({ from: target._id, to: userId, status: "pending" });
  if (incoming) {
    throw conflict("This user already sent you a request", "INCOMING_REQUEST");
  }

  const created = await FriendRequest.create({
    from: userId,
    to: target._id,
    status: "pending",
    welcomeMessage: cleanWelcome,
    welcomeMessageAt: cleanWelcome ? new Date() : null,
  });

  // In-app notification: friend_request (fire-and-forget, Phase 1 no push)
  try {
    const sender = await User.findById(userId).select("displayName username avatarUrl").lean();
    const title = sender?.displayName || sender?.username || "New friend request";
    const body = cleanWelcome ? cleanWelcome.slice(0, 80) : `${sender?.displayName || sender?.username || "Someone"} sent you a friend request`;
    await notificationsService.createFriendNotification({
      recipientId: target._id,
      senderId: userId,
      type: "friend_request",
      title,
      body,
      avatarUrl: sender?.avatarUrl || null,
    });
  } catch (err) {
    console.error("[notifications] friend_request failed:", err?.message || err);
  }

  return { request: publicRequest(created, target), alreadySent: false };
}

// Incoming pending requests for the current user (with sender info).
export async function listRequests({ userId }) {
  const requests = await FriendRequest.find({ to: userId, status: "pending" })
    .sort({ createdAt: -1 })
    .populate("from", "displayName username email avatarStyle avatarUrl usernameColor plan planExpiresAt")
    .lean();
  return requests.map((r) => ({
    id: r._id.toString(),
    status: r.status,
    createdAt: r.createdAt,
    welcomeMessage: r.welcomeMessage || null,
    welcomeMessageAt: r.welcomeMessageAt ? new Date(r.welcomeMessageAt).toISOString() : null,
    from: {
      id: r.from._id.toString(),
      displayName: r.from.displayName || null,
      username: r.from.username || null,
      email: r.from.email,
      avatarStyle: r.from.avatarStyle || null,
      avatarUrl: r.from.avatarUrl || null,
      usernameColor: r.from.usernameColor || null,
      isPlus: r.from.plan === "plus",
    },
  }));
}

// Accept a pending incoming request.
export async function acceptRequest({ userId, requestId }) {
  const req = await FriendRequest.findOne({ _id: requestId, to: userId, status: "pending" });
  if (!req) {
    throw notFound("Request not found", "REQUEST_NOT_FOUND");
  }
  req.status = "accepted";
  await req.save();

  // In-app notification: friend_accept to the original requester
  try {
    const acceptor = await User.findById(userId).select("displayName username avatarUrl").lean();
    const title = acceptor?.displayName || acceptor?.username || "Friend request accepted";
    const body = `${acceptor?.displayName || acceptor?.username || "Someone"} accepted your friend request`;
    await notificationsService.createFriendNotification({
      recipientId: req.from,
      senderId: userId,
      type: "friend_accept",
      title,
      body,
      avatarUrl: acceptor?.avatarUrl || null,
    });
  } catch (err) {
    console.error("[notifications] friend_accept failed:", err?.message || err);
  }

  const from = await User.findById(req.from).select("displayName username email").lean();
  return {
    id: req._id.toString(),
    status: req.status,
    friend: from
      ? { id: from._id.toString(), displayName: from.displayName || null, username: from.username || null, email: from.email }
      : null,
  };
}

// Decline (or cancel) a request.
export async function declineRequest({ userId, requestId }) {
  const req = await FriendRequest.findOne({
    _id: requestId,
    status: "pending",
    $or: [{ to: userId }, { from: userId }],
  });
  if (!req) {
    throw notFound("Request not found", "REQUEST_NOT_FOUND");
  }
  req.status = "declined";
  await req.save();
  return { id: req._id.toString(), status: req.status };
}

// List accepted friends (the other party in each accepted edge).
export async function listFriends({ userId }) {
  const edges = await FriendRequest.find({
    status: "accepted",
    $or: [{ from: userId }, { to: userId }],
  }).lean();

  const friendIds = edges.map((e) =>
    e.from.toString() === userId ? e.to.toString() : e.from.toString()
  );
  if (friendIds.length === 0) return [];

  const users = await User.find({ _id: { $in: friendIds } })
    .select("displayName username email avatarStyle avatarUrl usernameColor plan planExpiresAt")
    .lean();
  return users.map((u) => publicUser(u));
}

// Remove a friendship (or a pending request) initiated either direction.
// The edge is shared, so deleting it removes the friend from BOTH users'
// lists at once; the other side is nudged over sockets to refresh live.
export async function removeFriend({ userId, friendId }) {
  if (!mongoose.Types.ObjectId.isValid(friendId)) {
    throw badRequest("Invalid friend id", "INVALID_FRIEND");
  }
  const res = await FriendRequest.deleteOne({
    status: "accepted",
    $or: [
      { from: userId, to: friendId },
      { from: friendId, to: userId },
    ],
  });
  if (res.deletedCount === 0) {
    throw notFound("Friendship not found", "FRIEND_NOT_FOUND");
  }
  emitToUser(friendId, "friend:removed", { userId });
  return { removed: true };
}
