import crypto from "node:crypto";
import mongoose from "mongoose";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import env from "../../config/env.js";
import { badRequest, forbidden, notFound, unauthorized } from "../../utils/errors.js";
import Conversation from "../../models/Conversation.js";
import Message from "../../models/Message.js";
import User from "../../models/User.js";
import Notification from "../../models/Notification.js";
import { getIO } from "../../socket/index.js";
import { emitToConversation, emitToUser } from "../../socket/io.js";
import { getPreferences, publicNotification } from "../notifications/notifications.service.js";
import { publicMessage } from "../messages/messages.service.js";

// LiveKit Cloud credentials. Optional like Appwrite — the server boots without
// them; the token endpoint reports CALLS_NOT_CONFIGURED until they're set.
export function isCallsConfigured() {
  return Boolean(env.livekitUrl && env.livekitApiKey && env.livekitApiSecret);
}

// Room names are deterministic per conversation (`kivo_<id>`), not per call:
// anyone with a fresh token lands in the same room, so group members can
// join late and a reconnect rejoins cleanly. A stale room is just an empty
// room — harmless, and Cloud's empty-timeout reclaims it.
export function roomNameFor(conversationId) {
  return `kivo_${conversationId}`;
}

// Shared membership + safety checks for every call operation.
async function assertCallAllowed(conversationId, userId) {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw badRequest("Invalid conversation id", "INVALID_CONVERSATION");
  }
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    throw notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  }
  const participantIds = (conversation.participants || []).map((p) => p.toString());
  if (!participantIds.includes(userId)) {
    throw forbidden("You are not a participant of this conversation", "NOT_PARTICIPANT");
  }
  if (conversation.type === "space_channel") {
    throw forbidden("Calls are not available in Space channels yet", "NOT_ALLOWED");
  }
  const me = await User.findById(userId)
    .select("isBanned displayName username avatarUrl blockedUsers")
    .lean();
  if (!me) throw notFound("Account not found", "USER_NOT_FOUND");
  if (me.isBanned) throw unauthorized("This account has been suspended", "ACCOUNT_BANNED");

  // Blocked DMs can't ring: either direction blocks the call (mirrors the
  // composer block banner — no call buttons, no token).
  if (conversation.type === "dm") {
    const otherId = participantIds.find((id) => id !== userId);
    if (otherId) {
      const meBlocked = new Set((me.blockedUsers || []).map((id) => id.toString()));
      if (meBlocked.has(otherId)) {
        throw forbidden("You blocked this user", "CALL_BLOCKED");
      }
      const other = await User.findById(otherId).select("blockedUsers").lean();
      const themBlocked = new Set((other?.blockedUsers || []).map((id) => id.toString()));
      if (themBlocked.has(userId)) {
        throw forbidden("You can't call this user", "CALL_BLOCKED");
      }
    }
  }
  return { conversation, me, participantIds };
}

