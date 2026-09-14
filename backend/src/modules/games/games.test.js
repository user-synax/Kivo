import { describe, expect, test } from "bun:test";
import {
  arenaWeekEndsAt,
  arenaWeekKey,
  botProgressAt,
  canRecordRunnerUpFinish,
  computeWpm,
  levelForXp,
  nextArenaStats,
  pickPracticeBotWpm,
  practiceBotFor,
  recordFinish,
  seriesStandings,
} from "./games.rules.js";
import { finishSchema, inviteGameSchema, progressSchema } from "./games.validation.js";

// Kivo Games — validation + race-rule tests.
//
// These run with Bun's built-in runner (the same `bun:test` pattern as
// src/lib/totp.test.js) and are dependency-free: the Zod schemas need no
// database, and the race helpers live in games.rules.js (no Mongoose import) so
// the rules that decide *who won* are covered without standing up MongoDB.

describe("inviteGameSchema", () => {
  test("defaults kind to typing", () => {
    const result = inviteGameSchema.safeParse({ targetUserId: "abc" });
    expect(result.success).toBe(true);
    expect(result.data.kind).toBe("typing");
  });

  test("rejects a missing targetUserId", () => {
    expect(inviteGameSchema.safeParse({}).success).toBe(false);
  });

  test("rejects an unknown game kind", () => {
    const result = inviteGameSchema.safeParse({ targetUserId: "abc", kind: "chess" });
    expect(result.success).toBe(false);
  });
});

describe("progressSchema", () => {
  test("accepts the 0..1 boundary values", () => {
    expect(progressSchema.safeParse({ progress: 0 }).success).toBe(true);
    expect(progressSchema.safeParse({ progress: 1 }).success).toBe(true);
  });

  test("rejects progress outside 0..1", () => {
    expect(progressSchema.safeParse({ progress: 1.01 }).success).toBe(false);
    expect(progressSchema.safeParse({ progress: -0.1 }).success).toBe(false);
  });

  test("rejects a non-numeric progress", () => {
    expect(progressSchema.safeParse({ progress: "half" }).success).toBe(false);
  });
});

describe("finishSchema", () => {
  test("accepts an empty payload — both fields are optional", () => {
    expect(finishSchema.safeParse({}).success).toBe(true);
  });

  test("rejects accuracy above 100", () => {
    expect(finishSchema.safeParse({ accuracy: 101 }).success).toBe(false);
  });

  test("rejects a non-integer elapsedMs", () => {
    expect(finishSchema.safeParse({ elapsedMs: 12.5 }).success).toBe(false);
  });
});

// A session-shaped stand-in: enough for the pure race helpers, no Mongoose.
function fakeSession(passage = "x".repeat(100)) {
  return {
    passage,
    status: "active",
    winnerId: null,
    finishedAt: null,
    players: [
      { userId: "me", finishedAt: null, progress: 0 },
      { userId: "rival", finishedAt: null, progress: 0 },
    ],
  };
}

describe("computeWpm", () => {
  test("is characters ÷ 5 per minute from the server's clock", () => {
    // 100 chars over exactly one minute = 20 words per minute.
    expect(computeWpm("x".repeat(100), 60000)).toBe(20);
  });

  test("clamps an absurd rate to the sanity ceiling", () => {
    expect(computeWpm("x".repeat(100), 1)).toBe(400);
  });

  test("returns null when there is nothing to measure", () => {
    expect(computeWpm("", 1000)).toBeNull();
    expect(computeWpm("abc", 0)).toBeNull();
  });
});

describe("recordFinish", () => {
  test("gives the first finisher place 1 and the win", () => {
    const session = fakeSession();
    recordFinish(session, session.players[0], 20000, 98.5);
    expect(session.players[0].place).toBe(1);
    expect(session.players[0].progress).toBe(1);
    expect(session.winnerId).toBe("me");
    // 100 chars ÷ 5 = 20 words, in a third of a minute → 60.
    expect(session.players[0].wpm).toBe(60);
    expect(session.players[0].accuracy).toBe(98.5);
  });

  test("a recorded runner-up can never steal the win", () => {
    const session = fakeSession();
    recordFinish(session, session.players[0], 20000, 98);
    recordFinish(session, session.players[1], 20040, 97);
    expect(session.players[1].place).toBe(2);
    expect(session.winnerId).toBe("me");
    expect(session.players[1].elapsedMs).toBe(20040);
  });

  test("drops a missing accuracy instead of inventing one", () => {
    const session = fakeSession();
    recordFinish(session, session.players[0], 20000, undefined);
    expect(session.players[0].accuracy).toBeNull();
  });
});

