// Notification sound cues — one short, distinct chime per category, synthesized
// with the Web Audio API (no audio assets to download or license, works fully
// offline, and every cue can be previewed instantly).
//
// Preferences live in localStorage["kivo:sounds"] as JSON:
//   { enabled: true, directMessages: true, groupMessages: true,
//     mentions: true, friendRequests: true, spaceMessages: false,
//     gameResults: true }
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
  "gameResults",
  "arenaMusic",
];

export const SOUND_DEFAULTS = {
  enabled: true,
  directMessages: true,
  groupMessages: true,
  mentions: true,
  friendRequests: true,
  spaceMessages: false,
  gameResults: true,
  arenaMusic: true,
};

// Kivo Games cues: a bright ascending major arpeggio for a win, a descending fall
// for a loss, and the pre-race 3-2-1 blips. All of them share the single
// `gameResults` preference so Settings keeps one toggle for game sounds.
const GAME_CUES = {
  win: [
    [523.25, 0.0, 0.13], // C5
    [659.25, 0.09, 0.13], // E5
    [783.99, 0.18, 0.13], // G5
    [1046.5, 0.27, 0.45], // C6 (held)
  ],
  lose: [
    [440.0, 0.0, 0.17], // A4
    [349.23, 0.15, 0.17], // F4
    [293.66, 0.3, 0.2], // D4
    [220.0, 0.48, 0.55], // A3 (falling tail)
  ],
  // One short, dry blip per countdown number — deliberately plain so it reads as
  // a metronome rather than a melody.
  countdown: [[660.0, 0.0, 0.08]], // E5
  // "GO": a rising two-note stab, brighter and higher than the ticks.
  go: [
    [880.0, 0.0, 0.09], // A5
    [1318.51, 0.07, 0.22], // E6
  ],
  // Arena UI: tiny tactile blip for every tap — dry, ultra-short, quiet.
  click: [[1250.0, 0.0, 0.045]],
  // Arena gate: a warm three-note welcome (E5 -> A5 -> D6) for the
  // "Welcome to the Game Arena" entry moment. Brighter than a click,
  // shorter than a win stinger.
  enter: [
    [659.25, 0.0, 0.12], // E5
    [880.0, 0.1, 0.12], // A5
    [1174.66, 0.2, 0.3], // D6 (held)
  ],
  // Invite sent: warm two-note lift (C5 -> G5).
  invite: [
    [523.25, 0.0, 0.1],
    [783.99, 0.08, 0.18],
  ],
  // Join / accept: confident three-note rise (E5 -> A5 -> E6).
  join: [
    [659.25, 0.0, 0.09],
    [880.0, 0.07, 0.09],
    [1318.51, 0.14, 0.2],
  ],
  // Keystroke tick: barely-there tick, caller throttles to avoid spam.
  tick: [[2093.0, 0.0, 0.025]],
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
  // Representative cue for the Settings preview button; the real game sound
  // depends on win/lose (see playGameResult).
  gameResults: GAME_CUES.win,
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

// Play one note of a cue. `opts` lets the game stingers pick a brighter waveform
// and a higher peak without changing the gentle notification chimes.
function tone(freq, when, dur, opts = {}) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || "sine";
    osc.frequency.value = freq;
    const peak = typeof opts.peak === "number" ? opts.peak : 0.12;
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
  if (category === "arenaMusic") {
    previewArenaMusic();
    return;
  }
  playCueRaw(category);
}

function playPattern(pattern, opts = {}) {
  if (!pattern) return;
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume().catch(() => {});
    const now = c.currentTime + 0.02;
    for (const [freq, offset, dur] of pattern) {
      tone(freq, now + offset, dur, opts);
    }
  } catch {}
}

function playCueRaw(category) {
  if (category === "arenaMusic") {
    playPattern(GAME_CUES.join, { type: "triangle", peak: 0.12 });
    return;
  }
  playPattern(CUES[category]);
}

// ── Arena background music ─────────────────────────────────────────────
// Tiny synth loop, no assets: an 8-step bass + sparse lead at ~132 BPM,
// scheduled with a lightweight interval. Quiet by design (peak ~0.035) so it
// sits under typing, countdowns and stingers. Respects master + arenaMusic.
let musicTimer = null;
let musicStep = 0;
const MUSIC_STEP_MS = 228;
const MUSIC_BASS = [110.0, 0, 110.0, 0, 130.81, 0, 98.0, 123.47];
const MUSIC_LEAD = [440.0, 0, 523.25, 0, 587.33, 659.25, 0, 523.25];

