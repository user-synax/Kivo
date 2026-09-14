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

// Rematch series: best-of-N. First to SERIES_WINS_NEEDED wins takes the series;
// at most SERIES_BEST_OF games are ever played.
export const SERIES_BEST_OF = 3;
export const SERIES_WINS_NEEDED = 2;

// ── Arena progression (XP, streaks, weekly board) ───────────────────────
// All pure: nextArenaStats() computes the next stored shape from the previous
// one plus one finished race, so the whole progression model is unit-testable
// without MongoDB. games.service.js just loads, applies and saves.

// Ranked 1v1 economy. Practice pays less and never touches streaks or the
// weekly board, so bots can't be farmed for rank.
export const ARENA_XP_WIN = 100;
export const ARENA_XP_LOSS = 25;
export const ARENA_XP_PRACTICE_WIN = 30;
export const ARENA_XP_PRACTICE_LOSS = 10;
export const ARENA_LEADERBOARD_SIZE = 20;

// ISO week key in UTC, e.g. "2026-W37". Weeks start Monday (ISO 8601).
export function arenaWeekKey(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  const week = 1 + Math.round((thursday - new Date(Date.UTC(year, 0, 4 - firstDay))) / 604800000);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

// Next Monday 00:00 UTC after nowMs — the weekly board reset instant.
export function arenaWeekEndsAt(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const day = (d.getUTCDay() + 6) % 7; // days since Monday
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
  return monday + 7 * 86400000;
}

// Level curve: L1 0–99, L2 100–399, L3 400–899, … cheap to read, slow to climb.
// One ranked win = +100 XP, so the first win always levels you to 2.
export function levelForXp(xp) {
  const safe = Math.max(0, Math.floor(Number(xp) || 0));
  return Math.floor(Math.sqrt(safe / 100)) + 1;
}

// XP still needed to reach the next level from xp.
export function xpToNextLevel(xp) {
  const level = levelForXp(xp);
  return level * level * 100 - Math.max(0, Math.floor(Number(xp) || 0));
}

// UTC calendar day key, e.g. "2026-09-14". Daily streaks tick on UTC days so
// every player shares one midnight.
export function utcDayKey(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

// Previous UTC day key ("yesterday") for streak continuation checks.
export function prevUtcDayKey(dayKey) {
  const [y, m, d] = String(dayKey || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const t = Date.UTC(y, m - 1, d) - 86400000;
  return utcDayKey(t);
}

function numOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Next stored arena shape after one finished race.
// { won, wpm, practice, weekKey, dayKey, boardOnly } — wpm is the server-derived
// WPM (may be null when there was nothing measurable; wins/losses still count,
// board skips). boardOnly folds a late runner-up WPM into the board without
// touching XP, wins, losses or streaks (already counted at decision time).
// The daily play-streak ticks on dayKey for every finish — ranked or practice,
// full or board-only — because it rewards showing up, not winning.
export function nextArenaStats(prev = {}, { won, wpm, practice = false, weekKey, dayKey, boardOnly = false } = {}) {
  const next = {
    xp: Math.max(0, Math.floor(numOr(prev.xp, 0))),
    wins: Math.max(0, Math.floor(numOr(prev.wins, 0))),
    losses: Math.max(0, Math.floor(numOr(prev.losses, 0))),
    bestWpm: Number.isFinite(Number(prev.bestWpm)) ? Math.round(Number(prev.bestWpm)) : null,
    currentStreak: Math.max(0, Math.floor(numOr(prev.currentStreak, 0))),
    bestStreak: Math.max(0, Math.floor(numOr(prev.bestStreak, 0))),
    lastRaceDay: prev.lastRaceDay || null,
    dailyStreak: Math.max(0, Math.floor(numOr(prev.dailyStreak, 0))),
    bestDailyStreak: Math.max(0, Math.floor(numOr(prev.bestDailyStreak, 0))),
    weekKey: prev.weekKey || null,
    weekGames: Math.max(0, Math.floor(numOr(prev.weekGames, 0))),
    weekWins: Math.max(0, Math.floor(numOr(prev.weekWins, 0))),
    weekTotalWpm: Math.max(0, Math.floor(numOr(prev.weekTotalWpm, 0))),
    weekBestWpm: Number.isFinite(Number(prev.weekBestWpm))
      ? Math.round(Number(prev.weekBestWpm))
      : null,
  };

  // New week — roll the board bucket before counting this race.
  if (next.weekKey !== weekKey) {
    next.weekKey = weekKey;
    next.weekGames = 0;
    next.weekWins = 0;
    next.weekTotalWpm = 0;
    next.weekBestWpm = null;
  }

  // Daily play-streak: same UTC day changes nothing, yesterday continues the
  // streak, anything older restarts it at 1.
  if (dayKey) {
    if (next.lastRaceDay !== dayKey) {
      next.dailyStreak = next.lastRaceDay === prevUtcDayKey(dayKey) ? next.dailyStreak + 1 : 1;
      next.bestDailyStreak = Math.max(next.bestDailyStreak, next.dailyStreak);
      next.lastRaceDay = dayKey;
    }
  }

  if (boardOnly) {
    const w = Number(wpm);
    if (Number.isFinite(w) && w > 0) {
      const rounded = Math.round(w);
      next.bestWpm = next.bestWpm == null ? rounded : Math.max(next.bestWpm, rounded);
      next.weekGames += 1;
      next.weekTotalWpm += rounded;
      next.weekBestWpm = next.weekBestWpm == null ? rounded : Math.max(next.weekBestWpm, rounded);
    }
    return next;
  }

  if (practice) {
    next.xp += won ? ARENA_XP_PRACTICE_WIN : ARENA_XP_PRACTICE_LOSS;
    return next;
  }

  next.xp += won ? ARENA_XP_WIN : ARENA_XP_LOSS;
  if (won) {
    next.wins += 1;
    next.currentStreak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.currentStreak);
  } else {
    next.losses += 1;
    next.currentStreak = 0;
  }

  const w = Number(wpm);
  if (Number.isFinite(w) && w > 0) {
    const rounded = Math.round(w);
    next.bestWpm = next.bestWpm == null ? rounded : Math.max(next.bestWpm, rounded);
    next.weekGames += 1;
    if (won) next.weekWins += 1;
    next.weekTotalWpm += rounded;
    next.weekBestWpm = next.weekBestWpm == null ? rounded : Math.max(next.weekBestWpm, rounded);
  }
  return next;
}

// ── Solo practice vs bot ────────────────────────────────────────────────
// Fixed bot identities: valid ObjectIds in a range real users can never hit,
// so bots ride the normal player shape (userId/displayName/status) with an
// explicit isBot flag — no schema fork, no special-case rendering contracts.
export const PRACTICE_BOTS = Object.freeze({
  easy: { userId: "0000000000000000000000a1", name: "Rookie Bot", wpm: 30 },
  medium: { userId: "0000000000000000000000a2", name: "Dash Bot", wpm: 55 },
  hard: { userId: "0000000000000000000000a3", name: "Blaze Bot", wpm: 80 },
});

export const PRACTICE_DIFFICULTIES = Object.freeze(["easy", "medium", "hard"]);

export function practiceBotFor(difficulty) {
  return PRACTICE_BOTS[difficulty] || null;
}

export function isPracticeBotId(userId) {
  const key = String(userId || "");
  return Object.values(PRACTICE_BOTS).some((b) => b.userId === key);
}

// Bot typing speed for one session: base WPM ± 4 so rematches don't feel
// robotic. Pure except Math.random — the race clock still decides the outcome.
export function pickPracticeBotWpm(difficulty) {
  const bot = practiceBotFor(difficulty);
  if (!bot) return null;
  const jitter = Math.floor(Math.random() * 9) - 4;
  return Math.max(10, bot.wpm + jitter);
}

// Bot progress 0..1 at `elapsedMs` after GO: linear at botWpm, clamped.
// Linear is deliberate — difficulty must read as a constant, honest pace.
export function botProgressAt(botWpm, passage, elapsedMs) {
  if (!botWpm || !passage || !elapsedMs || elapsedMs <= 0) return 0;
  const total = passage.trim().length;
  if (!total) return 0;
  const typed = (Number(botWpm) * 5 * elapsedMs) / 60000;
  return Math.max(0, Math.min(1, typed / total));
}

// Pure series standings from finished sessions. `games` are plain objects with
// { winnerId, status }. Returns { wins: Map-ish object, finishedCount,
// winnerId, isComplete } — winner is first to WINS_NEEDED, or whoever leads
// after BEST_OF finished games.
export function seriesStandings(games) {
  const finished = (games || []).filter((g) => g?.status === "finished" && g?.winnerId);
  const wins = {};
  for (const g of finished) {
    const key = String(g.winnerId);
    wins[key] = (wins[key] || 0) + 1;
  }
  let winnerId = null;
  for (const [userId, count] of Object.entries(wins)) {
    if (count >= SERIES_WINS_NEEDED) {
      winnerId = userId;
      break;
    }
  }
  if (!winnerId && finished.length >= SERIES_BEST_OF) {
    let best = 0;
    for (const [userId, count] of Object.entries(wins)) {
      if (count > best) {
        best = count;
        winnerId = userId;
      }
    }
  }
  return {
    wins,
    finishedCount: finished.length,
    winnerId,
    isComplete: Boolean(winnerId) || finished.length >= SERIES_BEST_OF,
  };
}

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
