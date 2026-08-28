import { unauthorized, notFound, conflict, badRequest } from "../../utils/errors.js";
import User from "../../models/User.js";
import FriendRequest from "../../models/FriendRequest.js";

// Public user shape returned in search/friend results.
function publicUser(user) {
  const u = user.toObject ? user.toObject() : user;
  return {
    id: u._id.toString(),
    displayName: u.displayName || null,
    username: u.username || null,
    email: u.email,
  };
}

// Relationship of `userId` -> `otherId` for UI hints: friends / outgoing request
// / incoming request / none.
async function relationship(userId, otherId) {
  const req = await FriendRequest.findOne({
    $or: [
      { from: userId, to: otherId },
      { from: otherId, to: userId },
    ],
  });
  if (!req) return "none";
  if (req.status === "accepted") return "friends";
  if (req.from.toString() === userId) return "outgoing";
  return "incoming";
}

export async function searchUsers({ userId, q }) {
  if (!q || q.trim().length === 0) return [];
  const trimmed = q.trim();
  const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const users = await User.find({
    _id: { $ne: userId },
    $or: [{ username: regex }, { email: regex }, { displayName: regex }],
  })
    .select("displayName username email")
    .limit(20)
    .lean();

  const withRel = await Promise.all(
    users.map(async (u) => ({
      ...publicUser(u),
      relationship: await relationship(userId, u._id.toString()),
    }))
  );
  return withRel;
}