// Mint a short-lived LiveKit join token for a call room. Membership, ban,
// and block guards run on every mint (including mid-call token refresh), so a
// blocked/banned user can't rejoin by holding an old room name.
export async function issueCallToken({ userId, conversationId, kind }) {
  if (!isCallsConfigured()) {
    throw badRequest("Voice & video calls are not configured yet", "CALLS_NOT_CONFIGURED");
  }
  const { me } = await assertCallAllowed(conversationId, userId);
  const roomName = roomNameFor(conversationId);
  const callId = crypto.randomBytes(8).toString("hex");

  const at = new AccessToken(env.livekitApiKey, env.livekitApiSecret, {
    identity: userId,
    name: me.displayName || me.username || "Someone",
    // Long-lived join token: rejoin/late-join/group calls must not drop
    // mid-call for a refresh round-trip. Membership, ban, and block guards
    // run at every mint; a mid-call block takes effect on rejoin (v1 scope).
    ttl: "6h",
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await at.toJwt();
  return { token, url: env.livekitUrl, roomName, callId, kind };
}

// Validate a ring attempt before the socket layer broadcasts it. Returns the
// caller profile + participant list for the `call:ring` payload.
export async function assertRingAllowed({ userId, conversationId, kind }) {
  if (!isCallsConfigured()) {
    throw badRequest("Voice & video calls are not configured yet", "CALLS_NOT_CONFIGURED");
  }
  if (!["voice", "video"].includes(kind)) {
    throw badRequest("Invalid call kind", "INVALID_CALL_KIND");
  }
  const { conversation, me, participantIds } = await assertCallAllowed(conversationId, userId);
  return {
    conversation,
    participantIds,
    caller: {
      id: userId,
      displayName: me.displayName || null,
      username: me.username || null,
      avatarUrl: me.avatarUrl || null,
    },
  };
}

// Authoritative "is a call ongoing?" check straight from LiveKit Cloud —
// no server-side call state to go stale across restarts. Powers the
// "Ongoing call · Join" pill for late joiners.
export async function getCallStatus({ userId, conversationId }) {
  if (!isCallsConfigured()) {
    return { active: false, participantCount: 0 };
  }
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    throw badRequest("Invalid conversation id", "INVALID_CONVERSATION");
  }
  const conversation = await Conversation.findById(conversationId).select("participants");
  if (!conversation) {
    throw notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  }
  const participantIds = (conversation.participants || []).map((p) => p.toString());
  if (!participantIds.includes(userId)) {
    throw forbidden("You are not a participant of this conversation", "NOT_PARTICIPANT");
  }
  try {
    const svc = new RoomServiceClient(env.livekitUrl, env.livekitApiKey, env.livekitApiSecret);
    const participants = await svc.listParticipants(roomNameFor(conversationId));
    return {
      active: Array.isArray(participants) && participants.length > 0,
      participantCount: Array.isArray(participants) ? participants.length : 0,
    };
  } catch {
    return { active: false, participantCount: 0 };
  }
}

// ── Call history chips ─────────────────────────────────────────────────
// Call lifecycle renders as beautiful centered cards in the timeline (see
// `CallChip` on the client). Chips are plain system messages with a structured
// payload — no schema change:
//
//   📞CALL:<event>:<kind>:<durationSec>:<actorName>
//   event: started | cancelled | declined | missed | ended
//
// Deduped per callId+event so retries/echoes never double-log.
const CALL_CHIP_PREFIX = "📞CALL:";
const loggedCallChips = new Set();

function markChipLogged(callId, event) {
  if (!callId) return false;
  const key = `${callId}:${event}`;
  if (loggedCallChips.has(key)) return true;
  loggedCallChips.add(key);
  if (loggedCallChips.size > 1000) {
    const oldest = loggedCallChips.values().next().value;
    loggedCallChips.delete(oldest);
  }
  return false;
}

export function formatCallDuration(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

async function writeCallChip({ conversationId, senderId, callId, event, kind, durationSec, actorName }) {
  if (markChipLogged(callId, event)) return null;
  const dur = event === "ended" ? String(Math.max(0, Math.floor(Number(durationSec) || 0))) : "";
  const content = `${CALL_CHIP_PREFIX}${event}:${kind}:${dur}:${actorName || ""}`;
  const message = await Message.create({
    conversationId,
    senderId,
    content,
    type: "system",
  });
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessageAt: message.createdAt,
  });
  emitToConversation(conversationId, "message:new", publicMessage(message));
  return message;
}

async function actorDisplayName(userId) {
  try {
    const u = await User.findById(userId).select("displayName username").lean();
    return u?.displayName || u?.username || "Someone";
  } catch {
    return "Someone";
  }
}

export async function recordCallStarted({ conversationId, callerId, kind, callId }) {
  try {
    const conversation = await Conversation.findById(conversationId).select("_id").lean();
    if (!conversation) return;
    await writeCallChip({
      conversationId,
      senderId: callerId,
      callId,
      event: "started",
      kind,
      actorName: await actorDisplayName(callerId),
    });
  } catch (err) {
    console.error("[calls] started chip failed:", err?.message || err);
  }
}

