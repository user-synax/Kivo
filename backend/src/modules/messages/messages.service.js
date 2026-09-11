import mongoose from "mongoose";
import { unauthorized, forbidden, notFound, badRequest } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import Space from "../../models/Space.js";
import CustomEmoji from "../../models/CustomEmoji.js";
import { getRequesterPlan } from "../../lib/plus.js";
import { emitToConversation, roomName } from "../../socket/io.js";
import * as notificationsService from "../notifications/notifications.service.js";

function genPollOptionId() {
  return Math.random().toString(36).slice(2, 8);
}

function isPollExpired(poll) {
  if (!poll || !poll.expiresAt) return false;
  return new Date(poll.expiresAt).getTime() < Date.now();
}

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
  // compute viewer's vote selections for poll (even if anonymous, viewer sees own picks)
  let viewerVotes = [];
  if (obj.poll && viewerId) {
    for (const opt of obj.poll.options || []) {
      if ((opt.voters || []).some((v) => v.toString() === viewerId.toString())) viewerVotes.push(opt.id);
    }
  }
  const isDeleted = !!obj.isDeleted;
  const base = {
    id: obj._id.toString(),
    conversationId: obj.conversationId.toString(),
    senderId: obj.senderId.toString(),
    type: obj.type || "text",
    content: isDeleted ? "" : obj.content,
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
    status: obj.status || "sent",
    scheduledAt: obj.scheduledAt ? new Date(obj.scheduledAt).toISOString() : null,
    forwardCount: obj.forwardCount || 0,
    isFrequentlyForwarded: (obj.forwardCount || 0) >= 3,
    editHistory: (obj.editHistory || []).map((h) => ({
      content: h.content,
      editedAt: h.editedAt ? new Date(h.editedAt).toISOString() : null,
      editedBy: h.editedBy ? h.editedBy.toString() : null,
    })),
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    poll: !isDeleted && obj.poll
      ? {
          question: obj.poll.question,
          options: (obj.poll.options || []).map((o) => ({
            id: o.id,
            text: o.text,
            count: (o.voters || []).length,
            voters: obj.poll.anonymous ? [] : (o.voters || []).map((v) => v.toString()),
          })),
          allowMultiple: !!obj.poll.allowMultiple,
          anonymous: !!obj.poll.anonymous,
          expiresAt: obj.poll.expiresAt ? new Date(obj.poll.expiresAt).toISOString() : null,
          isClosed: !!obj.poll.isClosed,
          totalVotes: obj.poll.totalVotes || 0,
          createdBy: obj.poll.createdBy ? obj.poll.createdBy.toString() : null,
          viewerVotes,
          isExpired: obj.poll.expiresAt ? new Date(obj.poll.expiresAt).getTime() < Date.now() : false,
        }
      : null,
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
      status: { $ne: "scheduled" },
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
        status: { $ne: "scheduled" },
        createdAt: { $gt: anchorMsg.createdAt },
      })
        .sort({ createdAt: 1 })
        .limit(half)
        .lean(),
      // Messages created BEFORE (older than) the anchor, for context above it
      Message.find({
        conversationId,
        threadId: null,
        status: { $ne: "scheduled" },
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

  const filter = { conversationId, threadId: null, status: { $ne: "scheduled" } };
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

// Enforce personal emoji ownership: only owner can SEND :name: that is a personal emoji.
// Global/space emojis are open. This blocks `:otherPersonPersonal:` usage while still
// allowing recipients to SEE it when the owner sends it (they receive the rendered image
// via the message payload, no preloading needed beyond the owner's send).
const SHORTCODE_RE = /:([a-z0-9_]{2,32}):/g;
async function assertPersonalEmojiUsage(content, userId) {
  if (!content) return;
  const names = [...content.matchAll(SHORTCODE_RE)].map((m) => m[1].toLowerCase());
  if (names.length === 0) return;
  const uniqueNames = [...new Set(names)];
  const personalEmojis = await CustomEmoji.find({ name: { $in: uniqueNames }, ownerId: { $ne: null } })
    .select("name ownerId")
    .lean();
  if (personalEmojis.length === 0) return;
  const byName = new Map();
  for (const e of personalEmojis) {
    const key = e.name;
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(e.ownerId.toString());
  }
  for (const name of uniqueNames) {
    const owners = byName.get(name);
    if (!owners) continue; // not a personal emoji, it's global/space or unknown
    if (!owners.includes(userId.toString())) {
      throw forbidden(`You can only use your own personal emoji :${name}:`, "PERSONAL_EMOJI_FORBIDDEN");
    }
  }
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
  scheduledAt,
  poll,
}) {
  const conversation = await assertMembership(conversationId, userId);
  await assertDmNotBlocked(conversation, userId);

  // Poll handling — polls are exclusive: no content/attachments/forward/thread/reply mix (enforced by Zod, re-checked)
  if (poll) {
    if (scheduledAt) {
      throw badRequest("Scheduled polls not supported", "POLL_SCHEDULED");
    }
    if (replyToMessageId || threadId || forwardedFromId || (attachments && attachments.length)) {
      throw badRequest("Poll messages cannot carry attachments, forwards, threads or replies", "POLL_INVALID");
    }
    const { plan: senderPlan, limits: senderLimits } = await getRequesterPlan(User, userId);
    if (poll.options.length > senderLimits.pollOptionsMax) {
      if (senderPlan !== "plus") {
        throw forbidden(
          `Free polls allow up to ${senderLimits.pollOptionsMax} options — upgrade to Plus for ${senderLimits.pollOptionsMax + 3}`,
          "PLUS_REQUIRED",
        );
      }
      throw badRequest(`Too many options (max ${senderLimits.pollOptionsMax})`, "POLL_TOO_MANY_OPTIONS");
    }
    if (poll.allowMultiple && !senderLimits.pollAllowMultiple) {
      throw forbidden("Multiple-choice polls are Plus only", "PLUS_REQUIRED");
    }
    if (poll.anonymous && !senderLimits.pollAllowAnonymous) {
      throw forbidden("Anonymous polls are Plus only", "PLUS_REQUIRED");
    }
    let expiresAt = poll.expiresAt ? new Date(poll.expiresAt) : null;
    if (expiresAt) {
      if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
        throw badRequest("Invalid expiry", "POLL_BAD_EXPIRY");
      }
      const maxMs = senderLimits.pollDurationMaxMs;
      if (expiresAt.getTime() - Date.now() > maxMs) {
        if (senderPlan !== "plus") {
          throw forbidden("Free polls last up to 24h — Plus allows 7 days", "PLUS_REQUIRED");
        }
        throw badRequest("Expiry too far", "POLL_BAD_EXPIRY");
      }
    }
    // announcement guard: polls follow same rule as text posts
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
    // active poll cap per conversation
    const activePolls = await Message.countDocuments({
      conversationId,
      type: "poll",
      isDeleted: false,
      "poll.isClosed": false,
      $or: [{ "poll.expiresAt": null }, { "poll.expiresAt": { $gt: new Date() } }],
    });
    if (activePolls >= senderLimits.pollsPerConversationActive) {
      if (senderPlan !== "plus") {
        throw forbidden(`Free chats hold ${senderLimits.pollsPerConversationActive} active polls — upgrade to Plus`, "PLUS_REQUIRED");
      }
      throw badRequest("Too many active polls", "POLL_LIMIT");
    }
    const pollDoc = {
      question: poll.question.trim(),
      options: poll.options.map((t) => ({ id: genPollOptionId(), text: t.trim(), voters: [] })),
      allowMultiple: !!poll.allowMultiple,
      anonymous: !!poll.anonymous,
      expiresAt,
      isClosed: false,
      totalVotes: 0,
      createdBy: new mongoose.Types.ObjectId(userId),
    };
    const message = await Message.create({
      conversationId,
      senderId: userId,
      content: pollDoc.question,
      type: "poll",
      poll: pollDoc,
      replyToMessageId: null,
      threadId: null,
      mentions: [],
      attachments: [],
      audioDuration: null,
      forwardedFromId: null,
      forwardedFromName: null,
    });
    await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: message.createdAt });
    const payload = publicMessage(message, userId);
    emitToConversation(conversationId, "message:new", payload);
    notificationsService
      .createForMessage({ message, conversation, inThread: false })
      .catch((err) => console.error("[notifications] createForMessage failed:", err?.message || err));
    return payload;
  }

  // Per-plan send caps (server-side; zod allows the Plus max, we clamp here).
  const { plan: senderPlan, limits: senderLimits } = await getRequesterPlan(
    User,
    userId,
  );
  if (content && content.length > senderLimits.messageMaxLength) {
    if (senderPlan !== "plus") {
      throw forbidden(
        `Free messages hold up to ${senderLimits.messageMaxLength} characters — upgrade to Kivo Plus for ${senderLimits.messageMaxLength + 4000}`,
        "PLUS_REQUIRED",
      );
    }
    throw badRequest(
      `Message too long (max ${senderLimits.messageMaxLength} characters)`,
      "MESSAGE_TOO_LONG",
    );
  }
  if (
    attachments &&
    attachments.length > senderLimits.attachmentsPerMessage
  ) {
    if (senderPlan !== "plus") {
      throw forbidden(
        `Free plan allows up to ${senderLimits.attachmentsPerMessage} attachments per message — upgrade to Kivo Plus for more`,
        "PLUS_REQUIRED",
      );
    }
    throw badRequest(
      `Maximum ${senderLimits.attachmentsPerMessage} attachments per message`,
      "TOO_MANY_FILES",
    );
  }

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
  let forwardedSourceId = null;
  let forwardedSourceForwardCount = 0;
  if (forwardedFromId) {
    if (!mongoose.Types.ObjectId.isValid(forwardedFromId)) {
      throw badRequest("Invalid forwardedFromId", "INVALID_FORWARD");
    }
    const source = await Message.findById(forwardedFromId).select(
      "conversationId senderId content attachments audioDuration isDeleted type poll forwardCount",
    );
    if (!source || source.isDeleted) {
      throw notFound("Original message not found", "MESSAGE_NOT_FOUND");
    }
    if (source.type === "poll") {
      throw badRequest("Polls can't be forwarded yet", "POLL_FORWARD");
    }
    // Forward limit: free 5, Plus 10 — broadly forwarded guard
    const forwardLimit = senderLimits.forwardLimitPerMessage || 5;
    if ((source.forwardCount || 0) >= forwardLimit) {
      throw forbidden(`Forward limit reached (${forwardLimit}) - broadly forwarded`, "FORWARD_LIMIT");
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
    forwardedSourceId = source._id;
    forwardedSourceForwardCount = source.forwardCount || 0;
  } else {
    mentions = await resolveMentions(finalContent, conversation.participants);
  }

  // Personal emoji ownership check (skip for forwards — they copy source content)
  if (!forwardedFromId && finalContent) {
    await assertPersonalEmojiUsage(finalContent, userId);
  }

  if (scheduledAt) {
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) throw badRequest("Invalid scheduledAt", "BAD_SCHEDULED");
    if (when.getTime() <= Date.now()) throw badRequest("scheduledAt must be future", "BAD_SCHEDULED");
    if (when.getTime() - Date.now() > 30 * 24 * 60 * 60 * 1000) throw badRequest("max 30 days", "BAD_SCHEDULED");
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
      scheduledAt: when,
      status: "scheduled",
      forwardCount: forwardedFromId ? forwardedSourceForwardCount + 1 : 0,
    });
    if (forwardedSourceId) {
      const updatedSource = await Message.findByIdAndUpdate(
        forwardedSourceId,
        { $inc: { forwardCount: 1 } },
        { new: true },
      );
      if (updatedSource && (updatedSource.forwardCount || 0) >= 5) {
        emitToConversation(updatedSource.conversationId.toString(), "message:forward-limit", {
          messageId: updatedSource._id.toString(),
          forwardCount: updatedSource.forwardCount,
        });
      }
    }
    // do NOT bump lastMessageAt, do NOT emit message:new, do NOT notify
    return publicMessage(message, userId);
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
    status: "sent",
    scheduledAt: null,
    forwardCount: forwardedFromId ? forwardedSourceForwardCount + 1 : 0,
  });

  if (forwardedSourceId) {
    const updatedSource = await Message.findByIdAndUpdate(
      forwardedSourceId,
      { $inc: { forwardCount: 1 } },
      { new: true },
    );
    if (updatedSource && (updatedSource.forwardCount || 0) >= 5) {
      emitToConversation(updatedSource.conversationId.toString(), "message:forward-limit", {
        messageId: updatedSource._id.toString(),
        forwardCount: updatedSource.forwardCount,
      });
    }
  }

  // Bump the conversation's activity timestamp for inbox ordering.
  await Conversation.findByIdAndUpdate(conversationId, { lastMessageAt: message.createdAt });

  const payload = publicMessage(message);
  emitToConversation(conversationId, "message:new", payload);

  // Notifications + web push are fire-and-forget. Awaiting them here would make
  // the sender's POST wait on per-recipient notification inserts and VAPID HTTP
  // calls to offline members (hundreds of ms to seconds for busy groups). The
  // message is already stored, broadcast to the room, and returned immediately.
  notificationsService
    .createForMessage({ message, conversation, inThread })
    .catch((err) =>
      console.error("[notifications] createForMessage failed:", err?.message || err),
    );

  return payload;
}

