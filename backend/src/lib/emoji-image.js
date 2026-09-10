import sharp from "sharp";

const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const MAX_PRE_NORMALIZE_BYTES = 256 * 1024; // 256 KB
const EMOJI_SIZE = 128;

export function isAllowedEmojiMime(mimeType) {
  return ALLOWED_MIMES.has(mimeType);
}

export function assertEmojiMime(mimeType) {
  if (!isAllowedEmojiMime(mimeType)) {
    const err = new Error(
      `File type "${mimeType}" is not allowed. Allowed: png, jpeg, webp, gif`
    );
    err.statusCode = 400;
    err.code = "INVALID_FILE_TYPE";
    throw err;
  }
}

export function assertEmojiSize(size) {
  if (size > MAX_PRE_NORMALIZE_BYTES) {
    const err = new Error(
      `Emoji image too large (${(size / 1024).toFixed(0)} KB). Max 256 KB before processing.`
    );
    err.statusCode = 400;
    err.code = "FILE_TOO_LARGE";
    throw err;
  }
}

/**
 * Normalize emoji image to tiny uniform file.
 * - Animated GIF: keep animation, cap 128px, output gif
 * - Static: convert to WebP 128px ~ quality 80, effort 4
 * Returns { buffer, mimeType, animated }
 */
export async function normalizeEmojiImage(buffer, mimeType) {
  const isAnimatedGif = mimeType === "image/gif";

  if (isAnimatedGif) {
    // Keep animation; cap dimensions and strip bloat
    const out = await sharp(buffer, { animated: true })
      .resize(EMOJI_SIZE, EMOJI_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .gif()
      .toBuffer();
    return { buffer: out, mimeType: "image/gif", animated: true };
  }

  const out = await sharp(buffer)
    .resize(EMOJI_SIZE, EMOJI_SIZE, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  return { buffer: out, mimeType: "image/webp", animated: false };
}

export const EMOJI_MAX_PRE_BYTES = MAX_PRE_NORMALIZE_BYTES;
