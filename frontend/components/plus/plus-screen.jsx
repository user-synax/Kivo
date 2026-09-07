"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/navbar/navbar";
import { SiteFooter } from "@/components/site-footer";
import { apiGet, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  isPlusUser,
  PLUS_PAYEE,
  PLUS_PRICE_INR,
  PLUS_UPI_ID,
  reviewTimeLeft,
  upiIntent,
} from "@/lib/plus";

const PERKS = [
  "Custom profile banner upload (up to 8 MB)",
  "Profile effects — glow, gradient name, aura",
  "Higher limits across messaging and media",
  "Early access to new customization drops",
];

function useClaim() {
  const [user, setUser] = useState(() => {
    try {
      return getSession();
    } catch {
      return null;
    }
  });
  const [claim, setClaim] = useState(null);
  const [loading, setLoading] = useState(Boolean(user));

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet("/api/v1/plus/claim");
      setClaim(data?.claim || null);
    } catch {
      // Logged-out or error — the page still renders pricing + UPI steps.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) refresh();
    else setLoading(false);
  }, [user, refresh]);

  return { user, claim, loading, refresh, setUser };
}

function ClaimForm({ onFiled }) {
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!/^\d{12}$/.test(utr.trim())) {
      setError("Enter the 12-digit UTR / UPI reference number.");
      return;
    }
    setBusy(true);
    try {
      const data = await apiPost("/api/v1/plus/claim", { utr: utr.trim() });
      onFiled(data);
    } catch (err) {
      setError(err?.message || "Could not submit. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
      <label
        htmlFor="plus-utr"
        className="font-sans text-[13px] font-medium text-ink"
      >
        UPI reference (UTR) — 12 digits from your payment history
      </label>
      <input
        id="plus-utr"
        inputMode="numeric"
        autoComplete="off"
        placeholder="e.g. 409812345678"
        value={utr}
        maxLength={12}
        onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))}
        className="w-full rounded-xl border border-hairline bg-surface-1 px-4 py-2.5 font-mono text-[15px] tracking-widest text-ink placeholder:text-ink-muted/50 focus:border-electric-blue focus:outline-none"
      />
      {error && (
        <p role="alert" className="font-sans text-[13px] text-[#ff5577]">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || utr.trim().length !== 12}
        className="rounded-full bg-ink px-5 py-2.5 font-sans text-[14px] font-semibold text-inverse-ink transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Submitting…" : "I've paid — activate my Plus"}
      </button>
    </form>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
      className="shrink-0 rounded-full border border-hairline px-3 py-1.5 font-sans text-[12px] font-medium text-ink-muted transition-colors hover:border-ink-muted hover:text-ink"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

function StatusCard({ claim, onRefile }) {
  if (!claim) return null;
  if (claim.status === "pending") {
    return (
      <div className="rounded-2xl border border-hairline bg-surface-1 p-5">
        <p className="font-sans text-[14px] font-semibold text-ink">
          Payment received — under review
        </p>
        <p className="mt-1 font-sans text-[13px] leading-relaxed text-ink-muted">
          UTR <span className="font-mono">{claim.utr}</span> is queued. We
          activate Plus within 24 hours ({reviewTimeLeft(claim.expiresAt)}). No
          need to file again.
        </p>
      </div>
    );
  }
  if (claim.status === "rejected") {
    return (
      <div className="rounded-2xl border border-hairline bg-surface-1 p-5">
        <p className="font-sans text-[14px] font-semibold text-ink">
          We couldn't verify that payment
        </p>
        <p className="mt-1 font-sans text-[13px] leading-relaxed text-ink-muted">
          {claim.reviewNote ||
            "The UTR didn't match a ₹49 payment. Check the number and file again."}
        </p>
        <button
          type="button"
          onClick={onRefile}
          className="mt-3 rounded-full border border-hairline px-4 py-2 font-sans text-[13px] font-medium text-ink transition-colors hover:border-ink-muted"
        >
          File a new claim
        </button>
      </div>
    );
  }
  if (claim.status === "expired") {
    return (
      <div className="rounded-2xl border border-hairline bg-surface-1 p-5">
        <p className="font-sans text-[14px] font-semibold text-ink">
          That claim lapsed after 24 hours
        </p>
        <p className="mt-1 font-sans text-[13px] leading-relaxed text-ink-muted">
          If you paid, just file again with the same UTR — it jumps back to the
          top of the review queue.
        </p>
        <button
          type="button"
          onClick={onRefile}
          className="mt-3 rounded-full border border-hairline px-4 py-2 font-sans text-[13px] font-medium text-ink transition-colors hover:border-ink-muted"
        >
          File again
        </button>
      </div>
    );
  }
  return null;
}

