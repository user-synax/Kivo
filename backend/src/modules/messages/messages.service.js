import mongoose from "mongoose";
import { unauthorized, forbidden, notFound, badRequest } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import { emitToConversation, roomName } from "../../socket/io.js";

// Public message shape returned to clients and used as the socket payload base.
export function publicMessage(message) {
  const obj = message.toObject ? message.toObject() : message;
  return {
    id: obj._id.toString(),
    conversationId: obj.conversationId.toString(),
    senderId: obj.senderId.toString(),
    content: obj.isDeleted ? "" : obj.content,
    replyToMessageId: obj.replyToMessageId ? obj.replyToMessageId.toString() : null,
    reactions: (obj.reactions || []).map((r) => ({
      id: r._id.toString(),
      userId: r.userId.toString(),
      emoji: r.emoji,
    })),
    deliveredTo: (obj.deliveredTo || []).map((id) => id.toString()),
    readBy: (obj.readBy || []).map((r) => ({
      userId: r.userId.toString(),
      readAt: r.readAt,
    })),
    isEdited: obj.isEdited,
    isDeleted: obj.isDeleted,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
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

export async function listMessages({ conversationId, userId, cursor, limit }) {
  await assertMembership(conversationId, userId);

  const filter = { conversationId };
  if (cursor) {
    if (!mongoose.Types.ObjectId.isValid(cursor)) {
      throw badRequest("Invalid cursor", "INVALID_CURSOR");
    }
    const cursorMsg = await Message.findById(cursor).select("createdAt");
    if (cursorMsg) {
      filter.createdAt = { $lt: cursorMsg.createdAt };
    }
  }

  // Fetch newest-first, then hand back ascending so the client can prepend.
  const docs = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  const messages = docs.reverse().map((m) => publicMessage(m));
  const nextCursor = docs.length === limit && messages.length > 0
    ? messages[0].id
    : null;

  return { messages, nextCursor };
}

export async function createMessage({ conversationId, userId, content, replyToMessageId }) {
  await assertMembership(conversationId, userId);

  if (replyToMessageId) {
    if (!mongoose.Types.ObjectId.isValid(replyToMessageId)) {
      throw badRequest("Invalid replyToMessageId", "INVALID_REPLY");
    }
    const replyTo = await Message.findById(replyToMessageId).select("conversationId");
    if (!replyTo || replyTo.conversationId.toString() !== conversationId) {
      throw badRequest("Reply target is not in this conversation", "INVALID_REPLY");
    }
  }

  const message = await Message.create({
    conversationId,
    senderId: userId,
    content,
    replyToMessageId: replyToMessageId || null,
  });

  // Bump the conversation's activity timestamp for inbox ordering.
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: message.createdAt });

  const payload = publicMessage(message);
  emitToConversation(conversationId, "message:new", payload);
  return payload;
}

export async function editMessage({ messageId, userId, content }) {
  const message = await Message.findById(messageId);
  if (!message) throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  await assertMembership(message.conversationId.toString(), userId);

  if (message.senderId.toString() !== userId) {
    throw forbidden("You can only edit your own messages", "NOT_SENDER");
  }
  if (message.isDeleted) {
    throw badRequest("Cannot edit a deleted message", "ALREADY_DELETED");
  }

  message.content = content;
  message.isEdited = true;
  await message.save();

  const payload = publicMessage(message);
  emitToConversation(message.conversationId.toString(), "message:edited", payload);
  return payload;
}

export async function deleteMessage({ messageId, userId }) {
  const message = await Message.findById(messageId);
  if (!message) throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  await assertMembership(message.conversationId.toString(), userId);

  if (message.senderId.toString() !== userId) {
    throw forbidden("You can only delete your own messages", "NOT_SENDER");
  }

  message.isDeleted = true;
  message.content = "";
  message.reactions = [];
  await message.save();

  const payload = publicMessage(message);
  emitToConversation(message.conversationId.toString(), "message:deleted", payload);
  return payload;
}

// Toggle a reaction: if the user already reacted with the same emoji, remove it;
// otherwise add it. Returns the updated reactions array.
export async function toggleReaction({ messageId, userId, emoji }) {
  const message = await Message.findById(messageId);
  if (!message) throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  await assertMembership(message.conversationId.toString(), userId);
  if (message.isDeleted) {
    throw badRequest("Cannot react to a deleted message", "ALREADY_DELETED");
  }

  const existing = message.reactions.find(
    (r) => r.userId.toString() === userId && r.emoji === emoji
  );

  if (existing) {
    message.reactions = message.reactions.filter(
      (r) => !(r.userId.toString() === userId && r.emoji === emoji)
    );
  } else {
    message.reactions.push({ userId, emoji });
  }
  await message.save();

  const payload = { messageId: message._id.toString(), reactions: publicMessage(message).reactions };
  emitToConversation(message.conversationId.toString(), "message:reaction", payload);
  return payload.reactions;
}

export async function removeReaction({ messageId, userId, reactionId }) {
  const message = await Message.findById(messageId);
  if (!message) throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  await assertMembership(message.conversationId.toString(), userId);

  const reaction = message.reactions.find((r) => r._id.toString() === reactionId);
  if (!reaction) throw notFound("Reaction not found", "REACTION_NOT_FOUND");
  if (reaction.userId.toString() !== userId) {
    throw forbidden("You can only remove your own reactions", "NOT_OWNER");
  }

  message.reactions = message.reactions.filter((r) => r._id.toString() !== reactionId);
  await message.save();

  const payload = { messageId: message._id.toString(), reactions: publicMessage(message).reactions };
  emitToConversation(message.conversationId.toString(), "message:reaction", payload);
  return payload.reactions;
}

// Mark all messages in a conversation (up to an optional message id) as read by
// the current user. Emits a single read receipt to the room.
export async function markRead({ conversationId, userId, upToMessageId }) {
  await assertMembership(conversationId, userId);

  const filter = {
    conversationId,
    senderId: { $ne: userId },
    readBy: { $not: { $elemMatch: { userId } } },
  };
  if (upToMessageId) {
    if (!mongoose.Types.ObjectId.isValid(upToMessageId)) {
      throw badRequest("Invalid upToMessageId", "INVALID_CURSOR");
    }
    const upTo = await Message.findById(upToMessageId).select("createdAt");
    if (upTo) filter.createdAt = { $lte: upTo.createdAt };
  }

  const result = await Message.updateMany(filter, {
    $addToSet: { readBy: { userId, readAt: new Date() } },
  });

  const payload = {
    conversationId,
    userId,
    readCount: result.modifiedCount || 0,
  };
  emitToConversation(conversationId, "message:read", payload);
  return payload;
}
