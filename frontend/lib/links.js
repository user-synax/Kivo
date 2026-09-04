// URL detection + normalization shared by message rendering and link previews.
//
// extractUrls(text) returns unique, normalized http(s) URLs in order of
// appearance. Supports:
//   - https://... and http://...
//   - www.example.com/... (normalized to https://)
// Trailing punctuation (.,;:!?)]}) and wrapping quotes are stripped so
// "check https://example.com." links correctly.

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
// Note: closers )]} are NOT stripped blindly here — they are handled by the
// balance check below so Wikipedia-style URLs like /wiki/A_(b) keep their pair.
const TRAILING_PUNCT_RE = /[.,;:!?'\"`>]+$/;

export function normalizeUrl(raw) {
  if (!raw) return null;
  let cleaned = String(raw).trim().replace(TRAILING_PUNCT_RE, "");
  if (!cleaned) return null;
  // Drop a trailing closer only when it is unmatched in the whole URL, e.g.
  // "(see https://example.com/a)" keeps the path but drops the prose paren.
  // Loops because prose can stack them: "((https://example.com/a))".
  for (const [open, close] of [["(", ")"], ["[", "]"], ["{", "}"]]) {
    while (cleaned.endsWith(close)) {
      const opens = cleaned.split(open).length - 1;
      const closes = cleaned.split(close).length - 1;
      if (closes > opens) cleaned = cleaned.slice(0, -1);
      else break;
    }
  }
  cleaned = cleaned.replace(TRAILING_PUNCT_RE, "");
  if (!cleaned) return null;
  if (/^www\./i.test(cleaned)) cleaned = `https://${cleaned}`;
  if (!/^https?:\/\//i.test(cleaned)) return null;
  try {
    const u = new URL(cleaned);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function extractUrls(text) {
  if (!text || typeof text !== "string") return [];
  const found = [];
  const seen = new Set();
  URL_RE.lastIndex = 0;
  let m;
  while ((m = URL_RE.exec(text)) !== null) {
    const normalized = normalizeUrl(m[0]);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      found.push(normalized);
    }
    // Guard against zero-length match loops.
    if (m[0].length === 0) URL_RE.lastIndex += 1;
  }
  return found;
}

export function firstUrl(text) {
  const urls = extractUrls(text);
  return urls.length ? urls[0] : null;
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