function musicAudible() {
  const prefs = getSoundPrefs();
  return prefs.enabled && prefs.arenaMusic !== false;
}

function scheduleMusicStep() {
  if (!musicAudible()) return;
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume().catch(() => {});
    const t = c.currentTime + 0.02;
    const bass = MUSIC_BASS[musicStep % MUSIC_BASS.length];
    if (bass) tone(bass, t, 0.2, { type: "sine", peak: 0.045 });
    // Hat-like shimmer every other step — very quiet.
    if (musicStep % 2 === 0) tone(6000, t, 0.03, { type: "sine", peak: 0.008 });
    const lead = MUSIC_LEAD[musicStep % MUSIC_LEAD.length];
    if (lead) tone(lead, t + 0.02, 0.18, { type: "triangle", peak: 0.028 });
  } catch {}
  musicStep += 1;
}

export function isArenaMusicPlaying() {
  return Boolean(musicTimer);
}

export function startArenaMusic() {
  if (typeof window === "undefined" || musicTimer) return;
  if (!musicAudible()) return;
  try {
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
  } catch {}
  musicStep = 0;
  scheduleMusicStep();
  musicTimer = setInterval(scheduleMusicStep, MUSIC_STEP_MS);
}

export function stopArenaMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

// Short music taster for Settings preview — 8 steps then auto-stop.
let previewTimer = null;
export function previewArenaMusic() {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume().catch(() => {});
    const now = c.currentTime + 0.02;
    for (let i = 0; i < 8; i += 1) {
      const b = MUSIC_BASS[i % MUSIC_BASS.length];
      const l = MUSIC_LEAD[i % MUSIC_LEAD.length];
      if (b) tone(b, now + i * 0.228, 0.2, { type: "sine", peak: 0.05 });
      if (l)
        tone(l, now + i * 0.228 + 0.02, 0.18, { type: "triangle", peak: 0.03 });
    }
  } catch {}
  if (previewTimer) return;
  previewTimer = setTimeout(() => {
    previewTimer = null;
  }, 2200);
}

// Win/lose stinger for a finished Kivo Game. Respects the master switch and the
// "Game results" toggle, exactly like the notification chimes.
export function playGameResult(outcome) {
  const prefs = getSoundPrefs();
  if (!prefs.enabled || prefs.gameResults === false) return;
  const won = outcome === "win";
  playPattern(
    won ? GAME_CUES.win : GAME_CUES.lose,
    won ? { type: "triangle", peak: 0.18 } : { type: "triangle", peak: 0.15 },
  );
}

// Pre-race countdown blips. `kind` is "countdown" for each number and "go" when
// typing unlocks; gated by the same master + "Game results" switch as the
// stingers, so one Settings toggle covers every Kivo Games sound.
export function playCountdownCue(kind) {
  const prefs = getSoundPrefs();
  if (!prefs.enabled || prefs.gameResults === false) return;
  const isGo = kind === "go";
  playPattern(isGo ? GAME_CUES.go : GAME_CUES.countdown, {
    type: "triangle",
    peak: isGo ? 0.15 : 0.09,
  });
}

// Arena UI taps — every button in /games. Same master + Game Results gate so
// one toggle silences the whole arena (music has its own toggle).
export function playClick() {
  const prefs = getSoundPrefs();
  if (!prefs.enabled || prefs.gameResults === false) return;
  playPattern(GAME_CUES.click, { type: "sine", peak: 0.06 });
}

export function playInvite() {
  const prefs = getSoundPrefs();
  if (!prefs.enabled || prefs.gameResults === false) return;
  playPattern(GAME_CUES.invite, { type: "triangle", peak: 0.11 });
}

// Arena gate chime for the welcome entry overlay. Same gate as every other
// arena sound so one toggle silences the whole lobby.
export function playArenaEnter() {
  const prefs = getSoundPrefs();
  if (!prefs.enabled || prefs.gameResults === false) return;
  playPattern(GAME_CUES.enter, { type: "triangle", peak: 0.12 });
}

export function playJoin() {
  const prefs = getSoundPrefs();
  if (!prefs.enabled || prefs.gameResults === false) return;
  playPattern(GAME_CUES.join, { type: "triangle", peak: 0.13 });
}

// Faint keystroke tick while racing — caller throttles (every N chars).
export function playTypeTick() {
  const prefs = getSoundPrefs();
  if (!prefs.enabled || prefs.gameResults === false) return;
  playPattern(GAME_CUES.tick, { type: "sine", peak: 0.022 });
}
