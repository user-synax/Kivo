import { badRequest, conflict, notFound } from "../../utils/errors.js";
import User from "../../models/User.js";
import PlusRequest from "../../models/PlusRequest.js";
import { sendEmail } from "../../lib/email.js";
import env from "../../config/env.js";
import {
  getEffectivePlan,
  PLUS_PRICE_PAISA,
  PLUS_REVIEW_WINDOW_MS,
} from "../../lib/plus.js";

function publicClaim(doc) {
  const c = doc.toObject ? doc.toObject() : doc;
  return {
    id: c._id.toString(),
    utr: c.utr,
    amountPaise: c.amountPaise,
    status: c.status,
    expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
    reviewNote: c.reviewNote || null,
    reviewedAt: c.reviewedAt ? new Date(c.reviewedAt).toISOString() : null,
    createdAt: c.createdAt,
  };
}

// File a payment claim after paying ₹49 to the published UPI ID. Guards:
// already-Plus and an existing pending claim both 409 (client surfaces the
// current status instead of stacking duplicates).
export async function createClaim({ userId, utr }) {
  const user = await User.findById(userId).select(
    "displayName username email plan planExpiresAt",
  );
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  if (getEffectivePlan(user) === "plus") {
    throw conflict("You are already on Kivo Plus", "ALREADY_PLUS");
  }
  const pending = await PlusRequest.findOne({ userId, status: "pending" })
    .select("_id")
    .lean();
  if (pending) {
    throw conflict(
      "You already have a payment under review — please wait up to 24 hours",
      "CLAIM_PENDING",
    );
  }

  const claim = await PlusRequest.create({
    userId,
    utr,
    amountPaise: PLUS_PRICE_PAISA,
    expiresAt: new Date(Date.now() + PLUS_REVIEW_WINDOW_MS),
  });

  // Notify the admin who paid — fire-and-forget so a mail hiccup never fails
  // the claim itself. ADMIN_EMAIL doubles as the inbox (same address that
  // signs into /admin).
  if (env.adminEmail) {
    const who =
      user.displayName || user.username
        ? `${user.displayName || ""} (@${user.username || "—"})`.trim()
        : user.email;
    sendEmail({
      to: env.adminEmail,
      subject: `New Kivo Plus claim — ${who} (₹${(PLUS_PRICE_PAISA / 100).toFixed(0)})`,
      html: [
        `<p>A user paid for <b>Kivo Plus (₹${(PLUS_PRICE_PAISA / 100).toFixed(0)} / month)</b> via UPI.</p>`,
        `<p>User: <b>${who}</b> &lt;${user.email}&gt;<br/>`,
        `UTR: <b>${utr}</b><br/>`,
        `Claim filed: ${new Date().toISOString()}</p>`,
        `<p>Review within 24h in the admin panel → Plus queue (approve grants 30 days).</p>`,
      ].join(""),
    }).catch((err) => {
      console.error("[plus] admin notify email failed:", err?.message || err);
    });
  }

  return publicClaim(claim);
}

// Latest claim for the signed-in user (drives the /plus status card).
export async function getMyClaim({ userId }) {
  const claim = await PlusRequest.findOne({ userId })
    .sort({ createdAt: -1 })
    .lean();
  if (!claim) return { claim: null };
  return { claim: publicClaim(claim) };
}

// Hourly sweep (called from server boot): lapse pending claims past their 24h
// review window, and clear Plus-only profile effects on users whose paid
// grant expired (getEffectivePlan already reads them as free — this just
// scrubs the cosmetic leftover).
export async function sweepPlus() {
  const now = new Date();
  const [claims, users] = await Promise.all([
    PlusRequest.updateMany(
      { status: "pending", expiresAt: { $lt: now } },
      { $set: { status: "expired" } },
    ),
    User.updateMany(
      { plan: "plus", planExpiresAt: { $ne: null, $lt: now } },
      { $set: { profileEffect: "none" } },
    ),
  ]);
  return {
    expiredClaims: claims.modifiedCount || 0,
    scrubbedEffects: users.modifiedCount || 0,
  };
}
