import mongoose from "mongoose";
import Notification from "../../models/Notification.js";
import PushSubscription from "../../models/PushSubscription.js";
import User from "../../models/User.js";
import Space from "../../models/Space.js";
import { badRequest, forbidden, notFound } from "../../utils/errors.js";
import { getIO } from "../../socket/index.js";
import { emitToUser } from "../../socket/io.js";
import webpush from "../../config/webpush.js";

const DEFAULT_PREFS = {
  directMessages: true,
  groupMessages: true,
  mentions: true,
  friendRequests: true,
  spaceMessages: false,
  announcements: true,
};

function resolvePrefs(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFS };
  return {
    directMessages: typeof raw.directMessages === "boolean" ? raw.directMessages : DEFAULT_PREFS.directMessages,
    groupMessages: typeof raw.groupMessages === "boolean" ? raw.groupMessages : DEFAULT_PREFS.groupMessages,
    mentions: typeof raw.mentions === "boolean" ? raw.mentions : DEFAULT_PREFS.mentions,
    friendRequests: typeof raw.friendRequests === "boolean" ? raw.friendRequests : DEFAULT_PREFS.friendRequests,
    spaceMessages: typeof raw.spaceMessages === "boolean" ? raw.spaceMessages : DEFAULT_PREFS.spaceMessages,
    announcements: typeof raw.announcements === "boolean" ? raw.announcements : DEFAULT_PREFS.announcements,
  };
}

export function getDefaultPreferences() {
  return { ...DEFAULT_PREFS };
}

export async function getPreferences({ userId }) {
  const user = await User.findById(userId).select("notificationPreferences").lean();
  return resolvePrefs(user?.notificationPreferences);
}

export async function updatePreferences({ userId, patch }) {
  const current = await getPreferences({ userId });
  const next = { ...current };
  for (const key of Object.keys(DEFAULT_PREFS)) {
    if (patch[key] !== undefined) next[key] = Boolean(patch[key]);
  }
  await User.findByIdAndUpdate(userId, { $set: { notificationPreferences: next } });
  return next;
}

async function isAnnouncementChannel(conversation) {
  if (conversation.type !== "space_channel" || !conversation.spaceId || !conversation.channelId) return false;
  try {
    const space = await Space.findById(conversation.spaceId).select("channels").lean();
    if (!space) return false;
    const ch = (space.channels || []).find((c) => c._id.toString() === conversation.channelId.toString());
    return ch?.type === "announcement";
  } catch {
    return false;
  }
}

function resolveCategory({ convType, isAnnouncement }) {
  if (convType === "dm") return "directMessages";
  if (convType === "group") return "groupMessages";
  if (convType === "space_channel") return isAnnouncement ? "announcements" : "spaceMessages";
  return "directMessages";
}

export function publicNotification(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id.toString(),
    recipientId: obj.recipientId.toString(),
    senderId: obj.senderId ? obj.senderId.toString() : null,
    senderUsername: obj.senderUsername || null,
    type: obj.type,
    conversationId: obj.conversationId ? obj.conversationId.toString() : null,
    messageId: obj.messageId ? obj.messageId.toString() : null,
    spaceId: obj.spaceId ? obj.spaceId.toString() : null,
    title: obj.title,
    body: obj.body || "",
    avatarUrl: obj.avatarUrl || null,
    read: obj.read,
    seen: obj.seen,
    delivery: obj.delivery || { inAppDelivered: false, pushDelivered: false, pushError: null },
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

// Persist web-push delivery state onto a notification document by id.
// Notifications are now created via insertMany (plain docs), so delivery
// flags are updated with a targeted updateOne instead of a hydrated doc.save().
async function persistPushState(notificationId, patch) {
  try {
    await Notification.updateOne({ _id: notificationId }, { $set: patch });
  } catch (err) {
    console.error("[push] failed to persist delivery state:", err?.message || err);
  }
}

async function sendWebPushToUser(recipientId, pushPayload, notificationId) {
  // Only called when recipient is offline — fetch their push subscriptions and
  // attempt delivery. Expired/unsubscribed endpoints (404/410) are cleaned up.
  // Delivery status is persisted via persistPushState.
  try {
    const subs = await PushSubscription.find({ userId: recipientId }).lean();
    if (!subs.length) {
      await persistPushState(notificationId, {
        "delivery.pushDelivered": false,
        "delivery.pushError": "No subscriptions",
      });
      return;
    }

    let anySuccess = false;
    let lastError = null;

    const payloadStr = JSON.stringify(pushPayload);

    for (const sub of subs) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        expirationTime: sub.expirationTime || null,
      };
      try {
        await webpush.sendNotification(subscription, payloadStr);
        anySuccess = true;
      } catch (err) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) {
          try {
            await PushSubscription.deleteOne({ _id: sub._id });
          } catch {}
        }
        lastError = err?.message || String(err);
      }
    }

    await persistPushState(notificationId, {
      "delivery.pushDelivered": anySuccess,
      "delivery.pushError": anySuccess ? null : lastError,
    });
  } catch (err) {
    await persistPushState(notificationId, {
      "delivery.pushDelivered": false,
      "delivery.pushError": err?.message || String(err),
    });
  }
}

