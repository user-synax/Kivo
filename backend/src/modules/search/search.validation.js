import { z } from "zod";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, "Query must be at least 2 characters").max(100),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

// Convenience parser that throws a VALIDATION_ERROR on failure.
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
