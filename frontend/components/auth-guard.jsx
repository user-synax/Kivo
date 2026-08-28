"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSession } from "@/lib/auth";

// Neutral loader shown briefly while the client confirms a session. Uses the
// default (Phosphor) palette directly so it works even outside ThemeProvider
// (e.g. the GuestGate on login), avoiding any flash of mis-themed colors.
const LOADER = { base: "#000000", border: "#485346", accent: "#7fee64" };

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
// /app. We render children during load so the marketing page still SSRs; the
// redirect fires on the client.
export function GuestGate({ children }) {
  const router = useRouter();
  useEffect(() => {
    if (getSession()) router.replace("/app");
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
