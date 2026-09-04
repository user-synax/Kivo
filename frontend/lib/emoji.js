// Emoji-only detection for WhatsApp-style big-emoji bubbles.
//
// isEmojiOnly(text, maxCount): true when the trimmed text consists solely of
// 1..maxCount emoji graphemes (no letters, digits, links, or @mentions).
// Uses Intl.Segmenter for grapheme splitting so ZWJ sequences (👨‍👩‍👧) and
// flag pairs count as one. Falls back to code-point splitting server-side.

const EMOJI_RE = /\p{Extended_Pictographic}/u;

function graphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    try {
      const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
      return [...seg.segment(text)].map((s) => s.segment);
    } catch {
      /* fall through */
    }
  }
  return [...text];
}

function isEmojiGrapheme(g) {
  // Strip VS16 / ZWJ / skin-tone modifiers — the base must be pictographic.
  const base = g.replace(/[\uFE00-\uFE0F\u200D]/g, "").replace(/[\u{1F3FB}-\u{1F3FF}]/u, "");
  if (!base) return false;
  // Regional-indicator flag pairs (two RI chars, no pictographic base).
  if (/^\u{1F1E6}-\u{1F1FF}{2}$/u.test([...g].join(""))) return true;
  if (/^[\u{1F1E6}-\u{1F1FF}]{2}$/u.test(base)) return true;
  return EMOJI_RE.test(base);
}

export function emojiCount(text) {
  if (!text || typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const parts = graphemes(trimmed).filter((g) => !/^\s$/u.test(g) || false);
  // Reject any whitespace inside (spaces between emoji are allowed though).
  let count = 0;
  for (const g of parts) {
    if (/^\s+$/u.test(g)) continue;
    if (!isEmojiGrapheme(g)) return 0;
    count += 1;
  }
  return count;
}

export function isEmojiOnly(text, maxCount = 3) {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 30) return false;
  const count = emojiCount(trimmed);
  return count >= 1 && count <= maxCount;
}
