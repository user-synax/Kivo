// Kivo Games — the pure rules of a Typing Race.
//
// Deliberately dependency-free: no Mongoose, no socket, no env. Everything that
// decides *who won and when* lives here as small pure functions, so the race
// rules can be unit-tested without a database (the same shape as src/lib/totp.js
// + totp.test.js). games.service.js does the I/O and orchestration and imports
// from here.

export const MIN_PLAYERS = 2;

// Safety net for an *abandoned* race. An actively-typed race extends this on
// every progress ping (see reportProgress in games.service.js), so a slow typist
// is never cut off — only a race nobody is playing gets reaped.
export const RACE_DEADLINE_MS = 10 * 60 * 1000;
export const INVITE_TTL_MS = 30 * 60 * 1000; // a pending invite expires after 30 minutes
export const MAX_SANE_WPM = 400; // guards against absurd values from a near-zero elapsed time

// The 3-2-1 countdown before a race is playable. `startedAt` is stamped this far
// in the future so both players count down to the *same absolute moment* and the
// race clock, the live WPM and the input all begin together on "GO" — the
// countdown is a real shared beat rather than a per-client flourish, and nobody's
// WPM is charged for the time they spent waiting.
// The client mirrors this as RACE_COUNTDOWN_MS in frontend/lib/games.js.
export const COUNTDOWN_MS = 3000;

// A runner-up's finish request is normally already in flight when the winner
// crosses the line. Record it if it lands within this window so a genuine photo
// finish keeps both times (and can report the margin); anything later is a stray
// request and must not invent a time. Place 2 is decided by then, so recording it
// can never change who won.
export const LATE_FINISH_WINDOW_MS = 15 * 1000;

export const PASSAGES = [
  "The quick brown fox jumps over the lazy dog while the curious cat watches from a sunny windowsill.",
  "Every morning the city wakes slowly, first with the rumble of buses and then with the chatter of people.",
  "A good conversation is like a long walk through a familiar town, full of small turns you did not expect.",
  "Learning to type quickly is mostly about rhythm, not speed, because steady hands beat hurried ones every time.",
  "Rain tapped against the window as she poured another cup of tea and listened to the quiet house settle.",
  "The best ideas rarely arrive on schedule, so it helps to keep a notebook close and your patience closer.",
];

const KIND_LABELS = Object.freeze({ typing: "Typing Race" });

export function kindLabel(kind) {
  return KIND_LABELS[kind] || "Game";
}

export function pickPassage() {
  return PASSAGES[Math.floor(Math.random() * PASSAGES.length)];
}

// WPM = (characters / 5) / minutes, from the passage and the server's own clock.
export function computeWpm(passage, elapsedMs) {
  if (!passage || !elapsedMs || elapsedMs <= 0) return null;
  const minutes = elapsedMs / 60000;
  const wpm = passage.trim().length / 5 / minutes;
  if (!Number.isFinite(wpm)) return null;
  return Math.min(MAX_SANE_WPM, Math.max(0, Math.round(wpm)));
}

// Stamp one player's finish. Place comes from how many have already finished, so
// the first caller gets 1 — calling this for the runner-up cannot steal the win.
export function recordFinish(session, player, elapsed, accuracy) {
  const finishedCount = session.players.filter((p) => p.finishedAt).length;
  player.place = finishedCount + 1;
  player.elapsedMs = elapsed;
  player.wpm = computeWpm(session.passage, elapsed);
  player.accuracy = Number.isFinite(Number(accuracy))
    ? Math.round(Number(accuracy) * 10) / 10
    : null;
  player.finishedAt = new Date();
  player.progress = 1;
  if (player.place === 1) session.winnerId = player.userId;
}

// Was this finish request already in flight when the race ended? Only then does
// the runner-up earn a recorded time.
export function canRecordRunnerUpFinish(session) {
  if (session.status !== "finished" || !session.finishedAt) return false;
  const finishedAtMs = new Date(session.finishedAt).getTime();
  return Date.now() - finishedAtMs <= LATE_FINISH_WINDOW_MS;
}