export async function editMessage({ messageId, userId, content }) {
  const message = await Message.findById(messageId);
  if (!message) throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  if (message.type === "poll") throw badRequest("Polls can't be edited", "POLL_EDIT");
  const conversation = await assertMembership(message.conversationId.toString(), userId);
  await assertDmNotBlocked(conversation, userId);

  if (message.senderId.toString() !== userId) {
    throw forbidden("You can only edit your own messages", "NOT_SENDER");
  }
  if (message.isDeleted) {
    throw badRequest("Cannot edit a deleted message", "ALREADY_DELETED");
  }

  const { plan: editorPlan, limits: editorLimits } = await getRequesterPlan(
    User,
    userId,
  );
  if (content && content.length > editorLimits.messageMaxLength) {
    if (editorPlan !== "plus") {
      throw forbidden(
        `Free messages hold up to ${editorLimits.messageMaxLength} characters — upgrade to Kivo Plus for longer messages`,
        "PLUS_REQUIRED",
      );
    }
    throw badRequest(
      `Message too long (max ${editorLimits.messageMaxLength} characters)`,
      "MESSAGE_TOO_LONG",
    );
  }
  // Free edit window (15 min); Plus edits never expire.
  if (editorLimits.messageEditWindowMs != null && message.createdAt) {
    const age = Date.now() - new Date(message.createdAt).getTime();
    if (age > editorLimits.messageEditWindowMs) {
      throw forbidden(
        "Free edits close 15 minutes after sending — upgrade to Kivo Plus for unlimited edits",
        "PLUS_REQUIRED",
      );
    }
  }

  const mentionIds = await resolveMentions(content, conversation.participants);
  await assertPersonalEmojiUsage(content, userId);

  if (message.content !== content) {
    message.editHistory.push({ content: message.content, editedAt: new Date(), editedBy: new mongoose.Types.ObjectId(userId) });
    if (message.editHistory.length > 10) message.editHistory.shift();
  }
  message.content = content;
  message.isEdited = true;
  message.mentions = mentionIds;
  await message.save();

  const payload = publicMessage(message);
  emitToConversation(message.conversationId.toString(), "message:edited", payload);
  return payload;
}

