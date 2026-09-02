import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Space from "../models/Space.js";
import { unauthorized } from "../utils/errors.js";
import { roomName } from "./io.js";

// Socket.IO server instance (lazily set by initSocket). getIO() lets REST
// controllers emit events into rooms after a DB write.
let io = null;

export function getIO() {
  return io;
}

// In-memory presence. Maps userId -> Set<socketId>. Single-instance only.
// NOTE: for horizontal scaling you would back this with a shared adapter (e.g.
// a Redis pub/sub adapter) — do NOT add Redis here per the current spec.
const onlineUsers = new Map();

// Grace period for offline transitions — mobile flicker (tab hidden / quick
// reconnect) should not flap presence or spam lastActiveAt writes.
const PRESENCE_OFFLINE_GRACE_MS = 12_000;
const pendingOffline = new Map(); // userId -> { timer: Timeout }

// Focused DM tracking — which conversation the user is currently viewing.
// Used to suppress DM notifications when the recipient is actively looking at
// that DM (spec: "when user is on the dm do not send them notification").
// Map<userId, conversationId | null>
const focusedConversationByUser = new Map();

function setFocusedConversation(userId, conversationId) {
  if (!conversationId) focusedConversationByUser.delete(userId);
  else focusedConversationByUser.set(userId, String(conversationId));
}

function getFocusedConversation(userId) {
  return focusedConversationByUser.get(String(userId)) || null;
}

function isUserFocusedOnConversation(userId, conversationId) {
  if (!userId || !conversationId) return false;
  return getFocusedConversation(userId) === String(conversationId);
}

function markOnline(userId, socketId) {
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
  return onlineUsers.get(userId).size === 1; // first connection for this user?
}

function markOffline(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return false;
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return true; // last connection gone
  }
  return false;
}

function isOnline(userId) {
  return onlineUsers.has(userId);
}

// Compute the set of peer userIds who share at least one conversation or
// space with the given user. Used to scope presence broadcasts so a mass
// reconnect (deploy/restart) does not fan-out O(N²) globally.
async function getRelevantPeerIds(userId) {
  const peers = new Set();
  try {
    const [conversations, spaces] = await Promise.all([
      Conversation.find({ participants: userId }).select("participants").lean(),
      Space.find({ "members.userId": userId }).select("members.userId").lean(),
    ]);
    for (const c of conversations) {
      for (const p of c.participants || []) {
        const pid = (p?._id || p)?.toString?.() || p?.toString?.();
        if (pid && pid !== String(userId)) peers.add(pid);
      }
    }
    for (const s of spaces) {
      for (const m of s.members || []) {
        const pid = (m?.userId?._id || m?.userId)?.toString?.() || m?.userId?.toString?.();
        if (pid && pid !== String(userId)) peers.add(pid);
      }
    }
  } catch (err) {
    console.error("[socket] getRelevantPeerIds failed for", userId, err?.message || err);
  }
  return peers;
}

function emitPresenceToPeerIds(peerIds, event, payload) {
  if (!io || !peerIds || peerIds.size === 0) return;
  for (const [, sock] of io.sockets.sockets) {
    const sid = sock.userId ? String(sock.userId) : null;
    if (sid && peerIds.has(sid)) {
      sock.emit(event, payload);
    }
  }
}

async function emitPresenceScoped(userId, event, payload) {
  const peerIds = await getRelevantPeerIds(userId);
  emitPresenceToPeerIds(peerIds, event, payload);
}

// Verify the access token presented during the Socket.IO handshake. We reuse
// the exact same secret/algorithm as the HTTP `authenticate` middleware so the
// auth surface is single-source. Re-runs on every (re)connection automatically.
async function verifyHandshakeToken(socket, next) {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      throw unauthorized("Socket auth token missing", "SOCKET_UNAUTHENTICATED");
    }
    let payload;
    try {
      payload = jwt.verify(token, env.accessTokenSecret);
    } catch {
      throw unauthorized("Invalid socket auth token", "SOCKET_UNAUTHENTICATED");
    }
    if (!payload.userId) {
      throw unauthorized("Invalid socket auth token", "SOCKET_UNAUTHENTICATED");
    }
    // Defense in depth: reject banned users at reconnect time.
    const user = await User.findById(payload.userId).select("isBanned").lean();
    if (!user) {
      throw unauthorized("User no longer exists", "SOCKET_UNAUTHENTICATED");
    }
    if (user.isBanned) {
      throw unauthorized("Account has been suspended", "ACCOUNT_BANNED");
    }
    socket.userId = payload.userId;
    socket.sessionId = payload.sessionId || null;
    next();
  } catch (err) {
    next(err);
  }
}

