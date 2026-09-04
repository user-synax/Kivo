import mongoose from "mongoose";
import { unauthorized, forbidden, notFound, badRequest } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import Space from "../../models/Space.js";
import { emitToConversation, roomName } from "../../socket/io.js";
import * as notificationsService from "../notifications/notifications.service.js";

// Public message shape returned to clients and used as the socket payload base.
// When a viewer id is supplied the per-user `saved` flag (Saved messages) is
// resolved from savedBy — used by conversation-scoped list endpoints so bubble
// menus can show the right Save/Unsave state.
export function publicMessage(message, viewerId = null) {
  const obj = message.toObject ? message.toObject() : message;
  const saved =
    viewerId != null
      ? (obj.savedBy || []).some(
          (s) => (s.userId || s).toString() === viewerId.toString(),
        )
      : false;
  const base = {
    id: obj._id.toString(),
    conversationId: obj.conversationId.toString(),
    senderId: obj.senderId.toString(),
    type: obj.type || "text",
    content: obj.isDeleted ? "" : obj.content,
    replyToMessageId: obj.replyToMessageId ? obj.replyToMessageId.toString() : null,
    threadId: obj.threadId ? obj.threadId.toString() : null,
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
    audioDuration: obj.audioDuration || null,
    forwardedFromId: obj.forwardedFromId ? obj.forwardedFromId.toString() : null,
    forwardedFromName: obj.forwardedFromName || null,
    pinnedAt: obj.pinnedAt ? new Date(obj.pinnedAt).toISOString() : null,
    pinnedBy: obj.pinnedBy ? obj.pinnedBy.toString() : null,
    saved,
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

export async function listMessages({ conversationId, userId, cursor, around, after, limit }) {
  await assertMembership(conversationId, userId);

  // Catch-up fetch: messages newer than `after` (for reconnect gap-fill).
  // Reuses cursor infrastructure but traverses forward (ascending) and caps at limit.
  if (after) {
    if (!mongoose.Types.ObjectId.isValid(after)) {
      throw badRequest("Invalid after message id", "INVALID_CURSOR");
    }
    const anchorMsg = await Message.findById(after).select("createdAt conversationId");
    if (!anchorMsg) {
      throw notFound("Message not found", "MESSAGE_NOT_FOUND");
    }
    if (anchorMsg.conversationId.toString() !== String(conversationId)) {
      throw badRequest("Message is not in this conversation", "INVALID_MESSAGE");
    }
    const docs = await Message.find({
      conversationId,
      threadId: null,
      createdAt: { $gt: anchorMsg.createdAt },
    })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();
    const messages = docs.map((m) => publicMessage(m, userId));
    return { messages, nextCursor: null };
  }

  // Anchor-based fetch: return a page of messages centered around `around`.
  // Used by jump-to-message from search results.
  if (around) {
    if (!mongoose.Types.ObjectId.isValid(around)) {
      throw badRequest("Invalid around message id", "INVALID_CURSOR");
    }
    // Full document (no select): the anchor itself is included in the returned
    // page and mapped through publicMessage, so it must carry every field.
    const anchorMsg = await Message.findById(around);
    if (!anchorMsg) {
      throw notFound("Message not found", "MESSAGE_NOT_FOUND");
    }
    if (anchorMsg.conversationId.toString() !== String(conversationId)) {
      throw badRequest("Message is not in this conversation", "INVALID_MESSAGE");
    }
    // Fetch `limit` messages: half before the anchor, half after.
    const half = Math.ceil(limit / 2);
    const [before, after] = await Promise.all([
      // Messages created AFTER (newer than) the anchor, for context below it
      Message.find({
        conversationId,
        threadId: null,
        createdAt: { $gt: anchorMsg.createdAt },
      })
        .sort({ createdAt: 1 })
        .limit(half)
        .lean(),
      // Messages created BEFORE (older than) the anchor, for context above it
      Message.find({
        conversationId,
        threadId: null,
        createdAt: { $lt: anchorMsg.createdAt },
      })
        .sort({ createdAt: -1 })
        .limit(half)
        .lean(),
    ]);

    // Combine: older messages (reversed to ascending) + anchor + newer messages
    const olderReversed = [...after].reverse();
    const allDocs = [...olderReversed, anchorMsg.toObject(), ...before];
    const messages = allDocs.map((m) => publicMessage(m, userId));

    return { messages, nextCursor: null, anchorId: around };
  }

  const filter = { conversationId, threadId: null };
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

  const messages = docs.reverse().map((m) => publicMessage(m, userId));
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

export async function createMessage({
  conversationId,
  userId,
  content,
  replyToMessageId,
  threadId,
  attachments,
  audioDuration,
  forwardedFromId,
}) {
  const conversation = await assertMembership(conversationId, userId);
  await assertDmNotBlocked(conversation, userId);

  // Announcement channels: only owner/admin can post in the channel itself,
  // but ANY member can reply inside a thread under an announcement.
  const inThread = Boolean(threadId);
  if (conversation.type === "space_channel" && conversation.spaceId && conversation.channelId && !inThread) {
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
    const replyTo = await Message.findById(replyToMessageId).select("conversationId threadId");
    if (!replyTo || replyTo.conversationId.toString() !== conversationId) {
      throw badRequest("Reply target is not in this conversation", "INVALID_REPLY");
    }
    if (replyTo.threadId) {
      throw badRequest("Can't quote a thread reply in the main timeline", "THREAD_REPLY");
    }
  }

  // Thread reply: threadId must point at a live root message in THIS
  // conversation — the root is a normal (non-thread, non-system) message.
  if (inThread) {
    if (replyToMessageId || forwardedFromId) {
      throw badRequest("Thread replies can't also quote or forward", "INVALID_THREAD_REPLY");
    }
    if (!mongoose.Types.ObjectId.isValid(threadId)) {
      throw badRequest("Invalid threadId", "INVALID_THREAD");
    }
    const root = await Message.findById(threadId).select(
      "conversationId threadId type isDeleted",
    );
    if (
      !root ||
      root.conversationId.toString() !== conversationId ||
      root.threadId ||
      root.type !== "text" ||
      root.isDeleted
    ) {
      throw badRequest("Thread root not found in this conversation", "INVALID_THREAD");
    }
  }

  // Forwarding: copy the original message's content + attachments into the
  // target conversation and stamp the attribution pill. The forwarder must be a
  // participant of the SOURCE conversation; forwarded text never re-resolves
  // @mentions (so forwarding doesn't ping people in the target conversation).
  let mentions = [];
  let finalContent = content || "";
  let finalAttachments = attachments || [];
  let finalAudioDuration = audioDuration ?? null;
  let forwardedName = null;
  if (forwardedFromId) {
    if (!mongoose.Types.ObjectId.isValid(forwardedFromId)) {
      throw badRequest("Invalid forwardedFromId", "INVALID_FORWARD");
    }
    const source = await Message.findById(forwardedFromId).select(
      "conversationId senderId content attachments audioDuration isDeleted",
    );
    if (!source || source.isDeleted) {
      throw notFound("Original message not found", "MESSAGE_NOT_FOUND");
    }
    const sourceConv = await Conversation.findById(source.conversationId).select("participants");
    const sourceParticipants = (sourceConv?.participants || []).map((p) => p.toString());
    if (!sourceParticipants.includes(userId)) {
      throw forbidden("You can only forward messages from conversations you are in", "NOT_PARTICIPANT");
    }
    if (finalContent || finalAttachments.length) {
      throw badRequest("Forwarded messages cannot carry extra content", "INVALID_FORWARD");
    }
    const author = await User.findById(source.senderId).select("displayName username").lean();
    forwardedName = author?.displayName || author?.username || "Someone";
    finalContent = source.content || "";
    finalAttachments = (source.attachments || []).map((a) => ({
      fileId: a.fileId,
      bucketId: a.bucketId,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      kind: a.kind,
      url: a.url,
    }));
    // Forwarded voice messages keep their duration (a client-supplied value is
    // replaced, so a forward can't smuggle arbitrary duration data).
    finalAudioDuration = source.audioDuration ?? null;
  } else {
    mentions = await resolveMentions(finalContent, conversation.participants);
  }

  const message = await Message.create({
    conversationId,
    senderId: userId,
    content: finalContent,
    replyToMessageId: replyToMessageId || null,
    threadId: inThread ? threadId : null,
    mentions,
    attachments: finalAttachments,
    audioDuration: finalAudioDuration,
    forwardedFromId: forwardedFromId || null,
    forwardedFromName: forwardedName,
  });

  // Bump the conversation's activity timestamp for inbox ordering.
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: message.createdAt });

  const payload = publicMessage(message);
  emitToConversation(conversationId, "message:new", payload);

  // In-app notifications: fan out per recipient (Phase 1 only, no push).
  try {
    await notificationsService.createForMessage({ message, conversation, inThread });
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
  // A deleted message stops being pinned (and the banner refetches on the
  // message:deleted event).
  message.pinnedAt = null;
  message.pinnedBy = null;
  await message.save();

  const payload = publicMessage(message);
  emitToConversation(message.conversationId.toString(), "message:deleted", payload);
  return payload;
}

// Pin/unpin a message (any member). Emits `message:pin-updated` so open chats
// can refresh their pinned banner and the message's own pin state.
export async function pinMessage({ messageId, userId, pinned }) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw badRequest("Invalid message id", "INVALID_ID");
  }
  const message = await Message.findById(messageId);
  if (!message || message.isDeleted) {
    throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  }
  if (message.threadId) {
    throw badRequest("Thread replies can't be pinned", "THREAD_REPLY");
  }
  await assertMembership(message.conversationId.toString(), userId);

  message.pinnedAt = pinned ? new Date() : null;
  message.pinnedBy = pinned ? userId : null;
  await message.save();

  const payload = publicMessage(message);
  emitToConversation(message.conversationId.toString(), "message:pin-updated", {
    conversationId: message.conversationId.toString(),
    message: payload,
  });
  return payload;
}

