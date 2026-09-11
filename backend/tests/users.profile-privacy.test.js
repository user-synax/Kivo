import { describe, it, expect } from "vitest";
import { User } from "../src/models/User.js";
import { updateMeSchema, privacySchema } from "../src/modules/users/users.validation.js";
import { isStatusExpired } from "../src/modules/users/users.service.js";

describe("User Horizon 1 fields", () => {
  it("has pronouns and statusExpiresAt with defaults", () => {
    const u = new User({ email: "a@b.com", displayName: "A" });
    expect(u.pronouns).toBe(null);
    expect(u.statusExpiresAt).toBe(null);
    expect(u.privacyPreferences.showOnline).toBe(true);
    expect(u.privacyPreferences.showJoinedDate).toBe(true);
    expect(u.privacyPreferences.showSocialLinks).toBe(true);
    expect(u.privacyPreferences.discoverableByNearby).toBe(true);
  });
});

describe("updateMe validation Horizon 1", () => {
  it("accepts valid pronouns he/him", () => {
    const r = updateMeSchema.safeParse({ pronouns: "he/him" });
    expect(r.success).toBe(true);
  });
  it("rejects pronouns too long", () => {
    const r = updateMeSchema.safeParse({ pronouns: "a".repeat(21) });
    expect(r.success).toBe(false);
  });
  it("accepts statusExpiresAt null", () => {
    const r = updateMeSchema.safeParse({ statusExpiresAt: null });
    expect(r.success).toBe(true);
  });
  it("accepts future statusExpiresAt", () => {
    const r = updateMeSchema.safeParse({ statusExpiresAt: new Date(Date.now()+3600000).toISOString() });
    expect(r.success).toBe(true);
  });
  it("rejects past statusExpiresAt", () => {
    const r = updateMeSchema.safeParse({ statusExpiresAt: new Date(Date.now()-1000).toISOString() });
    expect(r.success).toBe(false);
  });
  it("accepts privacy flags", () => {
    const r = privacySchema.safeParse({ discoverableByNearby: true, showOnline: false, showJoinedDate: false, showSocialLinks: true });
    expect(r.success).toBe(true);
  });
});

describe("status expiry helper", () => {
  it("returns true when statusExpiresAt in past", () => {
    expect(isStatusExpired({ status: "busy", statusExpiresAt: new Date(Date.now()-1000) })).toBe(true);
  });
  it("returns false when future", () => {
    expect(isStatusExpired({ status: "busy", statusExpiresAt: new Date(Date.now()+100000) })).toBe(false);
  });
  it("returns false when null", () => {
    expect(isStatusExpired({ status: "busy", statusExpiresAt: null })).toBe(false);
  });
});
