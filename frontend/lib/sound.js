// Notification sound cues — one short, distinct chime per category, synthesized
// with the Web Audio API (no audio assets to download or license, works fully
// offline, and every cue can be previewed instantly).
//
// Preferences live in localStorage["kivo:sounds"] as JSON:
//   { enabled: true, directMessages: true, groupMessages: true,
//     mentions: true, friendRequests: true, spaceMessages: false }
// The legacy single-flag key localStorage["kivo:sound"] ("off"/"false"/"0")
// is migrated into `enabled` on first read, then ignored.
//
// Cues are gated at the call site by which socket event fired (message:new for
// dm/group/space/mention, notification:new for friend requests) — this module
// only decides *whether to make a sound*, never what event to react to.

const STORAGE_KEY = "kivo:sounds";
const LEGACY_KEY = "kivo:sound";

// Mirrors the server's notification-preference keys (minus Announcements —
// announcements share the space-channel message path, so they cue as
// spaceMessages when that category is enabled).
export const SOUND_CATEGORY_KEYS = [
  "directMessages",
  "groupMessages",
  "mentions",
  "friendRequests",
  "spaceMessages",
];

export const SOUND_DEFAULTS = {
  enabled: true,
  directMessages: true,
  groupMessages: true,
  mentions: true,
  friendRequests: true,
  spaceMessages: false,
};

// Each cue is a tiny melody: [frequency, start offset (s), duration (s)].
// Frequencies are kept low and envelopes soft so cues are audible but gentle.
const CUES = {
  directMessages: [
    [659.25, 0.0, 0.16], // E5 -> A5, quick rising ding
    [880.0, 0.13, 0.24],
  ],
  groupMessages: [
    [440.0, 0.0, 0.2], // single plain A4
  ],
  mentions: [
    [659.25, 0.0, 0.14], // E5 -> G5 -> B5 arpeggio, most noticeable
    [783.99, 0.09, 0.14],
    [987.77, 0.18, 0.26],
  ],
  friendRequests: [
    [523.25, 0.0, 0.18], // C5 -> E5, warm and a touch slower
    [659.25, 0.15, 0.3],
  ],
  spaceMessages: [
    [329.63, 0.0, 0.18], // soft low E4 -> A4
    [440.0, 0.16, 0.3],
  ],
};

const LEGACY_MUTED = new Set(["off", "false", "0", "muted"]);

let ctx = null;

function getCtx() {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  } catch {
    ctx = null;
  }
  return ctx;
}

function readStored() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {}
  // Legacy single-flag key -> migrate into `enabled` (old default was "on").
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const muted = LEGACY_MUTED.has(String(legacy).trim().toLowerCase());
      if (muted) return { enabled: false };
    }
  } catch {}
  return null;
}

function normalize(prefs) {
  const base = { ...SOUND_DEFAULTS, ...(prefs || {}) };
  const out = { enabled: base.enabled !== false };
  for (const key of SOUND_CATEGORY_KEYS) {
    out[key] = base[key] !== false;
  }
  return out;
}

export function getSoundPrefs() {
  return normalize(readStored());
}

function writePrefs(prefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

// Merge one or more keys (e.g. { mentions: false }) and persist.
export function setSoundPrefs(patch) {
  const next = { ...normalize(readStored()), ...patch };
  writePrefs(next);
  return next;
}

export function setSoundsEnabled(enabled) {
  return setSoundPrefs({ enabled: Boolean(enabled) });
}

// Play one note of a cue.
function tone(freq, when, dur) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const peak = 0.12;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(peak, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  } catch {}
}

export function playCue(category) {
  const prefs = getSoundPrefs();
  if (!prefs.enabled || prefs[category] === false) return;
  playCueRaw(category);
}

// Play regardless of the master/category toggles — used by the "Test" button
// in Settings so a muted category can still be auditioned.
export function previewCue(category) {
  playCueRaw(category);
}

function playCueRaw(category) {
  const pattern = CUES[category];
  if (!pattern) return;
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume().catch(() => {});
    const now = c.currentTime + 0.02;
    for (const [freq, offset, dur] of pattern) {
      tone(freq, now + offset, dur);
    }
  } catch {}
}
