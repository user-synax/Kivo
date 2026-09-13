import { describe, expect, test } from "bun:test";
import {
  canRecordRunnerUpFinish,
  computeWpm,
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
