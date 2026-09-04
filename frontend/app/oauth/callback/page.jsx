"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { apiGet } from "@/lib/api";
import { setSession } from "@/lib/auth";

// Landing page for the backend OAuth callback redirects:
//   /oauth/callback?accessToken=...   -> full login/signup, store + go /app
//   /oauth/callback?twoFactor=1&ticket=... -> provider passed, 2FA still needed
//   /oauth/callback?linked=google     -> Settings verify flow, back to /app
//   /oauth/callback?oauth_error=...   -> show the error with a retry link
function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Working…");
  const [error, setError] = useState("");

  useEffect(() => {
    const accessToken = searchParams?.get("accessToken");
    const ticket = searchParams?.get("ticket");
    const twoFactor = searchParams?.get("twoFactor");
    const linked = searchParams?.get("linked");
    const oauthError = searchParams?.get("oauth_error");
    const message = searchParams?.get("message");

    if (oauthError) {
      setError(
        message && message !== oauthError
          ? message
          : "Google/GitHub sign-in failed. Please try again.",
      );
      setStatus("");
      return;
    }

    if (linked) {
      const name = linked === "google" ? "Google" : "GitHub";
      setStatus(`${name} verified! Taking you back…`);
      // Refresh the cached session user so Settings shows the new badge.
      apiGet("/api/v1/users/me")
        .then((me) => {
          try {
            const raw = localStorage.getItem("kivo:session");
            const parsed = raw ? JSON.parse(raw) : {};
            localStorage.setItem(
              "kivo:session",
              JSON.stringify({ user: me || parsed.user || null }),
            );
          } catch {}
        })
        .catch(() => {})
        .finally(() => {
          setTimeout(() => router.replace("/app"), 900);
        });
      return;
    }

    if (twoFactor && ticket) {
      // Provider identity confirmed, but the account has 2FA on — stash the
      // ticket and send the user through the existing verify step on /login.
      try {
        sessionStorage.setItem("kivo:oauth-2fa-ticket", ticket);
      } catch {}
      setStatus("Second step needed — confirm it's you…");
      setTimeout(() => router.replace("/login?oauth2fa=1"), 700);
      return;
    }

    if (accessToken) {
      setStatus("Signed in! Loading your chats…");
      // The refresh cookie was already set by the backend callback response;
      // fetch the user to complete the in-memory + localStorage session.
      apiGet("/api/v1/users/me")
        .then((me) => {
          // apiGet sends the Bearer from memory (empty here) but the route
          // needs auth — retry with the fresh access token directly.
          return me;
        })
        .catch(async () => {
          const res = await fetch("/api/v1/users/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
            credentials: "include",
          });
          if (!res.ok) throw new Error("Could not load profile");
          const json = await res.json();
          return json.data;
        })
        .then((me) => {
          setSession(me, accessToken);
          // Strip the token from the URL before entering the app.
          window.history.replaceState(null, "", "/oauth/callback");
          router.replace("/app");
        })
        .catch(() => {
          setError(
            "Signed in, but couldn't load your profile. Please log in again.",
          );
          setStatus("");
        });
      return;
    }

    setError("Nothing to finish here. Please try signing in again.");
    setStatus("");
  }, [searchParams, router]);

  return (
    <AuthCard>
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        {!error ? (
          <>
            <span
              className="size-8 animate-spin rounded-full border-[3px] border-hairline border-t-ink-black"
              aria-hidden="true"
            />
            <p className="font-sans text-[14px] text-pewter">
              {status || "Working…"}
            </p>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5 font-sans text-[13px] text-red-400">
              {error}
            </div>
            <a
              href="/login"
              className="font-sans text-[14px] font-medium text-electric-blue hover:text-ink-black"
            >
              Back to log in
            </a>
          </>
        )}
      </div>
    </AuthCard>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <OAuthCallbackInner />
    </Suspense>
  );
}