export async function getEditHistory({messageId, userId}) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) throw badRequest("Invalid message id");
  const msg = await Message.findById(messageId).select("conversationId editHistory content isEdited senderId");
  if (!msg) throw notFound("Message not found");
  await assertMembership(msg.conversationId.toString(), userId);
  return (msg.editHistory || []).map(h=>({content:h.content, editedAt:h.editedAt, editedBy:h.editedBy ? h.editedBy.toString() : null}));
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
// Per-plan cap: free 10 pins/conversation, Plus 50.
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

  if (pinned && !message.pinnedAt) {
    const { plan, limits } = await getRequesterPlan(User, userId);
    const pinCount = await Message.countDocuments({
      conversationId: message.conversationId,
      threadId: null,
      pinnedAt: { $ne: null },
      isDeleted: false,
    });
    if (pinCount >= limits.pinsPerConversation) {
      if (plan !== "plus") {
        throw forbidden(
          `Free chats hold ${limits.pinsPerConversation} pins — upgrade to Kivo Plus for ${limits.pinsPerConversation + 40}`,
          "PLUS_REQUIRED",
        );
      }
      throw badRequest(
        `This chat holds up to ${limits.pinsPerConversation} pins`,
        "PIN_LIMIT",
      );
    }
  }

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

// Pinned messages for the conversation banner, newest pin first.
// Cap follows the viewer's tier (free 10, Plus 50).
export async function listPinned({ conversationId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw badRequest("Invalid conversation id", "INVALID_ID");
  }
  await assertMembership(conversationId, userId);
  const { limits } = await getRequesterPlan(User, userId);
  const docs = await Message.find({
    conversationId,
    threadId: null,
    pinnedAt: { $ne: null },
    isDeleted: false,
  })
    .sort({ pinnedAt: -1 })
    .limit(limits.pinsPerConversation)
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
    if (!already) {
      const { plan, limits } = await getRequesterPlan(User, userId);
      const savedCount = await Message.countDocuments({
        "savedBy.userId": uid,
        isDeleted: false,
      });
      if (savedCount >= limits.savedMax) {
        if (plan !== "plus") {
          throw forbidden(
            `Free plan holds ${limits.savedMax} saved messages — upgrade to Kivo Plus for ${limits.savedMax + 800}`,
            "PLUS_REQUIRED",
          );
        }
        throw badRequest(
          `You hold the maximum ${limits.savedMax} saved messages`,
          "SAVE_LIMIT",
        );
      }
      message.savedBy.push({ userId: uid });
    }
  } else {
    message.savedBy = message.savedBy.filter(
      (s) => s.userId.toString() !== userId,
    );
  }
  await message.save();

  return publicMessage(message, userId);
}

