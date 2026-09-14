import { z } from "zod";

// Kivo Games validation. Every body/query is checked server-side — the client is
// never trusted (same rule as the rest of the API).
export const GAME_KIND_VALUES = ["typing", "chess"];

// Games start from the arena by inviting a specific player. The backend resolves
// (or creates) the DM that hosts the chat chip.
export const inviteGameSchema = z.object({
  targetUserId: z.string().min(1, "targetUserId is required"),
  kind: z.enum(GAME_KIND_VALUES).optional().default("typing"),
});

// Live progress ping from a racer. Clamped to 0..1 here and to a monotonic
// value in the service so a reloading client cannot rewind the progress bar.
export const progressSchema = z.object({
  progress: z.number().min(0).max(1),
});

// Solo practice vs bot. No target player, no DM — just a difficulty.
export const PRACTICE_DIFFICULTY_VALUES = ["easy", "medium", "hard"];

// One chess move in long-algebraic squares. Promotion is a single piece
// letter; the server re-validates everything against the stored FEN.
export const chessMoveSchema = z.object({
  from: z.string().regex(/^[a-h][1-8]$/, "from must look like e2"),
  to: z.string().regex(/^[a-h][1-8]$/, "to must look like e4"),
  promotion: z.enum(["n", "b", "r", "q"]).optional(),
});

export const practiceSchema = z.object({
  difficulty: z.enum(PRACTICE_DIFFICULTY_VALUES).optional().default("medium"),
});

// A finisher reports how accurate they were and how long it took. WPM is derived
// server-side from the passage and the server-observed elapsed time (never
// trusted from the client).
export const finishSchema = z.object({
  accuracy: z.number().min(0).max(100).optional(),
  elapsedMs: z.number().int().min(0).max(60 * 60 * 1000).optional(),
});

// Convenience parsers that throw a VALIDATION_ERROR ApiError on failure.
export function parseBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const err = new Error(first?.message || "Validation failed");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    err.issues = result.error.issues;
    throw err;
  }
  return result.data;
}

export function parseQuery(schema, query) {
  const result = schema.safeParse(query);
  if (!result.success) {
    const first = result.error.issues[0];
    const err = new Error(first?.message || "Validation failed");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    err.issues = result.error.issues;
    throw err;
  }
  return result.data;
}
