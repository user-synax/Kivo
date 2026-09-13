import { describe, expect, test } from "bun:test";
import { finishSchema, inviteGameSchema, progressSchema } from "./games.validation.js";

// Kivo Games — validation contract tests.
//
// These run with Bun's built-in runner (the same `bun:test` pattern as
// src/lib/totp.test.js) and are dependency-free: they only exercise the Zod
// schemas that guard the games API, so they need no database or env vars.

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