// Pinned messages for the conversation banner, newest pin first (max 10).
export async function listPinned({ conversationId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw badRequest("Invalid conversation id", "INVALID_ID");
  }
  await assertMembership(conversationId, userId);
  const docs = await Message.find({
    conversationId,
    threadId: null,
    pinnedAt: { $ne: null },
    isDeleted: false,
  })
    .sort({ pinnedAt: -1 })
    .limit(10)
    .lean();
  return docs.map((m) => publicMessage(m, userId));
}

// Save / unsave a message for the current user (bookmark). Any message you can
// see can be saved — your own or others', main timeline or thread reply.
export async function toggleSave({ messageId, userId, saved }) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw badRequest("Invalid message id", "INVALID_ID");
  }
  const message = await Message.findById(messageId);
  if (!message || message.isDeleted) {
    throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  }
  if (message.type === "system") {
    throw badRequest("System messages can't be saved", "SYSTEM_MESSAGE");
  }
  const conversation = await assertMembership(message.conversationId.toString(), userId);
  await assertDmNotBlocked(conversation, userId);

  const uid = new mongoose.Types.ObjectId(userId);
  if (saved) {
    const already = message.savedBy.some((s) => s.userId.toString() === userId);
    if (!already) message.savedBy.push({ userId: uid });
  } else {
    message.savedBy = message.savedBy.filter(
      (s) => s.userId.toString() !== userId,
    );
  }
  await message.save();

  return publicMessage(message, userId);
}

