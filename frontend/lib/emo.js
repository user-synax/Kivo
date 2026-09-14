// On-device emoji suggestions (Desert Ant Labs Emo) for the chat composer.
//
// The model (~11MB) downloads from the Hugging Face Hub on first use and is
// cached in the browser; inference itself is fully offline/local after that.
// Everything here is lazy: the SDK is dynamically imported so it never lands
// in the main bundle, and every failure mode resolves to `[]` so the composer
// works exactly as before when the model can't load (offline first run,
// unsupported browser, etc.).
//
// API confirmed against node_modules/@desert-ant-labs/emo/{README.md,index.d.ts}
// (v3.1.0): `Emo.load()` -> `emo.suggestions(text, { limit })`.

const SUGGEST_LIMIT = 6;
const MIN_TEXT_LENGTH = 3;
const CACHE_CAP = 200;

// Local on/off switch for the suggestion strip. Default ON; stored per
// device (like the sound prefs), with an event so open chats update live
// when the user flips it in Settings.
const PREF_KEY = "kivo:emo-suggestions";
export const EMO_PREF_EVENT = "kivo:emo-prefs";

export function getEmoSuggestionsEnabled() {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (raw === null) return true;
    return raw !== "off" && raw !== "false" && raw !== "0";
  } catch {
    return true;
  }
}

export function setEmoSuggestionsEnabled(enabled) {
  const on = Boolean(enabled);
  try {
    window.localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {}
  try {
    window.dispatchEvent(
      new CustomEvent(EMO_PREF_EVENT, { detail: { enabled: on } }),
    );
  } catch {}
  return on;
}

let loadPromise = null;
let suggestCache = new Map();

function isBrowser() {
  return typeof window !== "undefined";
}

async function getEmo() {
  if (!isBrowser()) return null;
  if (!loadPromise) {
    loadPromise = (async () => {
      const { Emo } = await import("@desert-ant-labs/emo");
      return Emo.load();
    })().catch(() => {
      // Let a later keystroke retry (e.g. back online after an offline
      // first attempt) instead of caching the failure forever.
      loadPromise = null;
      return null;
    });
  }
  return loadPromise;
}

// Suggest up to 4 emojis for the composer's current text. Returns [] when
// there's nothing worth suggesting or the model isn't usable.
export async function suggestEmojis(text) {
  const clean = (text || "").trim();
  if (!isBrowser() || clean.length < MIN_TEXT_LENGTH) return [];
  // Skip when the caret is inside an explicit emoji code (:name:) or mention
  // (@name) — those have their own pickers.
  const tail = clean.slice(-32);
  if (/(^|\s)[:@][\w+-]*$/.test(tail)) return [];
  const key = clean.slice(-160).toLowerCase();
  const cached = suggestCache.get(key);
  if (cached) return cached;
  try {
    const emo = await getEmo();
    if (!emo) return [];
    const results = await emo.suggestions(clean.slice(-160), {
      limit: SUGGEST_LIMIT,
    });
    const emojis = (Array.isArray(results) ? results : [])
      .map((r) => r?.emoji)
      .filter((e) => typeof e === "string" && e.length > 0)
      .slice(0, SUGGEST_LIMIT);
    suggestCache.set(key, emojis);
    if (suggestCache.size > CACHE_CAP) {
      const oldest = suggestCache.keys().next().value;
      suggestCache.delete(oldest);
    }
    return emojis;
  } catch {
    return [];
  }
}

// Warm the model during idle time (e.g. right after the chat mounts) so the
// first keystroke already has suggestions. Best-effort, never throws.
export function preloadEmo() {
  if (!isBrowser() || typeof window.requestIdleCallback === "undefined") {
    return;
  }
  try {
    window.requestIdleCallback(() => {
      getEmo().catch(() => {});
    });
  } catch {}
}
