"use client";

import { useState, useCallback, useRef } from "react";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
];
const ALLOWED_MIMES = new Set([...IMAGE_TYPES, ...DOC_TYPES]);
const MAX_SIZE = 30 * 1024 * 1024; // 30MB
const MAX_FILES = 10;

function kindFromMime(mime) {
  return IMAGE_TYPES.includes(mime) ? "image" : "document";
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Manages a list of files to be uploaded, with local previews,
 * validation, and server upload with progress tracking.
 *
 * Usage:
 *   const { files, addFiles, removeFile, uploadAll, uploading, progress } = useFileUpload();
 *   // addFiles from an <input type="file"> change event
 *   // uploadAll(conversationId) → returns array of attachment objects for the message
 */
export function useFileUpload() {
  const [files, setFiles] = useState([]); // { id, file, name, size, mime, kind, preview, status, progress, error }
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({}); // id → percent
  const idRef = useRef(0);

  const addFiles = useCallback((fileList) => {
    const newFiles = [];
    const existing = []; // Will be appended after validation

    for (const file of fileList) {
      if (newFiles.length >= MAX_FILES) break;

      if (!ALLOWED_MIMES.has(file.type)) {
        existing.push({
          id: `f_${++idRef.current}`,
          file,
          name: file.name,
          size: file.size,
          mime: file.type,
          kind: kindFromMime(file.type),
          preview: null,
          status: "error",
          progress: 0,
          error: `File type "${file.type}" is not allowed`,
        });
        continue;
      }
      if (file.size > MAX_SIZE) {
        existing.push({
          id: `f_${++idRef.current}`,
          file,
          name: file.name,
          size: file.size,
          mime: file.type,
          kind: kindFromMime(file.type),
          preview: null,
          status: "error",
          progress: 0,
          error: `File exceeds 30MB limit (${formatSize(file.size)})`,
        });
        continue;
      }

      const kind = kindFromMime(file.type);
      const preview = kind === "image" ? URL.createObjectURL(file) : null;

      existing.push({
        id: `f_${++idRef.current}`,
        file,
        name: file.name,
        size: file.size,
        mime: file.type,
        kind,
        preview,
        status: "pending",
        progress: 0,
        error: null,
      });
      newFiles.push(existing[existing.length - 1]);
    }

    setFiles((prev) => [...prev, ...existing]);
  }, []);

  const removeFile = useCallback((id) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setFiles((prev) => {
      prev.forEach((f) => { if (f.preview) URL.revokeObjectURL(f.preview); });
      return [];
    });
    setProgress({});
  }, []);

  /**
   * Upload all pending files to the server.
   * Returns an array of attachment objects ready for the message-create payload.
   */
  const uploadAll = useCallback(async (conversationId) => {
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) return [];

    setUploading(true);
    const results = [];

    try {
      // Upload files one at a time for clean progress tracking
      for (const f of pending) {
        setFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, status: "uploading" } : x));

        const formData = new FormData();
        formData.append("conversationId", conversationId);
        formData.append("files", f.file);

        try {
          const result = await uploadSingleFile(formData, f.id, setFiles, setProgress);
          results.push(result);
          setFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, status: "done" } : x));
        } catch (err) {
          setFiles((prev) => prev.map((x) => x.id === f.id ? { ...x, status: "error", error: err.message } : x));
        }
      }
    } finally {
      setUploading(false);
    }

    return results;
  }, [files]);

  return { files, addFiles, removeFile, clearAll, uploadAll, uploading, progress };
}

function uploadSingleFile(formData, fileId, setFiles, setProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setProgress((prev) => ({ ...prev, [fileId]: pct }));
        setFiles((prev) => prev.map((x) => x.id === fileId ? { ...x, progress: pct } : x));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          const uploaded = json?.data?.files?.[0];
          if (uploaded) {
            resolve(uploaded);
          } else {
            reject(new Error("No file data in response"));
          }
        } catch {
          reject(new Error("Invalid response"));
        }
      } else {
        try {
          const json = JSON.parse(xhr.responseText);
          reject(new Error(json?.error?.message || `Upload failed (${xhr.status})`));
        } catch {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));

    xhr.open("POST", "/api/v1/attachments/upload");

    // Get auth token
    try {
      const sessionRaw = localStorage.getItem("kivo:session");
      // Token is in memory, not localStorage — we need to get it from the auth module
      // But since this is a plain XHR, we'll import dynamically
    } catch {}

    // We need the token. Import it dynamically.
    import("./auth.js").then(({ getToken }) => {
      const token = getToken();
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      xhr.send(formData);
    }).catch(() => {
      // If import fails, send without token (will fail auth)
      xhr.send(formData);
    });
  });
}
