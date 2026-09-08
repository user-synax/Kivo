import { describe, it, expect } from "vitest";
import { createMessageSchema } from "../src/modules/messages/messages.validation.js";

describe("scheduled validation", () => {
  it("rejects past scheduledAt", () => {
    const res = createMessageSchema.safeParse({
      content: "hi",
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(res.success).toBe(false);
  });
  it("accepts future scheduledAt", () => {
    const res = createMessageSchema.safeParse({
      content: "hi",
      scheduledAt: new Date(Date.now() + 60000).toISOString(),
    });
    expect(res.success).toBe(true);
  });
  it("rejects scheduledAt beyond 30 days", () => {
    const res = createMessageSchema.safeParse({
      content: "hi",
      scheduledAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(res.success).toBe(false);
  });
});
