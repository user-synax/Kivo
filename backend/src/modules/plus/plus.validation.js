import { z } from "zod";

// UPI transaction reference (UTR/RRN) as shown in GPay/PhonePe/Paytm history:
// exactly 12 digits.
export const claimSchema = z.object({
  utr: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "Enter the 12-digit UTR / UPI reference number"),
});

export const reviewSchema = z.object({
  // Optional note stored on the claim (e.g. rejection reason shown to user).
  note: z.string().trim().max(500, "Note too long").optional(),
});

export const listClaimsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "expired"]).default("pending"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

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
    throw err;
  }
  return result.data;
}
