import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import env from "../config/env.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
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

// Verify the access token presented during the Socket.IO handshake. We reuse
// the exact same secret/algorithm as the HTTP `authenticate` middleware so the
// auth surface is single-source. Re-runs on every (re)connection automatically.
function verifyHandshakeToken(socket, next) {
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
      conversations = await Conversation.find({ participants: userId }).select("_id").lean();
    } catch (err) {
      console.error("[socket] failed to load conversations for", userId, err);
    }
    for (const c of conversations) {
      socket.join(roomName(c._id.toString()));
    }

    // Presence: announce first-connection online status to mutual participants.
    const becameOnline = markOnline(userId, socket.id);
    if (becameOnline) {
      // Notify other participants in this user's conversations.
      socket.broadcast.emit("presence:online", { userId });
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

    socket.on("disconnect", () => {
      const becameOffline = markOffline(userId, socket.id);
      if (becameOffline) {
        socket.broadcast.emit("presence:offline", { userId });
      }
      // Socket.IO leaves its rooms automatically on disconnect.
    });
  });

  // Expose current online state for the REST layer (e.g. conversation list). A
  // helper so controllers don't import the Map directly.
  io.isUserOnline = (userId) => isOnline(userId);

  return io;
}