/**
 * Create notifications for a newly created message.
 * Skips system messages and self-notify. Fans out 1 doc per recipient for group/space.
 * Preference gate: resolves category and suppresses entirely if category OFF,
 * unless recipient is @mentioned (mentions override muted category, respects mentions pref).
 */
export async function createForMessage({ message, conversation, inThread = false }) {
  // Skip system messages
  if (message.type === "system") return [];

  const senderId = message.senderId?.toString?.() || message.senderId;
  const convType = conversation.type;
  let notifType;
  if (convType === "dm") notifType = "dm_message";
  else if (convType === "group") notifType = "group_message";
  else if (convType === "space_channel") notifType = "space_message";
  else notifType = "dm_message";

  // Resolve sender preview for title/body/avatarUrl
  let sender = null;
  try {
    sender = await User.findById(senderId).select("displayName username avatarUrl").lean();
  } catch {}

  const senderName = sender?.displayName || sender?.username || "Someone";
  const avatarUrl = sender?.avatarUrl || null;

  const mentions = (message.mentions || []).map((m) => m.toString());

  // For dm: single recipient, for group/space: all participants except sender
  const participants = (conversation.participants || []).map((p) => p.toString());
  const recipientIds = participants.filter((id) => id !== senderId);
  if (recipientIds.length === 0) return [];

  const defaultTitle =
    convType === "group" ? conversation.name || senderName : senderName;
  const body = (message.content || "").trim().slice(0, 120);

  const io = getIO();
  // Docs to insert — built in memory first so delivery state (in-app vs push)
  // is decided before the single insert below.
  const docs = [];

  // Resolve announcement vs regular once for space channels (gate needs category)
  const announcement = convType === "space_channel" ? await isAnnouncementChannel(conversation) : false;

  // Batch-load preferences for all recipients (single DB round-trip, single gate)
  const prefsMap = new Map();
  try {
    const users = await User.find({ _id: { $in: recipientIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) } })
      .select("notificationPreferences")
      .lean();
    for (const u of users) prefsMap.set(u._id.toString(), resolvePrefs(u.notificationPreferences));
  } catch {}

  for (const recipientId of recipientIds) {
    if (!mongoose.Types.ObjectId.isValid(recipientId)) continue;

    const isMentioned = mentions.includes(recipientId);
    // Thread replies never create category-level notifications — they don't
    // bump unread, so a category ping would point at an empty main timeline.
    // Mentions inside a thread still notify (that's the only thread ping).
    if (inThread && !isMentioned) continue;
    const recipientNotifType = isMentioned ? "mention" : notifType;

    // --- Preference gate (single shared point, before dispatch) ---
    const prefs = prefsMap.get(recipientId) || { ...DEFAULT_PREFS };
    if (isMentioned) {
      // Mentions override muted category, but respect mentions pref itself
      if (prefs.mentions === false) continue;
    } else {
      const category = resolveCategory({ convType, isAnnouncement: announcement });
      if (prefs[category] === false) continue;
    }

    // DM-focused suppression: don't create a notification if recipient is currently
    // viewing this DM with the sender (spec: "when user is on the dm do not send")
    if (recipientNotifType === "dm_message") {
      try {
        if (io && io.isUserFocusedOnConversation && io.isUserFocusedOnConversation(recipientId, String(conversation._id))) {
          continue;
        }
      } catch {}
    }

    const recipientTitle = isMentioned
      ? (convType === "group" || convType === "space_channel"
          ? `${senderName} mentioned you`
          : `${senderName} mentioned you`)
      : defaultTitle;

    // Pre-set the in-app flag from the online check above; push state is filled
    // in by the background delivery in Phase 3.
    const isOnline = Boolean(io && io.isUserOnline && io.isUserOnline(recipientId));

    docs.push({
      recipientId,
      senderId,
      type: recipientNotifType,
      conversationId: conversation._id,
      messageId: message._id,
      spaceId: conversation.spaceId || null,
      title: recipientTitle,
      body,
      avatarUrl,
      read: false,
      seen: false,
      delivery: {
        inAppDelivered: isOnline,
        pushDelivered: false,
        pushError: null,
      },
    });
  }

  if (docs.length === 0) return [];

  // Phase 2 — insert every recipient's notification in ONE round-trip (the old
  // loop did N sequential `await Notification.create(...)` calls).
  const createdDocs = await Notification.insertMany(docs);

  // Phase 3 — deliver. createForMessage is fire-and-forget from the message
  // send path, so web push never delays the sender's response: it runs as
  // detached background work and persists its own delivery state.
  const created = [];
  for (const doc of createdDocs) {
    if (doc.delivery.inAppDelivered) {
      // Recipient is online: emit over the live socket. No follow-up save is
      // needed — the flag was already persisted at insert time.
      try {
        emitToUser(doc.recipientId.toString(), "notification:new", publicNotification(doc));
      } catch {
        // non-fatal: a failed emit leaves the stored flag as-is
      }
    } else {
      // Recipient is offline — fan out to stored push subscriptions. Each call
      // is self-contained (fetches subscriptions, sends, persists results) and
      // intentionally NOT awaited so this function returns right away.
      const pushPayload = {
        title: doc.title,
        body: doc.body || "",
        icon: doc.avatarUrl || "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: {
          conversationId: conversation._id.toString(),
          notificationId: doc._id.toString(),
          type: doc.type,
        },
      };
      sendWebPushToUser(doc.recipientId.toString(), pushPayload, doc._id);
    }

    created.push(publicNotification(doc));
  }

  return created;
}

