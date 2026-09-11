"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";

// Neutral loader shown briefly while the client confirms a session. Uses the
// default (Phosphor) palette directly so it works even outside ThemeProvider
// (e.g. the GuestGate on login), avoiding any flash of mis-themed colors.
const LOADER = { base: "#f2f1f3", border: "#e5e4e7", accent: "#7a40ed" };

function Loader() {
  return (
    <div
      className="flex h-[100dvh] items-center justify-center"
      style={{ backgroundColor: LOADER.base }}
    >
      <div
        className="size-6 animate-spin rounded-full border-2"
        style={{ borderColor: LOADER.border, borderTopColor: LOADER.accent }}
      />
    </div>
  );
}

// Wrap public surfaces (landing, login, signup). Logged-in users are bounced to
// /app or /onboarding. We render children during load so the marketing page still SSRs; the
// redirect fires on the client.
export function GuestGate({ children }) {
  const router = useRouter();
  useEffect(() => {
    const user = getSession();
    if (!user) return;
    // New users who haven't finished onboarding go to /onboarding (60s funnel)
    // Old users have onboardingCompletedAt null but createdAt older than feature — don't force them.
    const isNew = user.createdAt ? Date.now() - new Date(user.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000 : false;
    const needsOnboarding = !user.onboardingCompleted && !user.onboardingCompletedAt && isNew;
    if (needsOnboarding && window.location.pathname !== "/onboarding") {
      router.replace("/onboarding");
    } else if (!needsOnboarding) {
      // Only redirect to /app if we're on a guest-only route
      const path = window.location.pathname;
      if (path === "/login" || path === "/signup" || path === "/") {
        router.replace("/app");
      }
    }
  }, [router]);
  return children;
}

// Wrap the authenticated app. Until we've confirmed a session on the client we
// show a neutral loader (no flash of the dashboard), then redirect to /login if
// there is no session.
export function AuthGate({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!getSession()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);
  if (!ready) return <Loader />;
  return children;
}
