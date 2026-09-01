"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ProfileContent } from "@/components/profile/profile-content";

export default function PublicProfilePage() {
  const params = useParams();
  const username = params?.username ? decodeURIComponent(params.username) : null;

  if (!username) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[var(--canvas)] px-6">
        <p className="text-sm text-[var(--ink-muted)]">Invalid profile.</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--canvas)]">
      {/* hairline top bar — keeps nav chrome consistent with app */}
      <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--canvas)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[720px] items-center gap-3 px-5 py-3 sm:px-6">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--ink)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to chat
          </Link>
          <span className="h-3 w-px bg-[var(--hairline)]" aria-hidden="true" />
          <span className="truncate text-[13px] font-medium text-[var(--ink)]">@{username}</span>
        </div>
      </div>

      {/* content — not a centered card; editorial width, left-aligned stack */}
      <div className="mx-auto max-w-[720px] border-x border-[var(--hairline-soft)] max-sm:border-x-0">
        <ProfileContent username={username} />
      </div>
    </div>
  );
}