export async function createFriendNotification({ recipientId, senderId, type, title, body, avatarUrl, senderUsername }) {
  // Preference gate for friend request/accept notifications — suppress entirely
  // if friendRequests OFF. Other types (e.g. "wave") flow through ungated: they
  // are lightweight pings with their own server-side cooldown.
  if (type === "friend_request" || type === "friend_accept") {
    try {
      const prefs = await getPreferences({ userId: recipientId.toString() });
      if (prefs.friendRequests === false) return null;
    } catch {}
  }

  const doc = await Notification.create({
    recipientId,
    senderId: senderId || null,
    senderUsername: senderUsername || null,
    type,
    conversationId: null,
    messageId: null,
    spaceId: null,
    title,
    body: body || "",
    avatarUrl: avatarUrl || null,
    read: false,
    seen: false,
    delivery: {
      inAppDelivered: false,
      pushDelivered: false,
      pushError: null,
    },
  });

  const io = getIO();
  const isOnline = io && io.isUserOnline && io.isUserOnline(recipientId.toString());
  if (isOnline) {
    try {
      emitToUser(recipientId.toString(), "notification:new", publicNotification(doc));
      doc.delivery.inAppDelivered = true;
      await doc.save();
    } catch {}
  } else {
    const pushPayload = {
      title,
      body: body || "",
      icon: avatarUrl || "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: {
        notificationId: doc._id.toString(),
        type,
      },
    };
    try {
      await sendWebPushToUser(recipientId.toString(), pushPayload, doc._id);
    } catch {}
  }

  return publicNotification(doc);
}

export async function listNotifications({ userId, cursor, limit = 20, unreadOnly = false }) {
  const filter = { recipientId: new mongoose.Types.ObjectId(userId) };
  if (unreadOnly) filter.read = false;

  if (cursor) {
    if (!mongoose.Types.ObjectId.isValid(cursor)) {
      // invalid cursor -> ignore, return from start (or could throw). Use throw to surface validation
    } else {
      const cursorDoc = await Notification.findById(cursor).select("createdAt");
      if (cursorDoc) {
        filter.createdAt = { $lt: cursorDoc.createdAt };
      }
    }
  }

  const docs = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  const notifications = docs.map((d) => publicNotification(d));
  const nextCursor = docs.length === limit && notifications.length > 0 ? notifications[notifications.length - 1].id : null;
  return { notifications, nextCursor };
}

