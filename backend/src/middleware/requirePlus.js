import User from "../models/User.js";
import { forbidden } from "../utils/errors.js";
import { getEffectivePlan, PLANS } from "../lib/plus.js";

// Route guard for Plus-only endpoints. Loads the caller's entitlement from
// the DB (never trusts the client) and rejects free/expired plans with the
// same PLUS_REQUIRED code the banner upload already uses, so the frontend
// can share one upgrade affordance.
export async function requirePlus(req, res, next) {
  try {
    if (!req.user?.userId) {
      throw forbidden("Authentication required", "PLUS_REQUIRED");
    }
    const doc = await User.findById(req.user.userId)
      .select("plan planExpiresAt")
      .lean();
    const plan = getEffectivePlan(doc);
    if (plan !== PLANS.PLUS) {
      throw forbidden(
        "This feature requires Kivo Plus",
        "PLUS_REQUIRED",
      );
    }
    req.plan = plan;
    req.isPlus = true;
    next();
  } catch (err) {
    next(err);
  }
}

// Lighter variant: annotates req.plan / req.isPlus without rejecting.
// Useful for tiered-limit endpoints (attachments, search) that serve both
// tiers at different caps.
export async function attachPlan(req, res, next) {
  try {
    if (req.user?.userId) {
      const doc = await User.findById(req.user.userId)
        .select("plan planExpiresAt")
        .lean();
      const plan = getEffectivePlan(doc);
      req.plan = plan;
      req.isPlus = plan === PLANS.PLUS;
    } else {
      req.plan = PLANS.FREE;
      req.isPlus = false;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export default requirePlus;
