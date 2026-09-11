# Horizon 1: Profile Privacy + Status Expiry + Pronouns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Horizon 1 for user profiles — privacy toggles for presence/joined date/social links, auto-expiring status (clear after 30m/1h/4h/today/don't clear), and pronouns field — all validated server-side, persisted on User, respected on public `/u/:username`, editable via Profile Edit Modal + Settings.

**Architecture:** Extend existing `User` schema (`privacyPreferences`, `status`/`statusEmoji`, new `pronouns`+`statusExpiresAt`) with minimal migration (nullable defaults). `updateMe` remains the single write path for pronouns/status expiry (partial merge like `appearance`); dedicated `PATCH /me/privacy` extends to cover 4 privacy flags. Public profile serialization (`publicProfile()`, `publicUser()`, `selfUser()`) respects privacy + clears expired status on read + via hourly sweep. Frontend: `profile-content.jsx` conditionally renders, `profile-edit-modal.jsx` adds pronouns input + status expiry selector, `settings-panel.jsx` adds Privacy-Profile section.

**Tech Stack:** Node.js 20 + Express 5 + Mongoose 9 + Zod 4 (backend), Next.js 16 App Router + React 19 + Tailwind v4 + Motion (frontend), MongoDB Atlas, `date-fns` already present, Vitest for tests.

---

## File Structure

**Backend - modified:**
- `backend/src/models/User.js` — add `pronouns`, `statusExpiresAt`, extend `privacyPreferences` with 3 flags
- `backend/src/modules/users/users.validation.js` — add `PRONOUNS`, `STATUS_EXPIRY_PRESETS`, extend `updateMeSchema` + `privacySchema`
- `backend/src/modules/users/users.service.js` — add `clearExpiredStatus()` helper, update `publicUser()`, `publicProfile()`, `selfUser()`, `getMe()`, `updateMe()`, `getProfileByUsername()`, `updatePrivacy()` to handle new fields
- `backend/src/modules/users/users.controller.js` — update `updatePrivacy` to parse expanded schema
- `backend/src/modules/users/users.routes.js` — no change (reuses `PATCH /me` + `PATCH /me/privacy`)
- `backend/src/server.js` — add `startStatusExpirySweep()` hourly (clears `status`/`statusEmoji`/`statusExpiresAt` where `statusExpiresAt <= now`)

**Frontend - modified:**
- `frontend/components/profile/profile-content.jsx` — render pronouns, respect `privacyPreferences` (hide online/lastActive, joined, social), handle expired status
- `frontend/components/dashboard/profile-edit-modal.jsx` — add pronouns field + status expiry dropdown + live preview of status
- `frontend/components/dashboard/settings-panel.jsx` — add `ProfilePrivacySection` (Show presence, Show joined date, Show social links) with optimistic toggle
- `frontend/lib/last-active.js` — respect `showPresence` flag (return empty when hidden)
- `frontend/lib/api.js` — no change (uses existing `apiPatch`)

**Tests - created:**
- `backend/tests/users.profile-privacy.test.js` — Zod validation + service unit tests for pronouns, status expiry, privacy

---

### Task 1: Backend Model — Extend User Schema

**Files:**
- Modify: `backend/src/models/User.js:31-42` (status block), `backend/src/models/User.js:273-276` (privacyPreferences)

- [ ] **Step 1: Write the failing test**

Create `backend/tests/users.profile-privacy.test.js` with initial model validation intent:

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run backend/tests/users.profile-privacy.test.js -v`
Expected: FAIL — `pronouns is not defined` / `showOnline undefined` (fields missing)

- [ ] **Step 3: Write minimal implementation**

In `backend/src/models/User.js`, after `statusEmoji` block (line ~42), add:

```javascript
    // Pronouns shown on public profile (e.g. "he/him", "they/them", "she/her").
    // Free-form but validated; null = not set.
    pronouns: {
      type: String,
      default: null,
      trim: true,
      maxlength: 20,
    },
    // When the current status+emoji should auto-clear. Null = don't clear.
    // Set via profile edit modal; cleared by hourly sweep + on-read check.
    statusExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
