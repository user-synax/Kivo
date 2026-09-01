import Conversation from "../../models/Conversation.js";
import MessageModel from "../../models/Message.js";
import User from "../../models/User.js";
import Space from "../../models/Space.js";
import { publicMessage } from "../messages/messages.service.js";

/**
 * Get all conversation IDs that the user has access to.
 * Includes: DMs, groups (where user is participant), and space channels
 * (where user is a member of the space).
 */
async function getUserConversationIds(userId) {
  // Direct conversations (DMs + groups)
  const conversations = await Conversation.find({ participants: userId })
    .select("_id")
    .lean();
  const convIds = conversations.map((c) => c._id);

  // Space channel conversations (user must be a member of the space)
  const spaces = await Space.find({ "members.userId": userId })
    .select("channels")
    .lean();

  // For each space, find conversations linked to its channels
  if (spaces.length > 0) {
    const spaceChannelConvs = await Conversation.find({
      type: "space_channel",
      $or: spaces.flatMap((s) =>
        (s.channels || []).map((ch) => ({
          spaceId: s._id,
          channelId: ch._id,
        }))
      ),
    })
      .select("_id")
      .lean();
    convIds.push(...spaceChannelConvs.map((c) => c._id));
  }

  return convIds;
}

/**
 * Search messages: uses MongoDB $text index on Message.content, always
 * pre-filtered by conversationId to ensure scoped access.
 */
async function searchMessages(userId, query, limit) {
  const convIds = await getUserConversationIds(userId);
  if (convIds.length === 0) return [];

  const regex = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i"
  );

  const docs = await MessageModel.find({
    conversationId: { $in: convIds },
    content: regex,
    isDeleted: false,
    type: "text",
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("senderId", "displayName username avatarUrl")
    .populate("conversationId", "name type participants")
    .lean();

  return docs.map((m) => {
    const msg = publicMessage(m);
    const sender = m.senderId;
    const conv = m.conversationId;
    return {
      ...msg,
      senderName: sender?.displayName || sender?.username || "Unknown",
      senderAvatarUrl: sender?.avatarUrl || null,
      conversationName: conv?.name || null,
      conversationType: conv?.type || null,
    };
  });
}

/**
 * Search users: case-insensitive regex prefix match on username/displayName.
 * Reuses the same approach as the existing friend-search in users.service.js.
 * Excludes the requesting user from results.
 */
async function searchUsers(userId, query, limit) {
  const regex = new RegExp(
    "^" + query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i"
  );
  const orClause = [
    { username: regex },
    { displayName: regex },
  ];
  // Also allow substring match for broader results
  const substringRegex = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i"
  );

  const users = await User.find({
    _id: { $ne: userId },
    $or: orClause,
  })
    .select("displayName username email avatarStyle avatarUrl")
    .limit(limit)
    .lean();

  // If prefix match yields fewer results, supplement with substring match
  let results = users;
  if (results.length < limit) {
    const existingIds = new Set(results.map((u) => u._id.toString()));
    const more = await User.find({
      _id: { $ne: userId },
      $or: [{ username: substringRegex }, { displayName: substringRegex }],
    })
      .select("displayName username email avatarStyle avatarUrl")
      .limit(limit * 2)
      .lean();
    for (const u of more) {
      if (!existingIds.has(u._id.toString()) && results.length < limit) {
        results.push(u);
        existingIds.add(u._id.toString());
      }
    }
  }

  return results.map((u) => ({
    id: u._id.toString(),
    displayName: u.displayName || null,
    username: u.username || null,
    avatarStyle: u.avatarStyle || null,
    avatarUrl: u.avatarUrl || null,
  }));
}

/**
 * Search spaces: match Space.name, scoped to spaces where the requesting
 * user is already a member (no public discovery in this pass).
 */
async function searchSpaces(userId, query, limit) {
  const regex = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "i"
  );

  const spaces = await Space.find({
    "members.userId": userId,
    name: regex,
  })
    .select("name slug category avatarUrl channels")
    .limit(limit)
    .lean();

  return spaces.map((s) => ({
    id: s._id.toString(),
    name: s.name,
    slug: s.slug,
    category: s.category,
    avatarUrl: s.avatarUrl || null,
    channelCount: (s.channels || []).length,
  }));
}

/**
 * Unified search across messages, users, and spaces.
 * All three categories run in parallel and resolve independently.
 */
export async function globalSearch({ userId, q, limit }) {
  const [messages, users, spaces] = await Promise.all([
    searchMessages(userId, q, limit),
    searchUsers(userId, q, limit),
    searchSpaces(userId, q, limit),
  ]);

  return { messages, users, spaces };
}
