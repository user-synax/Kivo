import { describe, it, expect } from "vitest";
import { User } from "../src/models/User.js";

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
