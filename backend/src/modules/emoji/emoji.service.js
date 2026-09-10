import mongoose from "mongoose";
import { ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { getStorageSafe } from "../../lib/appwrite.js";
import env from "../../config/env.js";
import CustomEmoji from "../../models/CustomEmoji.js";
import Space from "../../models/Space.js";
import User from "../../models/User.js";
import { badRequest, forbidden, notFound, conflict } from "../../utils/errors.js";
import { normalizeEmojiImage, assertEmojiMime, assertEmojiSize } from "../../lib/emoji-image.js";
import { emitToSpace } from "../../socket/io.js";
import { getRequesterPlan } from "../../lib/plus.js";

const MAX_PER_SPACE = 100;
const MAX_GLOBAL = 200;

// Get bucket id for emoji (dedicated bucket, fallback to attachments bucket)
function getEmojiBucketId() {
  return env.appwriteEmojiBucketId || env.appwriteAttachmentsBucketId || env.appwriteBucketId;
}

function getEmojiBucketOrThrow() {
  const bucketId = getEmojiBucketId();
  if (!bucketId) {
    throw Object.assign(
      new Error(
        "Emoji storage not configured. Set APPWRITE_EMOJI_BUCKET_ID or APPWRITE_ATTACHMENTS_BUCKET_ID in backend .env"
      ),
      { statusCode: 500, code: "BUCKET_NOT_CONFIGURED" }
    );
  }
  return bucketId;
}

function publicEmoji(doc) {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id.toString(),
    name: obj.name,
    spaceId: obj.spaceId ? obj.spaceId.toString() : null,
    ownerId: obj.ownerId ? obj.ownerId.toString() : null,
    url: obj.url,
    animated: Boolean(obj.animated),
    createdBy: obj.createdBy ? obj.createdBy.toString() : null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

// Check space permission: need owner/admin role
async function assertSpaceAdmin(spaceId, userId) {
  if (!mongoose.Types.ObjectId.isValid(spaceId)) {
    throw badRequest("Invalid space id", "INVALID_ID");
  }
  const space = await Space.findById(spaceId);
  if (!space) throw notFound("Space not found", "SPACE_NOT_FOUND");
  const member = space.members.find((m) => m.userId.toString() === userId);
  if (!member) throw forbidden("You are not a member of this space", "NOT_MEMBER");
  if (!["owner", "admin"].includes(member.role)) {
    throw forbidden("Only Space admins can manage emoji", "FORBIDDEN");
  }
  return space;
}

// Check if user is site admin (User.role === "admin")
async function isSiteAdmin(userId) {
  const user = await User.findById(userId).select("role").lean();
  return user?.role === "admin";
}

export async function listEmojis({ spaceId, userId }) {
  // Returns: global + (space if requested) + personal (own + all for rendering)
  // Personal emojis are Plus-only account-scoped but globally renderable so :name: works everywhere.
  let spaceEmojis = [];
  if (spaceId) {
    if (!mongoose.Types.ObjectId.isValid(spaceId)) {
      throw badRequest("Invalid spaceId", "INVALID_ID");
    }
    spaceEmojis = await CustomEmoji.find({ spaceId: new mongoose.Types.ObjectId(spaceId), ownerId: null })
      .select("name spaceId ownerId url animated createdBy createdAt updatedAt")
      .sort({ name: 1 })
      .lean();
  }

  // Global = spaceId null && ownerId null
  const globalEmojis = await CustomEmoji.find({ spaceId: null, ownerId: null })
    .select("name spaceId ownerId url animated createdBy createdAt updatedAt")
    .sort({ name: 1 })
    .lean();

  // Personal: all personal emojis are globally visible for rendering (so DM peers can see them).
  // Picker filters to own later; renderer uses full set. Keep payload tiny: 50/user max, so total stays small.
  const personalEmojis = await CustomEmoji.find({ ownerId: { $ne: null } })
    .select("name spaceId ownerId url animated createdBy createdAt updatedAt")
    .sort({ name: 1 })
    .limit(500)
    .lean();

  const all = spaceId ? [...globalEmojis, ...spaceEmojis, ...personalEmojis] : [...globalEmojis, ...personalEmojis];
  // Deduplicate by id (ownerId personal may duplicate names but not ids)
  const seen = new Set();
  const deduped = [];
  for (const d of all) {
    const id = d._id.toString();
    if (!seen.has(id)) {
      seen.add(id);
      deduped.push(d);
    }
  }
  return deduped.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    spaceId: d.spaceId ? d.spaceId.toString() : null,
    ownerId: d.ownerId ? d.ownerId.toString() : null,
    url: d.url,
    animated: Boolean(d.animated),
    createdBy: d.createdBy ? d.createdBy.toString() : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export async function listPersonalEmojis({ userId }) {
  const docs = await CustomEmoji.find({ ownerId: new mongoose.Types.ObjectId(userId) })
    .select("name spaceId ownerId url animated createdBy createdAt updatedAt")
    .sort({ name: 1 })
    .lean();
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    spaceId: null,
    ownerId: d.ownerId ? d.ownerId.toString() : null,
    url: d.url,
    animated: Boolean(d.animated),
    createdBy: d.createdBy ? d.createdBy.toString() : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

export async function createEmoji({ userId, name, spaceId, file, personal = false }) {
  const cleanName = String(name || "").trim().toLowerCase();
  if (!cleanName || cleanName.length < 2 || cleanName.length > 32) {
    throw badRequest("Name must be 2-32 characters", "VALIDATION_ERROR");
  }
  if (!/^[a-z0-9_]+$/.test(cleanName)) {
    throw badRequest("Lowercase letters, numbers and underscores only", "VALIDATION_ERROR");
  }
  if (!file || !file.buffer) {
    throw badRequest("Image file required", "NO_FILE");
  }

  assertEmojiMime(file.mimetype);
  assertEmojiSize(file.size);

  // Plus gate: all custom emoji creation is Plus-only (except site admin global)
  const { isPlus, limits } = await getRequesterPlan(User, userId);
  const isAdmin = await isSiteAdmin(userId);

  let targetSpaceId = null;
  let targetOwnerId = null;

  if (personal) {
    // Personal emoji: Plus-only, account-scoped, usable everywhere
    if (!isPlus) {
      throw forbidden("Kivo Plus required to create personal emoji — upgrade in Plus tab", "PLUS_REQUIRED");
    }
    const personalCount = await CustomEmoji.countDocuments({ ownerId: new mongoose.Types.ObjectId(userId) });
    const cap = limits.personalEmojiMax ?? 50;
    if (personalCount >= cap) {
      throw badRequest(`Personal emoji limit reached (${cap})`, "EMOJI_LIMIT");
    }
    // Ensure name not taken among own personal (and optionally globally to avoid ambiguity)
    const existsOwn = await CustomEmoji.findOne({ ownerId: new mongoose.Types.ObjectId(userId), name: cleanName });
    if (existsOwn) {
      throw conflict(`Emoji name "${cleanName}" already taken in your personal library`, "NAME_TAKEN");
    }
    // Optional: block collision with global to avoid shadowing confusion
    const globalExists = await CustomEmoji.findOne({ spaceId: null, ownerId: null, name: cleanName });
    if (globalExists) {
      throw conflict(`Emoji name "${cleanName}" already taken globally`, "NAME_TAKEN");
    }
    targetOwnerId = new mongoose.Types.ObjectId(userId);
    targetSpaceId = null;
  } else if (spaceId) {
    if (!mongoose.Types.ObjectId.isValid(spaceId)) {
      throw badRequest("Invalid spaceId", "INVALID_ID");
    }
    await assertSpaceAdmin(spaceId, userId);
    // Space emoji is also Plus-gated (per request: only Plus can add)
    if (!isPlus && !isAdmin) {
      throw forbidden("Kivo Plus required to create Space emoji", "PLUS_REQUIRED");
    }
    targetSpaceId = new mongoose.Types.ObjectId(spaceId);

    // Per-space cap
    const count = await CustomEmoji.countDocuments({ spaceId: targetSpaceId, ownerId: null });
    if (count >= MAX_PER_SPACE) {
      throw badRequest(`Space emoji limit reached (${MAX_PER_SPACE})`, "EMOJI_LIMIT");
    }
    // Check name collision within that space (ownerId null)
    const exists = await CustomEmoji.findOne({ spaceId: targetSpaceId, ownerId: null, name: cleanName });
    if (exists) {
      throw conflict(`Emoji name "${cleanName}" already taken in this space`, "NAME_TAKEN");
    }
  } else {
    // Global emoji: site admin only (bypass Plus for admin)
    if (!isAdmin) {
      throw forbidden("Only site admins can create global emoji", "FORBIDDEN");
    }
    const globalCount = await CustomEmoji.countDocuments({ spaceId: null, ownerId: null });
    if (globalCount >= MAX_GLOBAL) {
      throw badRequest(`Global emoji limit reached (${MAX_GLOBAL})`, "EMOJI_LIMIT");
    }
    const exists = await CustomEmoji.findOne({ spaceId: null, ownerId: null, name: cleanName });
    if (exists) {
      throw conflict(`Emoji name "${cleanName}" already taken globally`, "NAME_TAKEN");
    }
  }

  // Normalize image (sharp)
  let normalized;
  try {
    normalized = await normalizeEmojiImage(file.buffer, file.mimetype);
  } catch (err) {
    if (err.statusCode) throw err;
    throw badRequest(`Image processing failed: ${err.message}`, "IMAGE_PROCESS_FAILED");
  }

  // Upload to Appwrite
  const store = getStorageSafe();
  if (!store) {
    throw Object.assign(
      new Error("Appwrite not configured. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY"),
      { statusCode: 500, code: "APPWRITE_NOT_CONFIGURED" }
    );
  }
  const bucketId = getEmojiBucketOrThrow();
  const fileId = ID.unique();
  const ext = normalized.mimeType === "image/gif" ? "gif" : "webp";
  const inputFile = InputFile.fromBuffer(normalized.buffer, `${cleanName}.${ext}`);

  try {
    await store.createFile(bucketId, fileId, inputFile);
  } catch (err) {
    const msg = err?.message || String(err);
    throw Object.assign(new Error(`Upload failed: ${msg}`), {
      statusCode: 500,
      code: "UPLOAD_FAILED",
    });
  }

  const endpoint = env.appwriteEndpoint.replace(/\/$/, "");
  const projectId = env.appwriteProjectId;
  // Use view for gif (preserve), preview would break animation; webp view is fine
  const url = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${encodeURIComponent(projectId)}`;

  const doc = await CustomEmoji.create({
    name: cleanName,
    spaceId: targetSpaceId,
    ownerId: targetOwnerId,
    createdBy: userId,
    url,
    fileId,
    bucketId,
    animated: normalized.animated,
  });

  const pub = publicEmoji(doc);

  // Socket: fan out to space room or global
  try {
    if (targetSpaceId) {
      emitToSpace(targetSpaceId.toString(), "emoji:new", pub);
    } else {
      // Global emoji: broadcast to all? For now emit via space-agnostic event
      // Clients listening on their space rooms will get it on next fetch; we also
      // try a global room if available. Simplest: no push for global, clients refetch.
      // But we can try emitting to a global room if any sockets join it.
      const { getIO } = await import("../../socket/index.js");
      const io = getIO();
      if (io) io.emit("emoji:new", pub);
    }
  } catch {}

  return pub;
}

export async function deleteEmoji({ emojiId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(emojiId)) {
    throw badRequest("Invalid emoji id", "INVALID_ID");
  }
  const emoji = await CustomEmoji.findById(emojiId).select("+fileId +bucketId +ownerId");
  if (!emoji) throw notFound("Emoji not found", "EMOJI_NOT_FOUND");

  // Permission: uploader/owner or Space admin+ (or site admin for global/personal)
  let allowed = false;
  if (emoji.createdBy.toString() === userId) {
    allowed = true;
  } else if (emoji.ownerId && emoji.ownerId.toString() === userId) {
    allowed = true;
  } else if (emoji.spaceId) {
    try {
      const space = await Space.findById(emoji.spaceId).select("members");
      if (space) {
        const member = space.members.find((m) => m.userId.toString() === userId);
        if (member && ["owner", "admin"].includes(member.role)) allowed = true;
      }
    } catch {}
  } else {
    // Global or personal: site admin can delete any
    if (await isSiteAdmin(userId)) allowed = true;
  }

  if (!allowed) {
    throw forbidden("You don't have permission to delete this emoji", "FORBIDDEN");
  }

  const spaceIdStr = emoji.spaceId ? emoji.spaceId.toString() : null;
  const ownerIdStr = emoji.ownerId ? emoji.ownerId.toString() : null;
  const fileId = emoji.fileId;
  const bucketId = emoji.bucketId || getEmojiBucketId();

  await CustomEmoji.findByIdAndDelete(emojiId);

  // Delete file from Appwrite (best-effort)
  if (fileId && bucketId) {
    const store = getStorageSafe();
    if (store) {
      try {
        await store.deleteFile(bucketId, fileId);
      } catch {
        // File may already be gone
      }
    }
  }

  const payload = { id: emojiId, spaceId: spaceIdStr, ownerId: ownerIdStr, name: emoji.name };

  try {
    if (spaceIdStr) {
      emitToSpace(spaceIdStr, "emoji:deleted", payload);
    } else {
      const { getIO } = await import("../../socket/index.js");
      const io = getIO();
      if (io) {
        // Personal and global both broadcast globally so all clients can purge cache
        io.emit("emoji:deleted", payload);
        if (ownerIdStr) {
          // Also emit to owner's personal room if they have one (optional)
          try { io.to(`user:${ownerIdStr}`).emit("emoji:deleted", payload); } catch {}
        }
      }
    }
  } catch {}

  return payload;
}

export const LIMITS = { MAX_PER_SPACE, MAX_GLOBAL };
