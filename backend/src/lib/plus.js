// Central Kivo Plus entitlement + limits (single source of truth).
//
// `plan` on the User stays the source of truth. `planExpiresAt` (null = no
// expiry, e.g. manual/admin grant) makes an expired Plus read as free without
// needing an immediate DB write — the billing webhook/cron does the cleanup.
//
// Services import { getLimitsForUser, isPlusUser } and enforce per-plan caps
// server-side. The client is never trusted (same pattern as updateBanner).

export const PLANS = Object.freeze({ FREE: "free", PLUS: "plus" });

// Manual-UPI Plus sale: fixed price, fixed duration, fixed review window.
// Single source of truth — the claim flow, the /plus page copy, and the
// expiry sweep all derive from these (never hardcode ₹49 / 30d / 24h).
export const PLUS_PRICE_PAISA = 4900; // ₹49 for one month
export const PLUS_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days per grant
export const PLUS_REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000; // admin grants within 24h

// Per-plan caps. Free values preserve today's behavior (no downgrade);
// Plus values are strictly headroom + expression.
export const PLAN_LIMITS = Object.freeze({
  free: Object.freeze({
    messageMaxLength: 4000,
    messageEditWindowMs: 15 * 60 * 1000, // 15 min, then edit locked
    attachmentsPerMessage: 10,
    attachmentMaxBytes: 30 * 1024 * 1024, // 30MB
    pinsPerConversation: 10,
    savedMax: 200,
    groupsOwnedMax: 5,
    groupMembersMax: 20,
    spacesOwnedMax: 3,
    spaceMembersMax: 50,
    channelsPerSpaceMax: 10,
    groupCallMaxParticipants: 5,
    searchLimitPerCategory: 5,
  }),
  plus: Object.freeze({
    messageMaxLength: 8000,
    messageEditWindowMs: null, // unlimited
    attachmentsPerMessage: 20,
    attachmentMaxBytes: 100 * 1024 * 1024, // 100MB
    pinsPerConversation: 50,
    savedMax: 1000,
    groupsOwnedMax: 20,
    groupMembersMax: 100,
    spacesOwnedMax: 15,
    spaceMembersMax: 300,
    channelsPerSpaceMax: 30,
    groupCallMaxParticipants: 25,
    searchLimitPerCategory: 20,
  }),
});

// Effective plan for a user doc / { plan, planExpiresAt } pair.
// Expired Plus reads as free.
export function getEffectivePlan(user) {
  if (!user) return PLANS.FREE;
  const plan = user.plan || PLANS.FREE;
  if (plan !== PLANS.PLUS) return PLANS.FREE;
  const exp = user.planExpiresAt ? new Date(user.planExpiresAt).getTime() : null;
  if (exp != null && Number.isFinite(exp) && exp < Date.now()) {
    return PLANS.FREE;
  }
  return PLANS.PLUS;
}

export function isPlusUser(user) {
  return getEffectivePlan(user) === PLANS.PLUS;
}

export function getLimitsForPlan(plan) {
  return PLAN_LIMITS[plan === PLANS.PLUS ? PLANS.PLUS : PLANS.FREE];
}

export function getLimitsForUser(user) {
  return getLimitsForPlan(getEffectivePlan(user));
}

// Fetch the requester's effective plan + limits (one lean query).
// Services use this instead of trusting any client-supplied tier.
export async function getRequesterPlan(User, userId) {
  const doc = await User.findById(userId).select("plan planExpiresAt").lean();
  const plan = getEffectivePlan(doc);
  return { plan, isPlus: plan === PLANS.PLUS, limits: getLimitsForPlan(plan) };
}