export function PlusScreen() {
  const { user, claim, loading, refresh } = useClaim();
  const [refiling, setRefiling] = useState(false);
  const plus = isPlusUser(user);
  const intent = upiIntent();
  const showForm =
    user && !plus && (!claim || refiling || claim.status === "approved");

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <Navbar />
      <main className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-32 sm:px-6">
        <p className="font-sans text-[12px] font-medium uppercase tracking-[0.05em] text-ink-muted">
          Kivo Plus
        </p>
        <h1 className="font-goga mt-2 text-[32px] font-medium leading-tight tracking-tight sm:text-[40px]">
          Plus for ₹{PLUS_PRICE_INR}/month
        </h1>
        <p className="mt-3 font-sans text-[15px] leading-relaxed text-ink-muted">
          One price, 30 days of Plus. Pay by UPI, paste the 12-digit reference,
          and we activate you within 24 hours.
        </p>

        <ul className="mt-8 flex flex-col gap-3">
          {PERKS.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 rounded-2xl border border-hairline bg-surface-1 px-4 py-3.5"
            >
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-electric-blue/15 font-sans text-[12px] font-bold text-electric-blue"
              >
                ✓
              </span>
              <span className="font-sans text-[14px] leading-snug">{p}</span>
            </li>
          ))}
        </ul>

        <section
          aria-label="Get Plus"
          className="mt-8 rounded-2xl border border-hairline bg-surface-1 p-5 sm:p-6"
        >
          {loading ? (
            <p className="font-sans text-[14px] text-ink-muted">Loading…</p>
          ) : plus ? (
            <div>
              <p className="font-sans text-[15px] font-semibold">
                You&apos;re on Plus ✓
              </p>
              <p className="mt-1 font-sans text-[13px] text-ink-muted">
                {user?.planExpiresAt
                  ? `Active until ${new Date(user.planExpiresAt).toLocaleDateString()}.`
                  : "Active on your account."}{" "}
                Manage it anytime from your profile editor.
              </p>
            </div>
          ) : !user ? (
            <div>
              <p className="font-sans text-[15px] font-semibold">
                Sign in to get Plus
              </p>
              <p className="mt-1 font-sans text-[13px] text-ink-muted">
                Plus lives on your Kivo account — log in first, then pay ₹
                {PLUS_PRICE_INR} by UPI.
              </p>
              <Link
                href="/login"
                className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-sans text-[14px] font-semibold text-inverse-ink transition-opacity hover:opacity-90"
              >
                Log in
              </Link>
            </div>
          ) : (
            <div>
              <ol className="flex flex-col gap-4">
                <li className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink font-sans text-[12px] font-bold text-inverse-ink"
                  >
                    1
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-[14px] font-semibold">
                      Pay ₹{PLUS_PRICE_INR} by UPI
                    </p>
                    {PLUS_UPI_ID ? (
                      <>
                        <div className="mt-2 flex items-center gap-2 rounded-xl border border-hairline bg-canvas px-3 py-2.5">
                          <span className="min-w-0 flex-1 truncate font-mono text-[14px]">
                            {PLUS_UPI_ID}
                          </span>
                          <CopyButton text={PLUS_UPI_ID} />
                        </div>
                        <p className="mt-1.5 font-sans text-[12px] text-ink-muted">
                          Payee: {PLUS_PAYEE} · Amount: ₹{PLUS_PRICE_INR}
                        </p>
                        {intent && (
                          <a
                            href={intent}
                            className="mt-2 inline-block rounded-full border border-hairline px-4 py-2 font-sans text-[13px] font-medium transition-colors hover:border-ink-muted"
                          >
                            Pay in your UPI app →
                          </a>
                        )}
                      </>
                    ) : (
                      <p className="mt-1 font-sans text-[13px] text-ink-muted">
                        UPI payments are opening soon — check back shortly.
                      </p>
                    )}
                  </div>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink font-sans text-[12px] font-bold text-inverse-ink"
                  >
                    2
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-[14px] font-semibold">
                      Paste the 12-digit UTR below
                    </p>
                    <p className="mt-0.5 font-sans text-[12px] text-ink-muted">
                      Find it in your UPI app&apos;s payment history.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink font-sans text-[12px] font-bold text-inverse-ink"
                  >
                    3
                  </span>
                  <p className="font-sans text-[14px]">
                    <span className="font-semibold">
                      We activate within 24 hours.
                    </span>{" "}
                    <span className="text-ink-muted">
                      You&apos;ll see Plus on your profile as soon as it&apos;s
                      live.
                    </span>
                  </p>
                </li>
              </ol>

              <div className="mt-5">
                {showForm ? (
                  <ClaimForm
                    onFiled={() => {
                      setRefiling(false);
                      refresh();
                    }}
                  />
                ) : (
                  <StatusCard
                    claim={claim}
                    onRefile={() => setRefiling(true)}
                  />
                )}
              </div>
            </div>
          )}
        </section>

        <p className="mt-6 font-sans text-[12px] leading-relaxed text-ink-muted">
          One claim per payment. If your claim lapses after 24 hours without
          review, just file again — it returns to the top of the queue. Wrong
          UTR? Double-check your UPI history and refile.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
