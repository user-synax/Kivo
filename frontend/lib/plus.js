// Client-side Kivo Plus helpers (pricing + UPI + plan checks).
// Server is the source of truth for caps and expiry — these only drive
// display copy and gating UI (same pattern as updateBanner).

// Manual-UPI sale: ₹49 for one month. Must match PLUS_PRICE_PAISA (4900)
// in backend/src/lib/plus.js — the server stamps the paise value.
export const PLUS_PRICE_INR = 49;
export const PLUS_PRICE_PAISA = 4900;

// Published payment destination. Set in frontend env:
// NEXT_PUBLIC_PLUS_UPI_ID=you@upi  (NEXT_PUBLIC_PLUS_PAYEE optional name)
export const PLUS_UPI_ID = process.env.NEXT_PUBLIC_PLUS_UPI_ID || "";
export const PLUS_PAYEE = process.env.NEXT_PUBLIC_PLUS_PAYEE || "Kivo";

// Review SLA shown across the /plus page and admin queue.
export const PLUS_REVIEW_HOURS = 24;
export const PLUS_DURATION_LABEL = "30 days";

// UPI intent deep link for one-tap pay on mobile (GPay/PhonePe/Paytm).
export function upiIntent() {
  if (!PLUS_UPI_ID) return null;
  const params = new URLSearchParams({
    pa: PLUS_UPI_ID,
    pn: PLUS_PAYEE,
    am: String(PLUS_PRICE_INR),
    cu: "INR",
    tn: "Kivo Plus (1 month)",
  });
  return `upi://pay?${params.toString()}`;
}

// Expiry-aware Plus check for session user objects ({ plan, planExpiresAt }).
// Mirrors backend getEffectivePlan — expired Plus reads as free.
export function isPlusUser(user) {
  if (!user || user.plan !== "plus") return false;
  const exp = user.planExpiresAt
    ? new Date(user.planExpiresAt).getTime()
    : null;
  if (exp != null && Number.isFinite(exp) && exp < Date.now()) return false;
  return true;
}

// "5h left" / "2d left" / "expired" for claim review deadlines.
export function reviewTimeLeft(expiresAt) {
  if (!expiresAt) return "—";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "expired";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h left`;
  return `${Math.floor(hours / 24)}d left`;
}