export async function recordCallCancelled({ conversationId, callerId, kind, callId }) {
  try {
    const conversation = await Conversation.findById(conversationId).select("_id").lean();
    if (!conversation) return;
    await writeCallChip({
      conversationId,
      senderId: callerId,
      callId,
      event: "cancelled",
      kind,
      actorName: await actorDisplayName(callerId),
    });
  } catch (err) {
    console.error("[calls] cancelled chip failed:", err?.message || err);
  }
}

export async function recordCallDeclined({ conversationId, declinerId, kind, callId }) {
  try {
    const conversation = await Conversation.findById(conversationId).select("_id").lean();
    if (!conversation) return;
    await writeCallChip({
      conversationId,
      senderId: declinerId,
      callId,
      event: "declined",
      kind,
      actorName: await actorDisplayName(declinerId),
    });
  } catch (err) {
    console.error("[calls] declined chip failed:", err?.message || err);
  }
}

// Call end: DM → chip with the leaver's duration (deduped per call). Group →
// chip only when the room actually emptied (checked after a short delay so
// LiveKit disconnect propagation settles); the duration is the last leaver's
// time in the call.
export async function recordCallEnded({ conversationId, enderId, kind, callId, durationSec }) {
  try {
    const conversation = await Conversation.findById(conversationId).select("participants type").lean();
    if (!conversation) return;
    const write = () =>
      writeCallChip({
        conversationId,
        senderId: enderId,
        callId,
        event: "ended",
        kind,
        durationSec,
        actorName: null,
      });
    if (conversation.type !== "group") {
      await write();
      return;
    }
    setTimeout(async () => {
      try {
        if (!isCallsConfigured()) {
          await write();
          return;
        }
        const svc = new RoomServiceClient(env.livekitUrl, env.livekitApiKey, env.livekitApiSecret);
        const participants = await svc.listParticipants(roomNameFor(conversationId));
        if (!participants || participants.length === 0) await write();
      } catch (err) {
        console.error("[calls] group end check failed:", err?.message || err);
      }
    }, 3000);
  } catch (err) {
    console.error("[calls] ended chip failed:", err?.message || err);
  }
}
export async function recordMissedCall({ conversationId, callerId, kind, callId }) {
  const conversation = await Conversation.findById(conversationId).lean();
  if (!conversation) return;
  const label = kind === "video" ? "Missed video call" : "Missed voice call";

  try {
    await writeCallChip({
      conversationId,
      senderId: callerId,
      callId,
      event: "missed",
      kind,
      actorName: await actorDisplayName(callerId),
    });
  } catch (err) {
    console.error("[calls] missed-call chip failed:", err?.message || err);
  }

  const prefKey = conversation.type === "group" ? "groupMessages" : "directMessages";
  const recipients = (conversation.participants || [])
    .map((p) => p.toString())
    .filter((id) => id !== callerId);
  const io = getIO();
  await Promise.all(
    recipients.map(async (recipientId) => {
      try {
        const prefs = await getPreferences({ userId: recipientId });
        if (prefs[prefKey] === false) return;
        const doc = await Notification.create({
          recipientId,
          senderId: callerId,
          type: "missed_call",
          conversationId,
          title: label,
          body: "Tap to open the chat",
          read: false,
          seen: false,
          delivery: { inAppDelivered: false, pushDelivered: false, pushError: null },
        });
        const isOnline = io && io.isUserOnline && io.isUserOnline(recipientId);
        if (isOnline) {
          try {
            emitToUser(recipientId, "notification:new", publicNotification(doc));
            doc.delivery.inAppDelivered = true;
            await doc.save();
          } catch {}
        }
      } catch (err) {
        console.error("[calls] missed-call notification failed:", err?.message || err);
      }
    }),
  );
}
