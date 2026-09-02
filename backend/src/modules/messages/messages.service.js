import mongoose from "mongoose";
import { unauthorized, forbidden, notFound, badRequest } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import Space from "../../models/Space.js";
import { emitToConversation, roomName } from "../../socket/io.js";
import * as notificationsService from "../notifications/notifications.service.js";

// Public message shape returned to clients and used as the socket payload base.
export function publicMessage(message) {
  const obj = message.toObject ? message.toObject() : message;
  const base = {
    id: obj._id.toString(),
    conversationId: obj.conversationId.toString(),
    senderId: obj.senderId.toString(),
    type: obj.type || "text",
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
    mentions: (obj.mentions || []).map((id) => id.toString()),
    attachments: (obj.attachments || []).map((a) => ({
      fileId: a.fileId,
      bucketId: a.bucketId,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      kind: a.kind,
      url: a.url,
    })),
    isEdited: obj.isEdited,
    isDeleted: obj.isDeleted,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
  return base;
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

async function assertDmNotBlocked(conversation, userId) {
  if (conversation.type !== "dm") return;
  const participantIds = conversation.participants.map((p) => p.toString());
  const otherId = participantIds.find((id) => id !== userId.toString());
  if (!otherId) return;
  const [me, other] = await Promise.all([
    User.findById(userId).select("blockedUsers").lean(),
    User.findById(otherId).select("blockedUsers").lean(),
  ]);
  const meBlocked = new Set((me?.blockedUsers || []).map((id) => id.toString()));
  const otherBlocked = new Set((other?.blockedUsers || []).map((id) => id.toString()));
  const isBlockedByMe = meBlocked.has(otherId.toString());
  const isBlockedByOther = otherBlocked.has(userId.toString());
  if (isBlockedByOther) {
    throw forbidden("The recipient has blocked you", "BLOCKED");
  }
  if (isBlockedByMe) {
    throw forbidden("You have blocked the recipient", "BLOCKED");
  }
}

export async function listMessages({ conversationId, userId, cursor, around, limit }) {
  await assertMembership(conversationId, userId);

  // Anchor-based fetch: return a page of messages centered around `around`.
  // Used by jump-to-message from search results.
  if (around) {
    if (!mongoose.Types.ObjectId.isValid(around)) {
      throw badRequest("Invalid around message id", "INVALID_CURSOR");
    }
    const anchorMsg = await Message.findById(around).select("createdAt");
    if (!anchorMsg) {
      throw notFound("Message not found", "MESSAGE_NOT_FOUND");
    }
    // Fetch `limit` messages: half before the anchor, half after.
    const half = Math.ceil(limit / 2);
    const [before, after] = await Promise.all([
      // Messages created AFTER (newer than) the anchor, for context below it
      Message.find({
        conversationId,
        createdAt: { $gt: anchorMsg.createdAt },
      })
        .sort({ createdAt: 1 })
        .limit(half)
        .lean(),
      // Messages created BEFORE (older than) the anchor, for context above it
      Message.find({
        conversationId,
        createdAt: { $lt: anchorMsg.createdAt },
      })
        .sort({ createdAt: -1 })
        .limit(half)
        .lean(),
    ]);

    // Combine: older messages (reversed to ascending) + anchor + newer messages
    const olderReversed = [...after].reverse();
    const allDocs = [...olderReversed, anchorMsg.toObject(), ...before];
    const messages = allDocs.map((m) => publicMessage(m));

    return { messages, nextCursor: null, anchorId: around };
  }

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

// Parse @username tokens from message content and resolve them against conversation participants.
async function resolveMentions(content, participantIds) {
  if (!content || !participantIds || participantIds.length === 0) return [];
  const matches = content.match(/@([a-zA-Z0-9_.-]+)/g);
  if (!matches) return [];

  const extractedUsernames = [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
  if (extractedUsernames.length === 0) return [];

  const users = await User.find({
    _id: { $in: participantIds },
    username: { $exists: true, $ne: null },
  })
    .select("_id username")
    .lean();

  const resolvedIds = [];
  for (const user of users) {
    if (user.username && extractedUsernames.includes(user.username.toLowerCase())) {
      resolvedIds.push(user._id);
    }
  }
  return resolvedIds;
}

export async function createMessage({ conversationId, userId, content, replyToMessageId, attachments }) {
  const conversation = await assertMembership(conversationId, userId);
  await assertDmNotBlocked(conversation, userId);

  // Announcement channels: only owner/admin can send
  if (conversation.type === "space_channel" && conversation.spaceId && conversation.channelId) {
    const space = await Space.findById(conversation.spaceId).select("members channels");
    if (space) {
      const ch = space.channels.id(conversation.channelId);
      if (ch && ch.type === "announcement") {
        const member = space.members.find((m) => m.userId.toString() === userId);
        if (!member || !["owner", "admin"].includes(member.role)) {
          throw forbidden("Only admins can post in announcement channels", "ANNOUNCEMENT_ONLY_ADMIN");
        }
      }
    }
  }

  if (replyToMessageId) {
    if (!mongoose.Types.ObjectId.isValid(replyToMessageId)) {
      throw badRequest("Invalid replyToMessageId", "INVALID_REPLY");
    }
    const replyTo = await Message.findById(replyToMessageId).select("conversationId");
    if (!replyTo || replyTo.conversationId.toString() !== conversationId) {
      throw badRequest("Reply target is not in this conversation", "INVALID_REPLY");
    }
  }

  const mentionIds = await resolveMentions(content, conversation.participants);

  const message = await Message.create({
    conversationId,
    senderId: userId,
    content: content || "",
    replyToMessageId: replyToMessageId || null,
    mentions: mentionIds,
    attachments: attachments || [],
  });

  // Bump the conversation's activity timestamp for inbox ordering.
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: message.createdAt });

  const payload = publicMessage(message);
  emitToConversation(conversationId, "message:new", payload);

  // In-app notifications: fan out per recipient (Phase 1 only, no push).
  try {
    await notificationsService.createForMessage({ message, conversation });
  } catch (err) {
    console.error("[notifications] createForMessage failed:", err?.message || err);
  }

  return payload;
}

export async function editMessage({ messageId, userId, content }) {
  const message = await Message.findById(messageId);
  if (!message) throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  const conversation = await assertMembership(message.conversationId.toString(), userId);
  await assertDmNotBlocked(conversation, userId);

  if (message.senderId.toString() !== userId) {
    throw forbidden("You can only edit your own messages", "NOT_SENDER");
  }
  if (message.isDeleted) {
    throw badRequest("Cannot edit a deleted message", "ALREADY_DELETED");
  }

  const mentionIds = await resolveMentions(content, conversation.participants);

  message.content = content;
  message.mentions = mentionIds;
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
  const conv = await assertMembership(message.conversationId.toString(), userId);
  await assertDmNotBlocked(conv, userId);
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

  // Cast to ObjectId explicitly: the stored senderId / readBy.userId are
  // ObjectIds, and a raw string in $ne / $elemMatch would fail to match,
  // causing updateMany to touch zero documents and reads to never persist.
  const uid = new mongoose.Types.ObjectId(userId);
  const cid = new mongoose.Types.ObjectId(conversationId);

  const filter = {
    conversationId: cid,
    senderId: { $ne: uid },
    readBy: { $not: { $elemMatch: { userId: uid } } },
  };
  if (upToMessageId) {
    if (!mongoose.Types.ObjectId.isValid(upToMessageId)) {
      throw badRequest("Invalid upToMessageId", "INVALID_CURSOR");
    }
    const upTo = await Message.findById(upToMessageId).select("createdAt");
    if (upTo) filter.createdAt = { $lte: upTo.createdAt };
  }

  const result = await Message.updateMany(filter, {
    $addToSet: { readBy: { userId: uid, readAt: new Date() } },
  });

  const payload = {
    conversationId,
    userId,
    readCount: result.modifiedCount || 0,
  };
  emitToConversation(conversationId, "message:read", payload);
  return payload;
}

// Mark a conversation as unread from a given message onward (or all if no id).
// Removes the user's read receipt from that message and all newer messages so
// the thread appears unread again and the separator re-appears.
export async function markUnread({ conversationId, userId, messageId }) {
  await assertMembership(conversationId, userId);

  const uid = new mongoose.Types.ObjectId(userId);
  const cid = new mongoose.Types.ObjectId(conversationId);

  let anchor = null;
  if (messageId) {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      throw badRequest("Invalid messageId", "INVALID_ID");
    }
    anchor = await Message.findById(messageId).select("conversationId createdAt");
    if (!anchor) throw notFound("Message not found", "MESSAGE_NOT_FOUND");
    if (anchor.conversationId.toString() !== cid.toString()) {
      throw badRequest("Message is not in this conversation", "INVALID_MESSAGE");
    }
  } else {
    // No anchor: use the newest message from others as the unread point
    anchor = await Message.findOne({
      conversationId: cid,
      senderId: { $ne: uid },
      type: { $ne: "system" },
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .select("createdAt");
    if (!anchor) {
      return { conversationId, userId, unreadCount: 0, anchorMessageId: null };
    }
  }

  const filter = {
    conversationId: cid,
    senderId: { $ne: uid },
    createdAt: { $gte: anchor.createdAt },
  };

  const result = await Message.updateMany(filter, {
    $pull: { readBy: { userId: uid } },
  });

  // Count remaining unread for this user in the conversation
  const unreadCount = await Message.countDocuments({
    conversationId: cid,
    senderId: { $ne: uid },
    type: { $ne: "system" },
    isDeleted: false,
    readBy: { $not: { $elemMatch: { userId: uid } } },
  });

  const payload = {
    conversationId,
    userId,
    unreadCount,
    anchorMessageId: messageId || anchor._id?.toString() || null,
    modifiedCount: result.modifiedCount || 0,
  };
  emitToConversation(conversationId, "message:unread", payload);
  // Also push an updated conversation-type event so sidebar badge updates live
  // (listConversations will count correctly on next fetch, but live push is nicer)
  return payload;
}
