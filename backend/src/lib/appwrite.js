import { Client, Storage, ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import env from "../config/env.js";

// Lazily-initialized Appwrite client. We defer creation until the first upload
// so the server (and its tests) start fine even when Appwrite isn't configured.
let storage = null;

function buildStorage() {
  const { appwriteEndpoint, appwriteProjectId, appwriteApiKey } = env;
  if (!appwriteEndpoint || !appwriteProjectId || !appwriteApiKey) return null;
  const client = new Client()
    .setEndpoint(appwriteEndpoint)
    .setProject(appwriteProjectId)
    .setKey(appwriteApiKey);
  return new Storage(client);
}

// Returns the Storage client, or null when Appwrite isn't configured (so
// callers like deleteAvatar can skip the remote call without throwing).
export function getStorageSafe() {
  if (!storage) storage = buildStorage();
  return storage;
}

function getStorage() {
  const { appwriteBucketId } = env;
  const store = getStorageSafe();
  if (!store) {
    throw new Error(
      "Appwrite is not configured. Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY in the backend .env.",
    );
  }
  if (!appwriteBucketId) {
    throw new Error("APPWRITE_BUCKET_ID is not configured in the backend .env.");
  }
  return store;
}

// Accept a Buffer (from multer), upload it to the avatar bucket, optionally
// removing the user's previous file, and return the new file id + a public
// view URL. The bucket must grant public read ("any") for the URL to resolve
// without a session.
const EXT_BY_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadAvatar(buffer, contentType, oldFileId) {
  const store = getStorage();
  const bucketId = env.appwriteBucketId;

  if (oldFileId) {
    try {
      await store.deleteFile(bucketId, oldFileId);
    } catch {
      // Previous file may already be gone — non-fatal.
    }
  }

  const ext = EXT_BY_TYPE[contentType] || "bin";
  // IMPORTANT: use fromBuffer — it tags the source as a Buffer so the SDK can
  // compute size()/slice() for the chunked upload. `new InputFile(buffer, ...)`
  // stores the raw buffer and leaves source.type undefined, which makes Appwrite
  // emit an invalid Content-Range header.
  const file = InputFile.fromBuffer(buffer, `avatar.${ext}`);
  const fileId = ID.unique();
  await store.createFile(bucketId, fileId, file);

  // NOTE: in node-appwrite v28 `storage.getFileView()` performs a fetch and
  // resolves to the file bytes (ArrayBuffer), NOT a URL string. Build the
  // public view URL ourselves instead.
  const endpoint = env.appwriteEndpoint.replace(/\/$/, "");
  const url = `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${encodeURIComponent(env.appwriteProjectId)}`;
  return { fileId, url };
}
