import mongoose from "mongoose";
import { unauthorized, notFound, badRequest } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import { getIO } from "../../socket/index.js";

// Public representation of a conversation for the current user. Strips internal
// fields and leaves participants populated enough for the client to render a DM
// title (the "other" participant) or, later, a group name.
// Normalize a participant into the { id, displayName, username, email } shape the
// client expects for rendering a DM title. Handles both bare ObjectId strings
// (not yet populated) and fully populated user documents.
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
  };
}

function publicConversation(conversation, userId, onlineLookup) {
  const participants = (conversation.participants || []).map(normalizeParticipant);
  const otherParticipantIds = participants
    .map((p) => p.id)
    .filter((id) => id !== userId);

  return {
    id: conversation._id.toString(),
    type: conversation.type,
    participants,
    otherParticipantIds,
    lastMessageAt: conversation.lastMessageAt || null,
    createdAt: conversation.createdAt,
    online: onlineLookup
      ? otherParticipantIds.map((id) => Boolean(onlineLookup(id)))
      : undefined,
  };
}

// Resolve which participant ids of a conversation are currently online.
function onlineSnapshot(otherIds) {
  const io = getIO();
  if (!io || !io.isUserOnline) return null;
  return (id) => io.isUserOnline(id);
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

  // Normalize participant order so the $all query is order-independent.
  const existing = await Conversation.findOne({
    type: "dm",
    participants: { $all: [userId, participantId] },
  }).populate("participants", "id displayName username email");
  if (existing) {
    return publicConversation(existing, userId, onlineSnapshot());
  }

  const created = await Conversation.create({
    type: "dm",
    participants: [userId, participantId],
  });
  await created.populate("participants", "id displayName username email");

  // Join both users' live sockets to the room immediately.
  const io = getIO();
  if (io) {
    const room = `conversation:${created._id.toString()}`;
    for (const sid of io.sockets.sockets.keys()) {
      const sock = io.sockets.sockets.get(sid);
      if (sock && (sock.userId === userId || sock.userId === participantId)) {
        sock.join(room);
      }
    }
  }

  return publicConversation(created, userId, onlineSnapshot());
}

// List the current user's conversations, newest activity first. Includes a
// lightweight unread count (messages not authored by the user and not yet read).
export async function listConversations({ userId }) {
  const conversations = await Conversation.find({ participants: userId })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .populate("participants", "id displayName username email")
    .lean();

  const lookup = onlineSnapshot();
  const result = [];
  for (const c of conversations) {
    const base = publicConversation(c, userId, lookup);
    const unread = await Message.countDocuments({
      conversationId: c._id,
      senderId: { $ne: userId },
      isDeleted: false,
      readBy: { $not: { $elemMatch: { userId } } },
    });
    base.unreadCount = unread;
    result.push(base);
  }
  return result;
}