export function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: env.corsAllowedOrigins
        ? env.corsAllowedOrigins.split(",").map((s) => s.trim())
        : true,
      credentials: true,
    },
  });

  io.use(verifyHandshakeToken);

  io.on("connection", async (socket) => {
    const userId = socket.userId;

    // Auto-join every conversation room this user belongs to, so they receive
    // live updates for all their threads without per-room subscribe calls.
    let conversations = [];
    try {
      conversations = await Conversation.find({ participants: userId })
        .select("_id participants")
        .lean();
    } catch (err) {
      console.error("[socket] failed to load conversations for", userId, err);
    }
    for (const c of conversations) {
      socket.join(roomName(c._id.toString()));
    }
    // Join space rooms for realtime space/channel updates.
    try {
      const spaces = await Space.find({ "members.userId": userId }).select("_id").lean();
      for (const s of spaces) socket.join(`space:${s._id.toString()}`);
    } catch (err) {
      console.error("[socket] failed to load spaces for", userId, err);
    }

    // Presence: announce first-connection online status to relevant participants only.
    // If a pending offline grace timer exists for this user, this is a flicker
    // reconnect — cancel the timer and treat as if they never went offline.
    let becameOnline = false;
    if (pendingOffline.has(String(userId))) {
      const pending = pendingOffline.get(String(userId));
      clearTimeout(pending.timer);
      pendingOffline.delete(String(userId));
      // Re-add to the still-present empty set kept during grace period
      if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
      onlineUsers.get(userId).add(socket.id);
      becameOnline = false;
      // Still refresh lastActiveAt while online (fire-and-forget)
      User.findByIdAndUpdate(userId, { lastActiveAt: new Date() }).catch(() => {});
    } else {
      becameOnline = markOnline(userId, socket.id);
      // Keep lastActiveAt fresh while online (fire-and-forget)
      User.findByIdAndUpdate(userId, { lastActiveAt: new Date() }).catch(() => {});
      if (becameOnline) {
        const peerIds = await getRelevantPeerIds(userId);
        if (peerIds.size > 0) {
          emitPresenceToPeerIds(peerIds, "presence:online", {
            userId,
            lastActiveAt: new Date().toISOString(),
          });
        }
      }
    }

    // Push the current online state of this user's peers directly to the
    // connecting socket. A late joiner would otherwise only learn peer presence
    // from the GET /conversations snapshot (taken at load) and could render a
    // peer as "offline" until that peer reconnects — this corrects it at once.
    const peerIds = new Set();
    for (const c of conversations) {
      for (const p of c.participants || []) {
        const pid = (p?._id || p)?.toString?.() || p?.toString?.();
        if (pid && pid !== userId) peerIds.add(pid);
      }
    }
    const onlinePeers = [...peerIds].filter((id) => isOnline(id));
    if (onlinePeers.length) {
      socket.emit("presence:snapshot", { online: onlinePeers });
    }

    // Typing indicator. Client emits { conversationId } with start/stop; we
    // re-broadcast to the room (excluding sender) so recipients can render it.
    socket.on("typing:start", (data) => {
      const conversationId = data?.conversationId;
      if (!conversationId) return;
      socket.to(roomName(conversationId)).emit("typing:start", { conversationId, userId });
    });
    socket.on("typing:stop", (data) => {
      const conversationId = data?.conversationId;
      if (!conversationId) return;
      socket.to(roomName(conversationId)).emit("typing:stop", { conversationId, userId });
    });

    // Focused DM tracking for notification suppression.
    // Client emits when it opens/closes a conversation; we keep the latest per user.
    socket.on("conversation:focus", (data) => {
      const conversationId = data?.conversationId;
      if (!conversationId) return;
      setFocusedConversation(userId, String(conversationId));
    });
    socket.on("conversation:blur", () => {
      setFocusedConversation(userId, null);
    });

    // Delivery receipt. Client acknowledges a received `message:new` with the
    // messageId; we mark it delivered and tell the sender.
    socket.on("message:delivered", async (data) => {
      const messageId = data?.messageId;
      if (!messageId) return;
      try {
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { $addToSet: { deliveredTo: userId } },
          { new: true }
        ).select("conversationId deliveredTo");
        if (!msg) return;
        // Tell the sender (and others) delivery state changed.
        io.to(roomName(msg.conversationId.toString())).emit("message:delivery-updated", {
          messageId: msg._id.toString(),
          deliveredTo: msg.deliveredTo.map((id) => id.toString()),
        });
      } catch (err) {
        console.error("[socket] message:delivered failed", err);
      }
    });

    socket.on("disconnect", async () => {
      const set = onlineUsers.get(userId);
      if (!set) return;
      set.delete(socket.id);
      if (set.size > 0) return;
      // Last socket gone — start grace period instead of going offline immediately.
      // Keep the empty set in onlineUsers so isOnline() stays true during grace
      // (prevents UI flap and snapshot inconsistency). Clear any prior timer.
      const key = String(userId);
      if (pendingOffline.has(key)) {
        clearTimeout(pendingOffline.get(key).timer);
        pendingOffline.delete(key);
      }
      const timer = setTimeout(async () => {
        const curSet = onlineUsers.get(userId);
        // If user reconnected during grace, abort — they never went offline
        if (curSet && curSet.size > 0) {
          pendingOffline.delete(key);
          return;
        }
        // No reconnection — confirm offline
        onlineUsers.delete(userId);
        pendingOffline.delete(key);
        const now = new Date();
        try {
          await User.findByIdAndUpdate(userId, { lastActiveAt: now });
        } catch {}
        try {
          await emitPresenceScoped(userId, "presence:offline", {
            userId,
            lastActiveAt: now.toISOString(),
          });
        } catch (err) {
          console.error("[socket] scoped presence:offline emit failed", err);
        }
        // Clear focused state only once fully offline — fixes stale leak on grace
        focusedConversationByUser.delete(userId);
      }, PRESENCE_OFFLINE_GRACE_MS);
      if (typeof timer.unref === "function") timer.unref();
      pendingOffline.set(key, { timer });
      // Socket.IO leaves its rooms automatically on disconnect.
    });
  });

  // Expose current online state for the REST layer (e.g. conversation list). A
  // helper so controllers don't import the Map directly.
  io.isUserOnline = (userId) => isOnline(userId);
  io.getFocusedConversation = (userId) => getFocusedConversation(userId);
  io.isUserFocusedOnConversation = (userId, conversationId) =>
    isUserFocusedOnConversation(userId, conversationId);

  return io;
}