export async function unreadCount({ userId }) {
  const count = await Notification.countDocuments({
    recipientId: new mongoose.Types.ObjectId(userId),
    read: false,
  });
  return { count };
}

export async function markRead({ userId, ids, all }) {
  const uid = new mongoose.Types.ObjectId(userId);
  if (all) {
    const res = await Notification.updateMany({ recipientId: uid, read: false }, { $set: { read: true } });
    return { modifiedCount: res.modifiedCount || 0 };
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    throw badRequest("ids[] required when all is not true", "INVALID_IDS");
  }
  const invalid = ids.find((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalid) throw badRequest(`Invalid notification id: ${invalid}`, "INVALID_ID");
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const res = await Notification.updateMany(
    { _id: { $in: objectIds }, recipientId: uid },
    { $set: { read: true } }
  );
  return { modifiedCount: res.modifiedCount || 0 };
}

// Seconds a user must wait before waving the same person again. Client uses the
// returned cooldownSeconds to disable the button; server is authoritative.
const WAVE_COOLDOWN_SECONDS = 20;

/**
 * Send a friendly "wave" ping to another user's profile. Creates a `wave`
 * notification through the same delivery pipeline as friend events (in-app
 * when online, web push when offline). Guards: no self-waves, no waving
 * someone who blocked you, no wave spam (per-recipient cooldown).
 *
 * Returns { notification, cooldownSeconds, lastWaveAt } so the client can show
 * the right button state ("Waved" with a live lockout).
 */
export async function sendWave({ userId, targetId }) {
  const senderId = String(userId);
  const recipientId = String(targetId);

  if (!mongoose.Types.ObjectId.isValid(recipientId)) {
    throw badRequest("Invalid user id", "INVALID_ID");
  }
  if (senderId === recipientId) {
    throw badRequest("You can't wave at yourself", "SELF_WAVE");
  }

  const [sender, recipient] = await Promise.all([
    User.findById(senderId).select("displayName username avatarUrl").lean(),
    User.findById(recipientId).select("blockedUsers").lean(),
  ]);
  if (!recipient) throw notFound("User not found", "USER_NOT_FOUND");

  // Blocked both ways: you can't wave someone you blocked, and someone who
  // blocked you shouldn't receive your pings.
  const targetBlocksMe = (recipient.blockedUsers || [])
    .map((id) => String(id))
    .includes(senderId);
  if (targetBlocksMe) {
    throw forbidden(
      "You can't wave at this user",
      "WAVE_BLOCKED",
    );
  }
  if (sender) {
    const me = await User.findById(senderId).select("blockedUsers").lean();
    const iBlockTarget = (me?.blockedUsers || [])
      .map((id) => String(id))
      .includes(recipientId);
    if (iBlockTarget) {
      throw forbidden(
        "You can't wave at a user you blocked",
        "WAVE_BLOCKED",
      );
    }
  }

  // Cooldown: only one wave per recipient per window (spam guard).
  const lastWave = await Notification.findOne({
    senderId,
    recipientId,
    type: "wave",
  })
    .sort({ createdAt: -1 })
    .select("createdAt")
    .lean();
  if (lastWave?.createdAt) {
    const elapsed = (Date.now() - new Date(lastWave.createdAt).getTime()) / 1000;
    const remaining = Math.ceil(WAVE_COOLDOWN_SECONDS - elapsed);
    if (remaining > 0) {
      const err = badRequest(
        `You already waved — try again in ${remaining}s`,
        "WAVE_COOLDOWN",
      );
      err.extra = { cooldownSeconds: remaining, lastWaveAt: lastWave.createdAt };
      throw err;
    }
  }

  const senderName = sender?.displayName || sender?.username || "Someone";
  const doc = await createFriendNotification({
    recipientId,
    senderId,
    senderUsername: sender?.username || null,
    type: "wave",
    title: `${senderName} waved at you`,
    body: "👋",
    avatarUrl: sender?.avatarUrl || null,
  });

  return {
    notification: doc,
    cooldownSeconds: WAVE_COOLDOWN_SECONDS,
    lastWaveAt: new Date().toISOString(),
  };
}
