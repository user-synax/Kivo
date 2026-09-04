// Per-conversation composer drafts, persisted in localStorage so an unsent
// message survives conversation switches and reloads. One JSON map per user:
//   kivo:drafts:<userId> -> { [conversationId]: text }
// Sends clear the entry (empty text deletes the key); the map is capped so a
// heavy switcher can't grow storage without bound.

const MAX_ENTRIES = 50;
const MAX_LENGTH = 4000;

export function draftsKey(userId) {
  return userId ? `kivo:drafts:${userId}` : null;
}

function readMap(key) {
  if (!key) return {};
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadDraft(key, conversationId) {
  if (!key || !conversationId) return "";
  const map = readMap(key);
  const val = map[conversationId];
  return typeof val === "string" ? val.slice(0, MAX_LENGTH) : "";
}

export function saveDraft(key, conversationId, text) {
  if (!key || !conversationId) return;
  try {
    const map = readMap(key);
    if (text && text.trim()) {
      map[conversationId] = text.slice(0, MAX_LENGTH);
    } else {
      delete map[conversationId];
    }
    const keys = Object.keys(map);
    // Evict oldest first (insertion order) past the cap.
    while (keys.length > MAX_ENTRIES) {
      delete map[keys.shift()];
    }
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    /* storage full or unavailable — drafts are best-effort */
  }
}

export function clearDraft(key, conversationId) {
  if (!key || !conversationId) return;
  try {
    const map = readMap(key);
    if (conversationId in map) {
      delete map[conversationId];
      localStorage.setItem(key, JSON.stringify(map));
    }
  } catch {
    /* best-effort */
  }
}