describe("canRecordRunnerUpFinish", () => {
  test("accepts a finish request that was already in flight", () => {
    const session = { status: "finished", finishedAt: new Date() };
    expect(canRecordRunnerUpFinish(session)).toBe(true);
  });

  test("rejects one that arrives long after the race ended", () => {
    const session = {
      status: "finished",
      finishedAt: new Date(Date.now() - 60 * 1000),
    };
    expect(canRecordRunnerUpFinish(session)).toBe(false);
  });

  test("rejects a race that never finished", () => {
    expect(canRecordRunnerUpFinish({ status: "active", finishedAt: null })).toBe(false);
    expect(canRecordRunnerUpFinish({ status: "cancelled", finishedAt: new Date() })).toBe(false);
  });
});

describe("seriesStandings", () => {
  test("empty series is undecided", () => {
    const s = seriesStandings([]);
    expect(s.isComplete).toBe(false);
    expect(s.winnerId).toBeNull();
    expect(s.finishedCount).toBe(0);
  });

  test("first to two wins takes the series", () => {
    const s = seriesStandings([
      { status: "finished", winnerId: "me" },
      { status: "finished", winnerId: "me" },
    ]);
    expect(s.winnerId).toBe("me");
    expect(s.isComplete).toBe(true);
    expect(s.wins).toEqual({ me: 2 });
  });

  test("1-1 after two games is a live decider", () => {
    const s = seriesStandings([
      { status: "finished", winnerId: "me" },
      { status: "finished", winnerId: "rival" },
    ]);
    expect(s.isComplete).toBe(false);
    expect(s.winnerId).toBeNull();
    expect(s.finishedCount).toBe(2);
  });

  test("leader after three finished games takes it", () => {
    const s = seriesStandings([
      { status: "finished", winnerId: "me" },
      { status: "finished", winnerId: "rival" },
      { status: "finished", winnerId: "me" },
    ]);
    expect(s.winnerId).toBe("me");
    expect(s.isComplete).toBe(true);
  });

  test("pending games do not count", () => {
    const s = seriesStandings([
      { status: "finished", winnerId: "me" },
      { status: "pending", winnerId: null },
    ]);
    expect(s.finishedCount).toBe(1);
    expect(s.isComplete).toBe(false);
  });
});

describe("practiceBotFor", () => {
  test("resolves all three difficulties with names and paces", () => {
    expect(practiceBotFor("easy")).toMatchObject({ name: "Rookie Bot", wpm: 30 });
    expect(practiceBotFor("medium")).toMatchObject({ name: "Dash Bot", wpm: 55 });
    expect(practiceBotFor("hard")).toMatchObject({ name: "Blaze Bot", wpm: 80 });
  });

  test("rejects unknown difficulties", () => {
    expect(practiceBotFor("grandmaster")).toBeNull();
    expect(practiceBotFor(null)).toBeNull();
  });
});

describe("pickPracticeBotWpm", () => {
  test("stays within ±4 of the base pace", () => {
    for (let i = 0; i < 50; i += 1) {
      const wpm = pickPracticeBotWpm("medium");
      expect(wpm).toBeGreaterThanOrEqual(51);
      expect(wpm).toBeLessThanOrEqual(59);
    }
  });

  test("returns null for unknown difficulties", () => {
    expect(pickPracticeBotWpm("nope")).toBeNull();
  });
});

