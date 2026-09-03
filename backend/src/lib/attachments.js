import { InputFile } from "node-appwrite/file";
import { getStorageSafe } from "./appwrite.js";
import env from "../config/env.js";

// Allowed MIME types
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const DOC_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);
// Voice messages: recorded in-browser via MediaRecorder. No transcoding happens
// server-side — the file is stored as-is in the same attachments bucket, so the
// extra load is one small upload + one field on the message.
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
]);

export const ALLOWED_MIMES = new Set([
  ...IMAGE_TYPES,
  ...DOC_TYPES,
  ...AUDIO_TYPES,
]);
export const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

export function fileKind(mimeType) {
  if (IMAGE_TYPES.has(mimeType)) return "image";
  if (AUDIO_TYPES.has(mimeType)) return "audio";
  return "document";
}

/**
 * Upload a buffer to the attachments bucket and return metadata + URL.
 * The bucket must exist in Appwrite with public read (Role.any()).
 */
export async function uploadAttachment(buffer, fileName, mimeType, size) {
  const store = getStorageSafe();
  if (!store) {
    throw Object.assign(new Error("Appwrite is not configured. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY in the backend .env."), { statusCode: 500, code: "APPWRITE_NOT_CONFIGURED" });
  }

  const bucketId = env.appwriteAttachmentsBucketId;
  if (!bucketId) {
    throw Object.assign(new Error("APPWRITE_ATTACHMENTS_BUCKET_ID is not configured in the backend .env."), { statusCode: 500, code: "BUCKET_NOT_CONFIGURED" });
  }

  const fileId = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const file = InputFile.fromBuffer(buffer, fileName);
  try {
    await store.createFile(bucketId, fileId, file);
  } catch (err) {
    const msg = err?.message || String(err);
    console.error("[attachments] Appwrite upload failed:", msg);
    if (msg.includes("Bucket with the requested ID could not be found")) {
      throw Object.assign(new Error(`Appwrite bucket "${bucketId}" not found. Create it in your Appwrite console.`), { statusCode: 500, code: "BUCKET_NOT_FOUND" });
    }
    throw Object.assign(new Error(`Appwrite upload failed: ${msg}`), { statusCode: 500, code: "UPLOAD_FAILED" });
  }

  // Build public URL (same pattern as uploadAvatar in appwrite.js)
  const endpoint = env.appwriteEndpoint.replace(/\/$/, "");
  const projectId = env.appwriteProjectId;
  const kind = fileKind(mimeType);

  let url;
  if (kind === "image") {
    // Use Appwrite's built-in image preview with resize
    url = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/preview?project=${encodeURIComponent(projectId)}&width=800&height=800`;
  } else {
    // Documents and audio get a direct view URL (playback streams straight
    // from Appwrite — the API server never proxies media bytes)
    url = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${encodeURIComponent(projectId)}`;
  }

  return {
    fileId,
    bucketId,
    fileName,
    mimeType,
    size,
    kind,
    url,
  };
}