// The current user's Saved messages across every conversation they're still in,
// newest save first. Cap follows the viewer's tier (free 200, Plus 1000).
export async function listSaved({ userId }) {
  const conversations = await Conversation.find({ participants: userId })
    .select("_id")
    .lean();
  if (!conversations.length) return [];
  const convIds = conversations.map((c) => c._id);
  const uid = new mongoose.Types.ObjectId(userId);
  const { limits } = await getRequesterPlan(User, userId);

  const docs = await Message.find({
    conversationId: { $in: convIds },
    isDeleted: false,
    "savedBy.userId": uid,
  })
    .sort({ createdAt: -1 })
    .limit(limits.savedMax)
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
    .slice(0, limits.savedMax);

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
  if (message.type === "poll") {
    throw badRequest("Polls can't be reacted to", "POLL_REACTION");
  }

  // Custom emoji reactions: validate the referenced emoji exists + ownership
  if (emoji.startsWith("custom:")) {
    const cid = emoji.slice(7);
    if (!mongoose.Types.ObjectId.isValid(cid)) {
      throw badRequest("Invalid custom emoji", "INVALID_EMOJI");
    }
    const exists = await CustomEmoji.findById(cid).select("_id ownerId").lean();
    if (!exists) throw notFound("Custom emoji not found", "EMOJI_NOT_FOUND");
    if (exists.ownerId && exists.ownerId.toString() !== userId.toString()) {
      throw forbidden("You can only use your own personal emoji", "PERSONAL_EMOJI_FORBIDDEN");
    }
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

export async function votePoll({ messageId, userId, optionIds }) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) throw badRequest("Invalid message id", "INVALID_ID");
  const message = await Message.findById(messageId);
  if (!message || message.isDeleted) throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  if (message.type !== "poll" || !message.poll) throw badRequest("Not a poll", "NOT_POLL");
  await assertMembership(message.conversationId.toString(), userId);
  const conv = await Conversation.findById(message.conversationId).select("type participants");
  await assertDmNotBlocked(conv, userId);
  if (message.poll.isClosed) throw badRequest("Poll is closed", "POLL_CLOSED");
  if (isPollExpired(message.poll)) {
    message.poll.isClosed = true;
    message.markModified("poll");
    await message.save();
    throw badRequest("Poll has expired", "POLL_EXPIRED");
  }
  const { limits } = await getRequesterPlan(User, userId);
  const validIds = new Set(message.poll.options.map((o) => o.id));
  const deduped = [...new Set(optionIds)];
  for (const id of deduped) if (!validIds.has(id)) throw badRequest("Invalid option", "POLL_BAD_OPTION");
  if (!message.poll.allowMultiple && deduped.length !== 1) throw badRequest("Pick exactly one option", "POLL_SINGLE_CHOICE");
  if (deduped.length > 1 && !limits.pollAllowMultiple) throw forbidden("Multiple-choice is Plus only", "PLUS_REQUIRED");
  // remove existing votes for this user across all options
  let totalVotes = message.poll.totalVotes || 0;
  for (const opt of message.poll.options) {
    const had = opt.voters.some((v) => v.toString() === userId.toString());
    if (had) {
      opt.voters = opt.voters.filter((v) => v.toString() !== userId.toString());
      totalVotes -= 1;
    }
  }
  // add new votes
  for (const id of deduped) {
    const opt = message.poll.options.find((o) => o.id === id);
    opt.voters.push(new mongoose.Types.ObjectId(userId));
    totalVotes += 1;
  }
  message.poll.totalVotes = totalVotes;
  message.markModified("poll");
  await message.save();
  const payload = publicMessage(message);
  emitToConversation(message.conversationId.toString(), "poll:updated", payload);
  return payload;
}

