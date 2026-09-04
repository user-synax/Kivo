"use client";

import { cn } from "@/lib/utils";

function GoogleG({ className = "h-3.5 w-3.5" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
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

function GithubMark({ className = "h-3.5 w-3.5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

// Provider verification chips shown on public profiles. Google / GitHub only
// render when that provider was OAuth-verified; the native Kivo badge (the
// existing VerifiedBadge) is earned when BOTH are present.
export function ProviderVerifiedBadges({ profile, className = "" }) {
  if (!profile) return null;
  const google = Boolean(profile.googleVerified);
  const github = Boolean(profile.githubVerified);
  if (!google && !github) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {google && (
        <span
          title="Google-verified account"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)]"
        >
          <GoogleG />
          Google Verified
        </span>
      )}
      {github && (
        <span
          title="GitHub-verified account"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-muted)]"
        >
          <GithubMark />
          GitHub Verified
        </span>
      )}
    </div>
  );
}

export function hasAnyProviderBadge(profile) {
  return Boolean(profile?.googleVerified || profile?.githubVerified);
}

export default ProviderVerifiedBadges;
