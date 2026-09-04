"use client";

import { Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { JoinKivoModal } from "@/components/profile/join-kivo-modal";
import { ProfileContent } from "@/components/profile/profile-content";
import { ShareProfileModal } from "@/components/profile/share-profile-modal";
import { apiGet } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { ownerSkin } from "@/lib/profile-skin";

/**
 * Client chrome for the server-rendered public profile page (/u/:username).
 *
 * The parent (server) page fetches the profile anonymously and passes it down,
 * so crawlers and logged-out visitors see real content. When the backend was
 * unreachable at render time (`serverProfile` null) the page still works: the
 * top bar renders and ProfileContent runs its own fetch below (harmless for
 * signed-in visitors, and the anonymous fetch now succeeds for everyone else).
 */
export function PublicProfileView({ username, serverProfile = null }) {
  const [showJoin, setShowJoin] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [profile, setProfile] = useState(serverProfile);

  // The server-rendered profile is fetched ANONYMOUSLY (so crawlers and
  // logged-out visitors see it). When a session exists, silently re-fetch it
  // with the viewer's Bearer token to enrich relationship/block state, then
  // hand the richer object down — the server payload shows meanwhile, so there
  // is no skeleton flash.
  useEffect(() => {
    if (!getSession()) return undefined;
    let active = true;
    apiGet(`/api/v1/users/${encodeURIComponent(username)}/profile`)
      .then((data) => {
        if (active && data) setProfile(data);
      })
      .catch(() => {
        // Keep the anonymous payload — never worse than "nothing".
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

  // Owner skin: accent + canvas tint adopted from the profile owner so the
  // public page wears *their* look (falls back to the default palette when the
  // owner hasn't customized anything or the profile hasn't loaded yet).
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
        <ProfileContent
          username={username}
          profile={profile}
          ownerAppearance={profile?.appearance || null}
          fetchDisabled={profile != null}
        />
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

export default PublicProfileView;