export async function retractVote({ messageId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) throw badRequest("Invalid message id", "INVALID_ID");
  const message = await Message.findById(messageId);
  if (!message || message.isDeleted) throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  if (message.type !== "poll" || !message.poll) throw badRequest("Not a poll", "NOT_POLL");
  await assertMembership(message.conversationId.toString(), userId);
  if (message.poll.isClosed || isPollExpired(message.poll)) throw badRequest("Poll is closed", "POLL_CLOSED");
  let removed = 0;
  for (const opt of message.poll.options) {
    const before = opt.voters.length;
    opt.voters = opt.voters.filter((v) => v.toString() !== userId.toString());
    removed += before - opt.voters.length;
  }
  message.poll.totalVotes = Math.max(0, (message.poll.totalVotes || 0) - removed);
  message.markModified("poll");
  await message.save();
  const payload = publicMessage(message);
  emitToConversation(message.conversationId.toString(), "poll:updated", payload);
  return payload;
}

export async function endPoll({ messageId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) throw badRequest("Invalid message id", "INVALID_ID");
  const message = await Message.findById(messageId);
  if (!message || message.isDeleted) throw notFound("Message not found", "MESSAGE_NOT_FOUND");
  if (message.type !== "poll" || !message.poll) throw badRequest("Not a poll", "NOT_POLL");
  await assertMembership(message.conversationId.toString(), userId);
  const isCreator = message.senderId.toString() === userId.toString();
  let isAdmin = false;
  const conv = await Conversation.findById(message.conversationId).select(
    "type admins createdBy spaceId channelId participants",
  );
  if (conv.type === "group") isAdmin = conv.admins.some((a) => a.toString() === userId.toString());
  if (conv.type === "space_channel" && conv.spaceId) {
    const space = await Space.findById(conv.spaceId).select("members");
    const member = space?.members.find((m) => m.userId.toString() === userId.toString());
    if (member && ["owner", "admin"].includes(member.role)) isAdmin = true;
  }
  if (!isCreator && !isAdmin) throw forbidden("Only the poll creator or an admin can end it", "NOT_ALLOWED");
  if (message.poll.isClosed) return publicMessage(message, userId);
  message.poll.isClosed = true;
  message.markModified("poll");
  await message.save();
  const payload = publicMessage(message);
  emitToConversation(message.conversationId.toString(), "poll:ended", payload);
  return payload;
}

