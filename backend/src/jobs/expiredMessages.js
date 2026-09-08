import Message from "../models/Message.js";
import { emitToConversation } from "../socket/io.js";

export async function sweepExpired() {
  const now = new Date();
  const expired = await Message.find({
    isDeleted: false,
    expireAt: { $ne: null, $lte: now },
    status: "sent",
  }).limit(100);
  for (const m of expired) {
    m.isDeleted = true;
    m.content = "";
    m.reactions = [];
    m.pinnedAt = null;
    m.pinnedBy = null;
    await m.save();
    emitToConversation(m.conversationId.toString(), "message:expired", {
      messageId: m._id.toString(),
    });
  }
  return expired.length;
}

export function startExpiredJob() {
  const run = async () => {
    try {
      const n = await sweepExpired();
      if (n > 0) console.log(`[expired] swept ${n} message(s)`);
    } catch (err) {
      console.error("[expired] sweep failed:", err?.message || err);
    }
  };
  const timer = setInterval(() => {
    run().catch((e) => console.error("[expired] sweep failed", e?.message || e));
  }, 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
}
