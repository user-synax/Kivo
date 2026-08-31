import mongoose from "mongoose";
import Notification from "../../models/Notification.js";
import PushSubscription from "../../models/PushSubscription.js";
import User from "../../models/User.js";
import { badRequest } from "../../utils/errors.js";
import { getIO } from "../../socket/index.js";
import { emitToUser } from "../../socket/io.js";
import webpush from "../../config/webpush.js";

function publicNotification(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id.toString(),
    recipientId: obj.recipientId.toString(),
    senderId: obj.senderId ? obj.senderId.toString() : null,
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

async function sendWebPushToUser(recipientId, pushPayload, doc) {
  // Only called when recipient is offline — fetch their push subscriptions and
  // attempt delivery. Expired/unsubscribed endpoints (404/410) are cleaned up.
  // Updates doc.delivery.pushDelivered/pushError and persists via doc.save().
  try {
    const subs = await PushSubscription.find({ userId: recipientId }).lean();
    if (!subs.length) {
      doc.delivery.pushError = "No subscriptions";
      await doc.save();
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

    doc.delivery.pushDelivered = anySuccess;
    doc.delivery.pushError = anySuccess ? null : lastError;
    await doc.save();
  } catch (err) {
    try {
      doc.delivery.pushError = err?.message || String(err);
      await doc.save();
    } catch {}
  }
}

/**
 * Create notifications for a newly created message.
 * Skips system messages and self-notify. Fans out 1 doc per recipient for group/space.
 */
export async function createForMessage({ message, conversation }) {
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
  const created = [];

  for (const recipientId of recipientIds) {
    if (!mongoose.Types.ObjectId.isValid(recipientId)) continue;

    const isMentioned = mentions.includes(recipientId);
    const recipientNotifType = isMentioned ? "mention" : notifType;

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

    const doc = await Notification.create({
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
        inAppDelivered: false,
        pushDelivered: false,
        pushError: null,
      },
    });

    // Deliver in-app if online; otherwise attempt Web Push (Phase 2)
    const isOnline = io && io.isUserOnline && io.isUserOnline(recipientId);
    if (isOnline) {
      try {
        const payload = publicNotification(doc);
        emitToUser(recipientId, "notification:new", payload);
        doc.delivery.inAppDelivered = true;
        await doc.save();
      } catch {
        // non-fatal: leave inAppDelivered false
      }
    } else {
      // Offline — fan out to stored push subscriptions, non-blocking for caller
      // but awaited here so delivery status is persisted before return. Wrapped so
      // push failures never break the message flow (see catch inside helper).
      const pushPayload = {
        title: recipientTitle,
        body,
        icon: avatarUrl || "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        data: {
          conversationId: conversation._id.toString(),
          notificationId: doc._id.toString(),
          type: recipientNotifType,
        },
      };
      try {
        await sendWebPushToUser(recipientId, pushPayload, doc);
      } catch {
        // helper already handles persistence; this is just a safety net
      }
    }

    created.push(publicNotification(doc));
  }

  return created;
}

export async function createFriendNotification({ recipientId, senderId, type, title, body, avatarUrl }) {
  const doc = await Notification.create({
    recipientId,
    senderId: senderId || null,
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
      await sendWebPushToUser(recipientId.toString(), pushPayload, doc);
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

export async function markAllRead({ userId }) {
  return markRead({ userId, all: true });
}