describe("botProgressAt", () => {
  // 100-char passage at 60 wpm = 20 words = 20s to finish.
  const passage = "x".repeat(100);

  test("is linear in elapsed time", () => {
    expect(botProgressAt(60, passage, 10000)).toBeCloseTo(0.5, 5);
    expect(botProgressAt(60, passage, 20000)).toBe(1);
  });

  test("clamps past the finish and before the start", () => {
    expect(botProgressAt(60, passage, 60000)).toBe(1);
    expect(botProgressAt(60, passage, 0)).toBe(0);
    expect(botProgressAt(60, passage, -100)).toBe(0);
  });

  test("slower bots trail faster ones at the same instant", () => {
    expect(botProgressAt(30, passage, 10000)).toBeLessThan(
      botProgressAt(80, passage, 10000),
    );
  });
});

describe("arenaWeekKey", () => {
  test("keys a known Monday and Sunday into the same ISO week", () => {
    // Monday 2026-09-07 and Sunday 2026-09-13 (UTC) are ISO week 37.
    expect(arenaWeekKey(Date.UTC(2026, 8, 7, 12))).toBe("2026-W37");
    expect(arenaWeekKey(Date.UTC(2026, 8, 13, 23, 59))).toBe("2026-W37");
  });

  test("rolls over on Monday", () => {
    expect(arenaWeekKey(Date.UTC(2026, 8, 14, 0, 1))).toBe("2026-W38");
  });

  test("endsAt is the next Monday 00:00 UTC", () => {
    expect(arenaWeekEndsAt(Date.UTC(2026, 8, 9, 12))).toBe(Date.UTC(2026, 8, 14));
  });
});

describe("levelForXp", () => {
  test("climbs on a root curve", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(400)).toBe(3);
    expect(levelForXp(900)).toBe(4);
  });

  test("tolerates junk", () => {
    expect(levelForXp(null)).toBe(1);
    expect(levelForXp(-50)).toBe(1);
  });
});

describe("nextArenaStats", () => {
  const week = "2026-W37";

  test("a ranked win pays XP, extends the streak and feeds the board", () => {
    const next = nextArenaStats({}, { won: true, wpm: 82, practice: false, weekKey: week });
    expect(next).toMatchObject({
      xp: 100,
      wins: 1,
      losses: 0,
      bestWpm: 82,
      currentStreak: 1,
      bestStreak: 1,
      weekKey: week,
      weekGames: 1,
      weekWins: 1,
      weekTotalWpm: 82,
      weekBestWpm: 82,
    });
  });

  test("a loss resets the streak but keeps the best", () => {
    const prev = nextArenaStats({}, { won: true, wpm: 82, practice: false, weekKey: week });
    const next = nextArenaStats(prev, { won: false, wpm: 64, practice: false, weekKey: week });
    expect(next).toMatchObject({
      xp: 125,
      wins: 1,
      losses: 1,
      bestWpm: 82,
      currentStreak: 0,
      bestStreak: 1,
      weekGames: 2,
      weekTotalWpm: 146,
    });
  });

  test("practice pays XP only — no streak, no board", () => {
    const next = nextArenaStats({}, { won: true, wpm: 90, practice: true, weekKey: week });
    expect(next.xp).toBe(30);
    expect(next.wins).toBe(0);
    expect(next.currentStreak).toBe(0);
    expect(next.weekGames).toBe(0);
    expect(next.weekBestWpm).toBeNull();
  });

  test("a new week rolls the board but keeps lifetime totals", () => {
    const prev = nextArenaStats({}, { won: true, wpm: 82, practice: false, weekKey: week });
    const next = nextArenaStats(prev, { won: true, wpm: 70, practice: false, weekKey: "2026-W38" });
    expect(next.weekKey).toBe("2026-W38");
    expect(next.weekGames).toBe(1);
    expect(next.weekBestWpm).toBe(70);
    expect(next.wins).toBe(2);
    expect(next.bestWpm).toBe(82);
    expect(next.currentStreak).toBe(2);
  });

  test("boardOnly folds WPM without touching economy", () => {
    const prev = nextArenaStats({}, { won: false, wpm: null, practice: false, weekKey: week });
    const next = nextArenaStats(prev, { wpm: 71, weekKey: week, boardOnly: true });
    expect(next.xp).toBe(prev.xp);
    expect(next.losses).toBe(prev.losses);
    expect(next.weekGames).toBe(1);
    expect(next.weekTotalWpm).toBe(71);
    expect(next.bestWpm).toBe(71);
  });
});
