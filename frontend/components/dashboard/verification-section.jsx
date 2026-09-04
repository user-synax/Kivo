"use client";

import { BadgeCheck, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { apiGet, apiPost } from "@/lib/api";

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)]">
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
              {description}
            </p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function ProviderIcon({ provider }) {
  if (provider === "google") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
        <path
          fill="#4285F4"
          d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
        />
        <path
          fill="#FBBC05"
          d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l3.98-3.1Z"
        />
        <path
          fill="#EA4335"
          d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l3.98 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
        />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-[var(--text-primary)]"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

// Account verification via OAuth providers. Local accounts link Google/GitHub
// to earn per-provider badges; both together earn the native Kivo badge.
export function VerificationSection() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiGet("/api/v1/users/me")
      .then((data) => {
        if (active) setMe(data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const startVerify = async (provider) => {
    setBusy(provider);
    setError("");
    try {
      const data = await apiPost(`/api/v1/auth/oauth/${provider}/link-url`, {});
      const url = data?.url;
      if (!url) throw new Error("Could not start verification");
      window.location.href = url;
    } catch (e) {
      setError(e?.message || "Could not start verification. Please try again.");
      setBusy(null);
    }
  };

  if (loading) return null;

  const google = Boolean(me?.googleVerified);
  const github = Boolean(me?.githubVerified);
  const native = Boolean(me?.verified);
  if (google && github) {
    // Fully verified — the native badge section (BadgeSection) covers display
    // prefs; here we just confirm state.
    return (
      <SectionCard
        icon={BadgeCheck}
        title="Account verification"
        description="Both providers verified — you've earned the Kivo verified badge."
      >
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
          <VerifiedBadge size="sm" decorative />
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            Kivo Verified
          </span>
          <span className="ml-auto shrink-0 text-[11px] text-[var(--text-muted)]">
            Google + GitHub linked
          </span>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon={BadgeCheck}
      title="Account verification"
      description={
        native
          ? "Verify with Google and GitHub to add provider badges to your public profile."
          : "Verify with Google and GitHub to earn provider badges — verify both to earn the Kivo verified badge."
      }
    >
      <div className="space-y-2">
        <div className="flex flex-col gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <ProviderIcon provider="google" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                Google
              </p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">
                {google
                  ? me?.googleEmail
                    ? `Verified · ${me.googleEmail}`
                    : "Verified"
                  : "Not verified yet"}
              </p>
            </div>
            {google && (
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-500">
                Verified
              </span>
            )}
          </div>
          {!google && (
            <button
              type="button"
              onClick={() => startVerify("google")}
              disabled={busy !== null}
              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--ink)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--inverse-ink)] transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
            >
              {busy === "google" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Verify with Google
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <ProviderIcon provider="github" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[var(--text-primary)]">
                GitHub
              </p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">
                {github
                  ? me?.githubEmail
                    ? `Verified · ${me.githubEmail}`
                    : "Verified"
                  : "Not verified yet"}
              </p>
            </div>
            {github && (
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-500">
                Verified
              </span>
            )}
          </div>
          {!github && (
            <button
              type="button"
              onClick={() => startVerify("github")}
              disabled={busy !== null}
              className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--ink)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--inverse-ink)] transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
            >
              {busy === "github" && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              Verify with GitHub
            </button>
          )}
        </div>

        {(google || github) && !native && (
          <p className="px-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
            {google &&
              !github &&
              "GitHub verification left to earn the Kivo badge."}
            {github &&
              !google &&
              "Google verification left to earn the Kivo badge."}
          </p>
        )}
        {error && (
          <p className="px-1 text-[12px] text-[var(--destructive)]">{error}</p>
        )}
      </div>
    </SectionCard>
  );
}

export default VerificationSection;
