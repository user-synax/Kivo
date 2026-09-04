import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  displayName: z.string().trim().min(1, "Display name is required").max(50, "Display name too long").optional(),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username too long")
    .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers and underscores")
    .optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
});

export const loginSchema = z.object({
  // Accepts either an email or a username.
  identifier: z.string().min(1, "Identifier is required"),
  password: z.string().min(1, "Password is required"),
});

// 2FA code: a 6-digit TOTP code or a "ABCDE-FGHIJ"-style backup code. Kept
// loose (normalized in the service) so both forms pass through cleanly.
const twoFactorCode = () =>
  z
    .string()
    .trim()
    .min(4, "Code is required")
    .max(32, "Code too long");

export const twoFactorCodeSchema = z.object({
  code: twoFactorCode(),
});

export const twoFactorDisableSchema = z.object({
  code: twoFactorCode(),
  // Re-authentication: disabling 2FA needs the account password too, so a
  // stolen session cookie alone cannot silently downgrade security.
  // OAuth-only accounts have no password — optional so they can disable
  // with the code alone (the service skips the check when no hash exists).
  password: z.string().min(1).optional().or(z.literal("")),
});

export const loginTwoFactorSchema = z.object({
  // Short-lived JWT minted when the password check passed.
  ticket: z.string().min(1, "Verification session is required"),
  code: twoFactorCode(),
});


// Convenience parser that throws a VALIDATION_ERROR ApiError on failure.
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