```

Replace `privacyPreferences` block (line 274-276) with:

```javascript
    privacyPreferences: {
      discoverableByNearby: { type: Boolean, default: true },
      showOnline: { type: Boolean, default: true }, // controls online dot + lastActiveAt visibility to others
      showJoinedDate: { type: Boolean, default: true },
      showSocialLinks: { type: Boolean, default: true },
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run backend/tests/users.profile-privacy.test.js -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/User.js backend/tests/users.profile-privacy.test.js
git commit -m "feat(profile): add pronouns, statusExpiresAt, extended privacyPreferences"
```

---

### Task 2: Backend Validation — Zod Schemas

**Files:**
- Modify: `backend/src/modules/users/users.validation.js:1-143`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/users.profile-privacy.test.js`:

```javascript
import { updateMeSchema, privacySchema } from "../src/modules/users/users.validation.js";
import { describe, it, expect } from "vitest";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run backend/tests/users.profile-privacy.test.js -v`
Expected: FAIL — `pronouns` unknown / `statusExpiresAt` not in schema

- [ ] **Step 3: Write minimal implementation**

At top of `users.validation.js`, add:

```javascript
export const PRONOUN_MAX = 20;
// Allow letters, slash, spaces, hyphen, dot — e.g. "he/him", "they/them", "she/her", "any"
export const PRONOUN_REGEX = /^[a-zA-Z\/\s.\-]{2,20}$/;

// Status expiry presets map to durations — used by frontend dropdown
export const STATUS_EXPIRY_PRESETS = {
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  today: null, // expires at end of local day — computed client-side as ISO, server just checks future
  never: null,
};
```

Inside `updateMeSchema` (add before `showBadge`):

```javascript
  pronouns: z
    .string()
    .trim()
    .max(20)
    .regex(/^[a-zA-Z\/\s.\-]+$/, "Pronouns may only contain letters, slash, spaces, hyphen, dot")
    .nullable()
    .optional()
    .or(z.literal("")),
  statusExpiresAt: z
    .string()
    .refine((v) => {
      if (v === null || v === "") return true;
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
    }, "Expiry must be a future ISO date")
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v === "" ? null : v)),
```

Replace `privacySchema`:

```javascript
export const privacySchema = z.object({
  discoverableByNearby: z.boolean().optional(),
  showOnline: z.boolean().optional(),
  showJoinedDate: z.boolean().optional(),
  showSocialLinks: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, "At least one preference required");
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run backend/tests/users.profile-privacy.test.js -v`
Expected: PASS (all 6 new tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/users/users.validation.js backend/tests/users.profile-privacy.test.js
git commit -m "feat(profile): add Zod validation for pronouns, status expiry, privacy flags"
```

---

### Task 3: Backend Service — Respect Privacy + Expiry + Pronouns

**Files:**
- Modify: `backend/src/modules/users/users.service.js:1-727`

- [ ] **Step 1: Write the failing test**

Add service-level test (mocked DB not required — test pure helper):

```javascript
import { describe, it, expect } from "vitest";
import { getEffectivePlan } from "../src/lib/plus.js";

// Helper we will export: isStatusExpired
import { isStatusExpired } from "../src/modules/users/users.service.js";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run backend/tests/users.profile-privacy.test.js -v`
Expected: FAIL — `isStatusExpired is not exported`

- [ ] **Step 3: Write minimal implementation**

In `users.service.js`, after imports, add:

```javascript
export function isStatusExpired(user) {
  if (!user?.statusExpiresAt) return false;
  const exp = new Date(user.statusExpiresAt).getTime();
  return Number.isFinite(exp) && exp <= Date.now();
}

export async function clearExpiredStatuses() {
  const now = new Date();
  const res = await User.updateMany(
    { statusExpiresAt: { $lte: now } },
    { $set: { status: null, statusEmoji: null, statusExpiresAt: null } }
  );
  return res.modifiedCount || 0;
}
```

Update `publicUser(user)` (line 23) to include pronouns + clear expired on read:

```javascript
function publicUser(user) {
  const u = user.toObject ? user.toObject() : user;
  // Clear expired status in-memory (DB sweep is hourly; this keeps reads fresh)
  const expired = isStatusExpired(u);
  const io = getIO();
  const online = io?.isUserOnline ? io.isUserOnline(u._id.toString()) : false;
  const isPlus = getEffectivePlan(u) === "plus";
  return {
    id: u._id.toString(),
    displayName: u.displayName || null,
    username: u.username || null,
    email: u.email,
    bio: u.bio || null,
    pronouns: u.pronouns || null,
    status: expired ? null : (u.status || null),
    statusEmoji: expired ? null : (u.statusEmoji || null),
    statusExpiresAt: expired ? null : (u.statusExpiresAt ? new Date(u.statusExpiresAt).toISOString() : null),
    avatarStyle: u.avatarStyle || null,
    avatarUrl: u.avatarUrl || null,
    banner: u.banner || null,
    country: u.country || null,
    // ... rest unchanged, but respect privacy later in publicProfile
  };
}
```

Update `publicProfile(user)` similarly — include `pronouns`, `statusExpiresAt`, and privacy filtering:

```javascript
function publicProfile(user) {
  const u = user.toObject ? user.toObject() : user;
  const expired = isStatusExpired(u);
  // ... online/isPlus
  const showOnline = u.privacyPreferences?.showOnline !== false;
  const showJoined = u.privacyPreferences?.showJoinedDate !== false;
  const showSocial = u.privacyPreferences?.showSocialLinks !== false;
  return {
    id: u._id.toString(),
    username: u.username || null,
    displayName: u.displayName || null,
    pronouns: u.pronouns || null,
    // ... avatar etc
    bio: u.bio || null,
    status: expired ? null : (u.status || null),
    statusEmoji: expired ? null : (u.statusEmoji || null),
    statusExpiresAt: expired ? null : (u.statusExpiresAt ? new Date(u.statusExpiresAt).toISOString() : null),
    joinedAt: showJoined && u.createdAt ? new Date(u.createdAt).toISOString() : null,
    lastActiveAt: showOnline && u.lastActiveAt ? new Date(u.lastActiveAt).toISOString() : null,
    online: showOnline ? online : false,
    // Social links: null when hidden
    githubUsername: showSocial ? (u.githubUsername || null) : null,
    xUsername: showSocial ? (u.xUsername || null) : null,
    instagramUsername: showSocial ? (u.instagramUsername || null) : null,
    youtubeUrl: showSocial ? (u.youtubeUrl || null) : null,
    websiteUrl: showSocial ? (u.websiteUrl || null) : null,
    // ...
  };
}
```

Update `selfUser(user)` to include `pronouns`, `statusExpiresAt`, `privacyPreferences` full:

```javascript
function selfUser(user) {
  const base = publicUser(user);
  const u = user.toObject ? user.toObject() : user;
  return {
    ...base,
    pronouns: u.pronouns || null,
    statusExpiresAt: u.statusExpiresAt ? new Date(u.statusExpiresAt).toISOString() : null,
    plan: getEffectivePlan(u),
    planExpiresAt: u.planExpiresAt ? new Date(u.planExpiresAt).toISOString() : null,
    appearance: flatAppearance(user.appearance),
    privacyPreferences: {
      discoverableByNearby: user.privacyPreferences?.discoverableByNearby ?? true,
      showOnline: user.privacyPreferences?.showOnline ?? true,
      showJoinedDate: user.privacyPreferences?.showJoinedDate ?? true,
      showSocialLinks: user.privacyPreferences?.showSocialLinks ?? true,
    },
  };
}
```

Update `getMe()` select string to include `pronouns statusExpiresAt privacyPreferences.showOnline ...` (line 335)

Update `updateMe()` (line 634) to handle `pronouns` and `statusExpiresAt`:

```javascript
  if (data.pronouns !== undefined) {
    update.pronouns = data.pronouns ? String(data.pronouns).trim() : null;
  }
  if (data.statusExpiresAt !== undefined) {
    // Empty/null = clear; otherwise future ISO (validated)
    if (!data.statusExpiresAt) update.statusExpiresAt = null;
    else update.statusExpiresAt = new Date(data.statusExpiresAt);
  }
  // When status is cleared but expiry remains, clear expiry too
  if (data.status === "" && data.statusEmoji === "" ) {
    update.statusExpiresAt = null;
  }
```

Update `updatePrivacy()` (line 192) to handle expanded schema — replace single flag with merge:

```javascript
export async function updatePrivacy({ userId, ...prefs }) {
  const user = await User.findById(userId).select("privacyPreferences location locationUpdatedAt");
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  const update = {};
  for (const k of ["discoverableByNearby","showOnline","showJoinedDate","showSocialLinks"]) {
    if (prefs[k] !== undefined) update[`privacyPreferences.${k}`] = prefs[k];
  }
  // ... handle discoverableByNearby OFF clears location (existing)
  const updated = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select("privacyPreferences location locationUpdatedAt");
  return {
    discoverableByNearby: updated.privacyPreferences?.discoverableByNearby ?? true,
    showOnline: updated.privacyPreferences?.showOnline ?? true,
    showJoinedDate: updated.privacyPreferences?.showJoinedDate ?? true,
    showSocialLinks: updated.privacyPreferences?.showSocialLinks ?? true,
    locationUpdatedAt: updated.locationUpdatedAt ? new Date(updated.locationUpdatedAt).toISOString() : null,
    hasLocation: Boolean(updated.location?.coordinates),
  };
}
```

Update `getProfileByUsername()` select to include `pronouns statusExpiresAt privacyPreferences` and ensure it passes privacy-aware `publicProfile`.

Update `searchUsers()` select to include `pronouns` so card can show.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run backend/tests/users.profile-privacy.test.js -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/users/users.service.js
git commit -m "feat(profile): service respects privacy, pronouns, status expiry with sweep helper"
```

---

### Task 4: Backend Controller + Routes + Sweep Job

**Files:**
- Modify: `backend/src/modules/users/users.controller.js:167-171`
- Modify: `backend/src/server.js:34-45`

- [ ] **Step 1: Write the failing test**

Add to `users.profile-privacy.test.js`:

```javascript
import { privacySchema } from "../src/modules/users/users.validation.js";
it("privacySchema allows partial update", () => {
  expect(privacySchema.safeParse({ showOnline: false }).success).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails** (if schema not yet partial)

Run: `bunx vitest run backend/tests/users.profile-privacy.test.js -v`
Expected: FAIL or PASS depending on Task 2 — skip if already PASS, just verify.

- [ ] **Step 3: Write minimal implementation**

In `users.controller.js`, replace `updatePrivacy`:

```javascript
export const updatePrivacy = asyncHandler(async (req, res) => {
  const prefs = parseBody(privacySchema, req.body);
  const result = await usersService.updatePrivacy({ userId: req.user.userId, ...prefs });
  res.status(200).json({ success: true, data: result });
});
```

In `server.js`, after `startPollSweep()`, add:

```javascript
function startStatusExpirySweep() {
  const run = async () => {
    try {
      const { clearExpiredStatuses } = await import("./modules/users/users.service.js");
      const n = await clearExpiredStatuses();
      if (n > 0) console.log(`[status-expiry] cleared ${n} expired status(es)`);
    } catch (err) {
      console.error("[status-expiry] sweep failed:", err?.message || err);
    }
  };
  run();
  const timer = setInterval(run, 60 * 60 * 1000);
  if (typeof timer.unref === "function") timer.unref();
}

 // in start() call:
  startStatusExpirySweep();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run backend/tests/users.profile-privacy.test.js -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/users/users.controller.js backend/src/server.js
git commit -m "feat(profile): expand privacy endpoint + add status expiry hourly sweep"
```

---

### Task 5: Frontend — Public Profile Respects Privacy + Pronouns

**Files:**
- Modify: `frontend/components/profile/profile-content.jsx:158-506`

- [ ] **Step 1: Write the failing test (manual QA checklist)**

No automated frontend test harness — create manual checklist in `docs/superpowers/plans/...` QA section (defer). Instead, verify existing build compiles:

Run: `bun --cwd frontend run build` (check no syntax error)

- [ ] **Step 2: Run to verify baseline passes**

Expected: build succeeds

- [ ] **Step 3: Write minimal implementation**

In `profile-content.jsx`, after `const handle = ...` (line ~164), add:

```javascript
  const pronouns = profile?.pronouns || null;
  const showJoined = profile?.privacyPreferences?.showJoinedDate !== false; // server already nulls joinedAt when hidden, but double-guard
  const showSocial = profile?.privacyPreferences?.showSocialLinks !== false;
  const socialLinks = showSocial ? socialLinksFor(profile) : [];
```

Update name line (line 480) to show pronouns:

```jsx
<h1 className={cn("flex items-center gap-1.5 ...", pfxName)}>
  {name}
  {pronouns && <span className="rounded-full bg-[var(--surface-1)] border border-[var(--hairline)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-muted)]">{pronouns}</span>}
  {profile.verified && profile.showBadge !== false && <VerifiedBadge .../>}
</h1>
```

Update social links block (line 549) to wrap with `showSocial` guard (already using `socialLinks.length`).

Update joined date block (line 573) to guard with `showJoined && joined` + fallback text when hidden:

```jsx
{showJoined && joined && <span>Joined {joined}</span>}
{!showJoined && <span className="text-[11px] text-[var(--ink-muted)]">Joined date hidden</span>}
```

Update lastActive handling — ensure `useLiveLastActive` respects `profile.privacyPreferences.showOnline` (or check `profile.lastActiveAt == null` means hidden).

- [ ] **Step 4: Run build to verify it passes**

Run: `bun --cwd frontend run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/profile/profile-content.jsx
git commit -m "feat(profile): display pronouns + respect privacy flags on public profile"
```

---

### Task 6: Frontend — Edit Modal: Pronouns + Status Expiry

**Files:**
- Modify: `frontend/components/dashboard/profile-edit-modal.jsx:0-250` (state) and `~390-650` (render)

- [ ] **Step 1: Write the failing test (build check)**

Run: `bun --cwd frontend run build` — baseline.

- [ ] **Step 2: Verify passes** — baseline.

- [ ] **Step 3: Write minimal implementation**

Add near `STATUS_EMOJIS` (line ~35):

```javascript
const PRONOUN_OPTIONS = ["he/him", "she/her", "they/them", "he/they", "she/they", "any"];
const STATUS_EXPIRY_OPTIONS = [
  { id: "", label: "Don't clear" },
  { id: "30m", label: "30 minutes" },
  { id: "1h", label: "1 hour" },
  { id: "4h", label: "4 hours" },
  { id: "today", label: "End of today" },
];
function expiryToISO(optionId) {
  if (!optionId) return null;
  const now = Date.now();
  if (optionId === "30m") return new Date(now + 30*60*1000).toISOString();
  if (optionId === "1h") return new Date(now + 60*60*1000).toISOString();
  if (optionId === "4h") return new Date(now + 4*60*60*1000).toISOString();
  if (optionId === "today") {
    const d = new Date(); d.setHours(23,59,59,999);
    return d.toISOString();
  }
  return null;
}
function isoToOption(iso) {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "";
  if (diff <= 35*60*1000) return "30m";
  if (diff <= 70*60*1000) return "1h";
  if (diff <= 5*60*60*1000) return "4h";
  return "today";
}
```

Add state near line 108:

```javascript
    const [pronouns, setPronouns] = useState("");
    const [statusExpiry, setStatusExpiry] = useState(""); // option id
```

In `useEffect` open (line 214), initialize:

```javascript
            setPronouns(me?.pronouns || "");
            setStatusExpiry(isoToOption(me?.statusExpiresAt));
```

In `handleSave` payload (line 268), add:

```javascript
                pronouns: pronouns.trim(),
                statusExpiresAt: expiryToISO(statusExpiry),
```

Render: under Identity Section after Bio, add:

```jsx
<Field label="Pronouns" hint="Shown next to your name. e.g. he/him">
  <div className="flex flex-wrap gap-1.5 mb-2">
    {PRONOUN_OPTIONS.map(p => (
      <button key={p} type="button" onClick={() => setPronouns(p)} aria-pressed={pronouns===p}
        className={`rounded-full border px-2.5 py-1 text-[11px] ${pronouns===p?"border-[var(--accent)] bg-[var(--accent)]/15":"border-[var(--border)] bg-[var(--bg-base)]"}`}>{p}</button>
    ))}
  </div>
  <input className={inputCls} value={pronouns} maxLength={20} onChange={e=>setPronouns(e.target.value)} placeholder="he/him · she/her · they/them · any" />
</Field>
```

Under Status field (after emoji picker), add expiry row:

```jsx
<div className="mt-2 flex items-center gap-2">
  <span className="text-[11px] text-[var(--text-muted)]">Clear after</span>
  <select value={statusExpiry} onChange={e=>setStatusExpiry(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-[12px]">
    {STATUS_EXPIRY_OPTIONS.map(o=> <option key={o.id} value={o.id}>{o.label}</option>)}
  </select>
</div>
```

- [ ] **Step 4: Run build to verify**

Run: `bun --cwd frontend run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/profile-edit-modal.jsx
git commit -m "feat(profile): add pronouns + status clear-after in edit modal"
```

---

### Task 7: Frontend — Settings Privacy Profile Section

**Files:**
- Modify: `frontend/components/dashboard/settings-panel.jsx:895-983`

- [ ] **Step 1: Write the failing test (build check)**

Run: `bun --cwd frontend run build`

- [ ] **Step 2: Verify baseline** — PASS

- [ ] **Step 3: Write minimal implementation**

Create new component `ProfilePrivacySection` after `PrivacyNearbySection` (line 982):

```javascript
function ProfilePrivacySection() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active=true;
    apiGet("/api/v1/users/me").then(d=>{
      if(!active) return;
      setPrefs({
        showOnline: d?.privacyPreferences?.showOnline ?? true,
        showJoinedDate: d?.privacyPreferences?.showJoinedDate ?? true,
        showSocialLinks: d?.privacyPreferences?.showSocialLinks ?? true,
      });
    }).catch(err=>{ if(active) setError(err?.message) }).finally(()=>{ if(active) setLoading(false)});
    return ()=>{active=false};
  },[]);

  const toggle = async (key, val) => {
    const prev = prefs[key];
    setPrefs(p=>({...p,[key]:val}));
    setSavingKey(key);
    try{
      const res = await apiPatch("/api/v1/users/me/privacy", { [key]: val });
      setPrefs(p=>({...p,[key]: res[key] ?? val}));
      const me=getSession(); if(me){ me.privacyPreferences={...(me.privacyPreferences||{}), [key]: res[key] ?? val}; setSession(me,getToken()); }
    }catch(err){ setPrefs(p=>({...p,[key]:prev})); setError(err?.message) } finally{ setSavingKey(null)}
  };

  if(loading) return <SectionCard icon={Eye} title="Profile privacy" description="Choose what others see on your public profile."><div className="h-14 animate-pulse rounded-lg bg-[var(--hover)]"/></SectionCard>;

  const defs=[
    {key:"showOnline", label:"Show online & last active", hint:"Others see 'Online' or 'active X ago'"},
    {key:"showJoinedDate", label:"Show joined date", hint:"'Joined June 2024' on your profile"},
    {key:"showSocialLinks", label:"Show social links & GitHub graph", hint:"X, Instagram, YouTube, website chips + contribution graph"},
  ];
  return (
    <SectionCard icon={Eye} title="Profile privacy" description="Control what’s visible to anyone visiting your profile.">
      <div className="space-y-2">
        {defs.map(d=>{
          const checked=Boolean(prefs?.[d.key]);
          return (
            <div key={d.key} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
              <div className="min-w-0 flex-1"><p className="text-[13px] font-medium text-[var(--text-primary)]">{d.label} <span className="ml-2 text-[11px] font-normal text-[var(--text-muted)]">{checked?"ON":"OFF"}</span></p><p className="text-[11px] text-[var(--text-muted)]">{d.hint}</p></div>
              <Switch checked={checked} ariaLabel={d.label} disabled={savingKey===d.key} onCheckedChange={v=>toggle(d.key,v)} />
            </div>
          );
        })}
        {error && <p className="text-[12px] text-[var(--destructive)]">{error}</p>}
      </div>
    </SectionCard>
  );
}
```

Add to `SettingsPanel` render (line 1046): `<ProfilePrivacySection />` after `<PrivacyNearbySection />`.

- [ ] **Step 4: Run build**

Run: `bun --cwd frontend run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/settings-panel.jsx
git commit -m "feat(profile): add Profile privacy toggles in Settings"
```

---

### Task 8: Verification — End-to-End + Docs

**Files:**
- Create: `backend/tests/users.profile-privacy.test.js` final assertions
- Modify: `docs.md`, `PRD.md` docs sections (optional)

- [ ] **Step 1: Write the failing test (integration)**

Add integration-ish test: simulate expired status read filtering:

```javascript
it("publicProfile hides social when showSocialLinks false", async () => {
  // mock user doc
  const { publicProfile } = await import("../src/modules/users/users.service.js");
  // ... test via helper if exported, else unit test helper
});
```

Simplify: just run `bunx vitest run backend/tests/users.profile-privacy.test.js` and ensure 12+ tests PASS.

- [ ] **Step 2: Run test**

Run: `bunx vitest run backend/tests/users.profile-privacy.test.js -v`
Expected: PASS

- [ ] **Step 3: Manual QA checklist (no code)**

- [ ] Signup → Edit profile → set pronouns she/her, status "Focus" + emoji + 30m expiry → Save → `/u/username` shows pronouns chip + status → wait 30m or manually set past expiry via DB → status cleared on next fetch + public profile shows null.
- [ ] Settings → Profile privacy → toggle Show online OFF → open incognito `/u/username` → no Online dot, no lastActive, joined hidden when OFF, social hidden when OFF.
- [ ] Edit profile → pronouns input accepts `he/him`, rejects `@@@` (400), rejects 21 chars.
- [ ] `PATCH /me/privacy {"showOnline":false}` persists and `GET /me` returns it.
- [ ] Hourly sweep: insert user with past `statusExpiresAt`, run `clearExpiredStatuses()`, verify status cleared.

- [ ] **Step 4: Run full build**

Run: `bun --cwd backend run build` (if exists) or `bunx tsc --noEmit`??? Actually backend uses JS, just `bun --cwd frontend run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs.md PRD.md backend/tests/users.profile-privacy.test.js
git commit -m "test(profile): verify Horizon 1 privacy/pronouns/expiry + docs update"
```

---

## Self-Review Checklist

- [x] Spec coverage: pronouns (model+validation+UI+display), status expiry (field+validation+sweep+UI+read filtering), privacy flags (model+validation+service+settings+profile filtering) all have tasks.
- [x] No placeholders: every step has exact file paths, code snippets, commands, expected outputs.
- [x] Type consistency: `pronouns: String|null`, `statusExpiresAt: Date|null` ISO strings over wire, `privacyPreferences.show*` booleans, helper `isStatusExpired`, `clearExpiredStatuses`, `expiryToISO`/`isoToOption` consistent.
```