export async function closeExpiredPolls() {
  const now = new Date();
  const expired = await Message.find({
    type: "poll",
    isDeleted: false,
    "poll.isClosed": false,
    "poll.expiresAt": { $ne: null, $lte: now },
  }).limit(100);
  for (const msg of expired) {
    msg.poll.isClosed = true;
    msg.markModified("poll");
    await msg.save();
    emitToConversation(msg.conversationId.toString(), "poll:ended", publicMessage(msg));
  }
  return expired.length;
}

export async function listScheduled({ conversationId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw badRequest("Invalid conversation id", "INVALID_ID");
  }
  await assertMembership(conversationId, userId);
  const docs = await Message.find({
    conversationId,
    status: "scheduled",
    senderId: userId,
  })
    .sort({ scheduledAt: 1 })
    .lean();
  return docs.map((m) => publicMessage(m, userId));
}

export async function deliverScheduled() {
  const now = new Date();
  const due = await Message.find({
    status: "scheduled",
    scheduledAt: { $lte: now },
  }).limit(50);
  for (const msg of due) {
    msg.status = "sent";
    await msg.save();
    await Conversation.findByIdAndUpdate(msg.conversationId, {
      lastMessageAt: msg.createdAt,
    });
    const payload = publicMessage(msg);
    emitToConversation(msg.conversationId.toString(), "message:new", payload);
    // fire-and-forget notifications for delivered scheduled message
    try {
      const conv2 = await Conversation.findById(msg.conversationId);
      if (conv2) {
        notificationsService
          .createForMessage({ message: msg, conversation: conv2, inThread: !!msg.threadId })
          .catch(() => {});
      }
    } catch {}
  }
  return due.length;
}

export async function cancelScheduled({ messageId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    throw badRequest("Invalid message id", "INVALID_ID");
  }
  const msg = await Message.findById(messageId);
  if (!msg || msg.status !== "scheduled") throw notFound("Scheduled message not found", "SCHEDULED_NOT_FOUND");
  if (msg.senderId.toString() !== userId.toString()) throw forbidden("Not sender", "NOT_SENDER");
  await msg.deleteOne();
  emitToConversation(msg.conversationId.toString(), "message:scheduled-cancel", {
    messageId: msg._id.toString(),
  });
  return { ok: true };
}
