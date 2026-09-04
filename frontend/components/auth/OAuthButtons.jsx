"use client";

import { useState } from "react";

// Shared Google / GitHub buttons for login + signup. They are plain
// top-level navigations to the backend start endpoints (302 -> provider),
// so no fetch/credentials handling is needed here. Buttons always render —
// if a provider isn't configured yet the backend redirects back with
// ?oauth_error=OAUTH_NOT_CONFIGURED which the auth pages display.
export function OAuthButtons({ mode = "login" }) {
  const [loading, setLoading] = useState(null);

  const start = (provider) => {
    setLoading(provider);
    window.location.href = `/api/v1/auth/oauth/${provider}`;
  };

  const label = mode === "signup" ? "Sign up" : "Continue";

  const btn =
    "inline-flex h-11 items-center justify-center gap-2 rounded-inputs border border-hairline bg-surface-2 px-3 font-sans text-[14px] hover:cursor-pointer font-medium text-ink-black transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-eclipse-violet/40 hover:bg-surface-1 active:scale-[0.98] disabled:opacity-60";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-1 gap-2.5">
        <button
          type="button"
          onClick={() => start("google")}
          disabled={loading !== null}
          className={btn}
        >
          {loading === "google" ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-[18px] w-[18px]"
            >
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
          )}
          {label} with Google
        </button>
        <button
          type="button"
          onClick={() => start("github")}
          disabled={loading !== null}
          className={btn}
        >
          {loading === "github" ? (
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="h-[18px] w-[18px]"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          )}
          {label} with GitHub
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
        <span className="font-sans text-[12px] text-pewter">or</span>
        <span className="h-px flex-1 bg-hairline" aria-hidden="true" />
      </div>
    </div>
  );
}

export default OAuthButtons;
