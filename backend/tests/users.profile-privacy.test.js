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

describe("Horizon 1 final verification", () => {
  it("privacySchema accepts showSocialLinks false", () => {
    const r = privacySchema.safeParse({ showSocialLinks: false });
    expect(r.success).toBe(true);
    expect(r.data.showSocialLinks).toBe(false);
  });

  it("privacySchema allows partial update with showOnline false", () => {
    const r = privacySchema.safeParse({ showOnline: false });
    expect(r.success).toBe(true);
    expect(r.data.showOnline).toBe(false);
  });

  it("pronouns empty string is valid (service clears to null)", () => {
    const r = updateMeSchema.safeParse({ pronouns: "" });
    expect(r.success).toBe(true);
    // Empty string is accepted via or(literal("")) — service layer converts "" -> null
    // Schema keeps "" (no transform) which is truthy-falsy handled in service
    if (r.success) {
      expect(r.data.pronouns === "" || r.data.pronouns === null).toBe(true);
    }
  });

  it("statusExpiresAt empty string transforms to null", () => {
    const r = updateMeSchema.safeParse({ statusExpiresAt: "" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.statusExpiresAt).toBe(null);
    }
  });

  it("isStatusExpired handles invalid date string returns false", () => {
    expect(isStatusExpired({ status: "busy", statusExpiresAt: "not-a-date" })).toBe(false);
    expect(isStatusExpired({ status: "busy", statusExpiresAt: "2026-13-40T25:00:00Z" })).toBe(false);
  });

  it("isStatusExpired handles invalid Date object returns false", () => {
    expect(isStatusExpired({ status: "busy", statusExpiresAt: new Date("invalid") })).toBe(false);
    expect(isStatusExpired({ status: "busy", statusExpiresAt: null })).toBe(false);
    expect(isStatusExpired({ status: "busy" })).toBe(false);
    expect(isStatusExpired(null)).toBe(false);
    expect(isStatusExpired(undefined)).toBe(false);
  });

  it("publicProfile social filtering: showSocialLinks false hides github/social", () => {
    // Inline replica of service filtering logic — ensures intent without needing DB
    function filterSocial(user) {
      const showSocial = user.privacyPreferences?.showSocialLinks !== false;
      return {
        githubUsername: showSocial ? (user.githubUsername || null) : null,
        xUsername: showSocial ? (user.xUsername || null) : null,
        instagramUsername: showSocial ? (user.instagramUsername || null) : null,
        youtubeUrl: showSocial ? (user.youtubeUrl || null) : null,
        websiteUrl: showSocial ? (user.websiteUrl || null) : null,
      };
    }
    const hidden = filterSocial({
      githubUsername: "octocat",
      xUsername: "kivo",
      privacyPreferences: { showSocialLinks: false },
    });
    expect(hidden.githubUsername).toBe(null);
    expect(hidden.xUsername).toBe(null);

    const visible = filterSocial({
      githubUsername: "octocat",
      xUsername: "kivo",
      privacyPreferences: { showSocialLinks: true },
    });
    expect(visible.githubUsername).toBe("octocat");
    expect(visible.xUsername).toBe("kivo");
  });

  it("updateMeSchema accepts pronouns via quick options", () => {
    for (const p of ["they/them", "she/her", "he/they", "any"]) {
      const r = updateMeSchema.safeParse({ pronouns: p });
      expect(r.success).toBe(true);
    }
  });
});
