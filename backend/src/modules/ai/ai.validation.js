import { z } from "zod";

const text = z.string().trim().min(1, "Text required").max(8000, "Text too long");

export const proofreadSchema = z.object({ text });

export const rewriteSchema = z.object({
  text,
  tone: z.enum(["formal", "friendly", "shorter", "longer", "confident"]).default("friendly"),
});

export const translateSchema = z.object({
  text,
  // BCP-47-ish target, e.g. "en", "hi", "es". Kept loose; normalized in service.
  targetLang: z.string().trim().min(2).max(12).default("en"),
  sourceLang: z.string().trim().min(2).max(12).optional(),
});

export const repliesSchema = z.object({
  messages: z.array(z.string().trim().min(1).max(1000)).min(1).max(8),
});

export const summarizeSchema = z.object({
  messages: z.array(z.string().trim().min(1).max(2000)).min(1).max(50),
  style: z.enum(["bullets", "short"]).default("bullets"),
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