// The current user's Saved messages across every conversation they're still in,
// newest save first. The client joins conversation labels/avatars from its own
// conversation list, so the payload stays flat: { message, savedAt }.
export async function listSaved({ userId }) {
  const conversations = await Conversation.find({ participants: userId })
    .select("_id")
    .lean();
  if (!conversations.length) return [];
  const convIds = conversations.map((c) => c._id);
  const uid = new mongoose.Types.ObjectId(userId);

  const docs = await Message.find({
    conversationId: { $in: convIds },
    isDeleted: false,
    "savedBy.userId": uid,
  })
    .sort({ createdAt: -1 })
    .limit(400)
    .lean();

  const items = docs
    .map((doc) => {
      const entry = (doc.savedBy || []).find(
        (s) => s.userId.toString() === userId,
      );
      return entry
        ? {
            message: publicMessage(doc, userId),
            savedAt: entry.savedAt || doc.createdAt,
          }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
    .slice(0, 200);

  return items;
}

// Every active thread in a conversation: root message + a small summary
// (reply count, last reply time, participants) so the main timeline can render
// "n replies" chips under roots. Roots with no replies yet have no thread row.
export async function listThreads({ conversationId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw badRequest("Invalid conversation id", "INVALID_ID");
  }
  await assertMembership(conversationId, userId);
  const cid = new mongoose.Types.ObjectId(conversationId);

  const threadIds = await Message.distinct("threadId", {
    conversationId: cid,
    threadId: { $ne: null },
  });
  if (!threadIds.length) return [];

  const roots = await Message.find({ _id: { $in: threadIds }, isDeleted: false })
    .sort({ createdAt: -1 })
    .lean();
  const rootIds = roots.map((r) => r._id);
  if (!rootIds.length) return [];

  const [counts, senders] = await Promise.all([
    Message.aggregate([
      {
        $match: {
          conversationId: cid,
          threadId: { $in: rootIds },
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$threadId",
          replyCount: { $sum: 1 },
          lastReplyAt: { $max: "$createdAt" },
        },
      },
    ]),
    // Most recent senders per thread (for participant chips), oldest-to-newest
    // so the push order mirrors activity.
    Message.aggregate([
      {
        $match: {
          conversationId: cid,
          threadId: { $in: rootIds },
          isDeleted: false,
        },
      },
      { $sort: { createdAt: 1 } },
      { $group: { _id: "$threadId", senderIds: { $push: "$senderId" } } },
    ]),
  ]);

  // Resolve participant display names in one round trip.
  const allSenderIds = [
    ...new Set(senders.flatMap((s) => (s.senderIds || []).map((id) => id.toString()))),
  ];
  const users = allSenderIds.length
    ? await User.find({ _id: { $in: allSenderIds } })
        .select("displayName username")
        .lean()
    : [];
  const nameById = new Map(users.map((u) => [u._id.toString(), u.displayName || u.username]));

  const countById = new Map(counts.map((c) => [c._id.toString(), c]));
  const sendersById = new Map(senders.map((s) => [s._id.toString(), s.senderIds]));

  return roots.map((root) => {
    const count = countById.get(root._id.toString()) || { replyCount: 0, lastReplyAt: null };
    const seen = new Set();
    const participantNames = [];
    for (const sid of sendersById.get(root._id.toString()) || []) {
      const key = sid.toString();
      if (!seen.has(key)) {
        seen.add(key);
        participantNames.push(nameById.get(key) || "Someone");
      }
      if (participantNames.length >= 3) break;
    }
    return {
      root: publicMessage(root, userId),
      summary: {
        replyCount: count.replyCount,
        lastReplyAt: count.lastReplyAt || null,
        participants: participantNames,
      },
    };
  })
    // A thread whose replies were all deleted is empty again — no chip to show.
    .filter((t) => t.summary.replyCount > 0);
}

// Full thread conversation for the side panel: the root message plus all of its
// replies, oldest first. The root itself is returned so the panel header can
// render without an extra fetch.
export async function listThreadMessages({ conversationId, threadId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw badRequest("Invalid conversation id", "INVALID_ID");
  }
  if (!mongoose.Types.ObjectId.isValid(threadId)) {
    throw badRequest("Invalid thread id", "INVALID_THREAD");
  }
  await assertMembership(conversationId, userId);

  const root = await Message.findById(threadId).select(
    "conversationId threadId type isDeleted",
  );
  if (
    !root ||
    root.conversationId.toString() !== conversationId ||
    root.threadId ||
    root.type !== "text"
  ) {
    throw badRequest("Thread root not found in this conversation", "INVALID_THREAD");
  }

  const rootDoc = await Message.findById(threadId).lean();
  const replies = await Message.find({ conversationId, threadId })
    .sort({ createdAt: 1 })
    .limit(500)
    .lean();
  return {
    root: publicMessage(rootDoc, userId),
    messages: replies.map((m) => publicMessage(m, userId)),
    hasMore: replies.length === 500,
  };
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
  let upToCreatedAt = null;
  if (upToMessageId) {
    if (!mongoose.Types.ObjectId.isValid(upToMessageId)) {
      throw badRequest("Invalid upToMessageId", "INVALID_CURSOR");
    }
    const upTo = await Message.findById(upToMessageId).select("createdAt");
    if (upTo) {
      filter.createdAt = { $lte: upTo.createdAt };
      upToCreatedAt = upTo.createdAt;
    }
  }

  const readAt = new Date();
  const result = await Message.updateMany(filter, {
    $addToSet: { readBy: { userId: uid, readAt } },
  });

  const payload = {
    conversationId,
    userId,
    readCount: result.modifiedCount || 0,
    // Anchor precision for read receipts: clients only mark messages up to
    // this point as read by the user (never newer ones). readAt is the moment
    // the server stamped the receipts so every client shows the same time.
    upToMessageId: upToMessageId && mongoose.Types.ObjectId.isValid(upToMessageId) ? upToMessageId : null,
    upToCreatedAt: upToCreatedAt ? new Date(upToCreatedAt).toISOString() : null,
    readAt: readAt.toISOString(),
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
      threadId: null,
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
