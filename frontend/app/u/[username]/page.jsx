"use client";

import { Share2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { JoinKivoModal } from "@/components/profile/join-kivo-modal";
import { ProfileContent } from "@/components/profile/profile-content";
import { ShareProfileModal } from "@/components/profile/share-profile-modal";
import { apiGet } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { ownerSkin } from "@/lib/profile-skin";

export default function PublicProfilePage() {
  const params = useParams();
  const username = params?.username
    ? decodeURIComponent(params.username)
    : null;

  const [showJoin, setShowJoin] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [profile, setProfile] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  // The page fetches the profile once so the chrome (top bar, background) can
  // adopt the OWNER's colors, and hands the loaded profile to ProfileContent
  // (which skips its own fetch when it receives one).
  useEffect(() => {
    if (!username) return;
    let active = true;
    setProfile(null);
    setFetchError(false);
    apiGet(`/api/v1/users/${encodeURIComponent(username)}/profile`)
      .then((data) => {
        if (!active) return;
        setProfile(data || null);
      })
      .catch(() => {
        if (!active) return;
        setFetchError(true);
      });
    return () => {
      active = false;
    };
  }, [username]);

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
        <p className="text-sm text-[var(--ink-muted)]">Invalid profile.</p>
      </div>
    );
  }

  // Owner skin: accent + canvas tint adopted from the profile owner so the
  // public page wears *their* look (falls back to the default palette when
  // the owner hasn't customized anything).
  const skinVars = ownerSkin(profile?.appearance);

  return (
    <div
      className="min-h-[100dvh] bg-[var(--canvas)]"
      style={skinVars || undefined}
    >
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
          <span className="h-3 w-px bg-[var(--hairline)]" aria-hidden="true" />
          <span className="truncate text-[13px] font-medium text-[var(--ink)]">
            @{username}
          </span>
          <button
            type="button"
            onClick={() => setShowShare(true)}
            aria-label="Share this profile"
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-1)] px-3 text-[12px] font-medium text-[var(--ink-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[var(--ink)]/30 hover:text-[var(--ink)]"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span className="max-sm:hidden">Share</span>
          </button>
        </div>
      </div>

      {/* Profile content */}
      <div className="mx-auto max-w-[720px] border-x border-[var(--hairline-soft)] max-sm:border-x-0">
        {fetchError ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-[var(--ink-muted)]">
              Profile not found.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block text-[13px] font-medium text-[var(--accent-blue)] hover:underline"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <ProfileContent
            username={username}
            profile={profile}
            ownerAppearance={profile?.appearance || null}
            fetchDisabled
          />
        )}
      </div>

      {/* Share modal — QR + copy + downloadable share card */}
      <ShareProfileModal
        username={username}
        profile={profile}
        open={showShare}
        onClose={() => setShowShare(false)}
      />

      {/* Join Kivo modal — only for non-logged-in visitors */}
      <JoinKivoModal open={showJoin} onClose={() => setShowJoin(false)} />
    </div>
  );
}
