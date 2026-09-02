"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProfileContent } from "@/components/profile/profile-content";
import { JoinKivoModal } from "@/components/profile/join-kivo-modal";
import { getSession } from "@/lib/auth";

export default function PublicProfilePage() {
  const params = useParams();
  const username = params?.username
    ? decodeURIComponent(params.username)
    : null;

  const [showJoin, setShowJoin] = useState(false);

  // Show the "Join Kivo" modal for visitors without a session.
  useEffect(() => {
    if (!getSession()) {
      // Brief delay so the profile page renders first — the modal is
      // a gentle nudge, not a wall.
      const t = setTimeout(() => setShowJoin(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  if (!username) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[var(--canvas)] px-6">
        <p className="text-sm text-[var(--ink-muted)]">
          Invalid profile.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--canvas)]">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b border-[var(--hairline)] bg-[var(--canvas)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[720px] items-center gap-3 px-5 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--ink)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Back to home
          </Link>
          <span
            className="h-3 w-px bg-[var(--hairline)]"
            aria-hidden="true"
          />
          <span className="truncate text-[13px] font-medium text-[var(--ink)]">
            @{username}
          </span>
        </div>
      </div>

      {/* Profile content */}
      <div className="mx-auto max-w-[720px] border-x border-[var(--hairline-soft)] max-sm:border-x-0">
        <ProfileContent username={username} />
      </div>

      {/* Join Kivo modal — only for non-logged-in visitors */}
      <JoinKivoModal
        open={showJoin}
        onClose={() => setShowJoin(false)}
      />
    </div>
  );
}
