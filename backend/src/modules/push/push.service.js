import PushSubscription from "../../models/PushSubscription.js";

export async function subscribe({ userId, endpoint, keys, expirationTime, userAgent }) {
  const normalizedExpiration = expirationTime ? new Date(expirationTime) : null;
  // Upsert by endpoint — a device's endpoint is globally unique, but we reassign
  // ownership to the currently authenticated user if it migrated.
  const doc = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      userId,
      endpoint,
      keys: { p256dh: keys.p256dh, auth: keys.auth },
      expirationTime: normalizedExpiration,
      userAgent: userAgent || null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    endpoint: doc.endpoint,
    expirationTime: doc.expirationTime,
  };
}

export async function unsubscribe({ userId, endpoint }) {
  const res = await PushSubscription.deleteOne({ userId, endpoint });
  return { deletedCount: res.deletedCount || 0 };
}

export async function listForUser(userId) {
  const docs = await PushSubscription.find({ userId }).lean();
  return docs;
}
