"use client";

import Link from "next/link";

export default function Error({ error, reset }) {
  // Log for debugging; Next already reports to console in dev.
  // Avoid exposing stack to users.
  const message =
    error?.message && typeof error.message === "string"
      ? error.message
      : "An unexpected error occurred.";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas text-ink">
      <header className="flex h-[64px] shrink-0 items-center px-4 sm:px-6">
        <Link
          href="/"
          aria-label="Kivo home"
          className="kivo-focus flex items-center gap-2 rounded-pills px-1 py-1"
        >
          <img
            src="/icons/icon-192.png"
            alt="Kivo"
            width={28}
            height={28}
            className="size-7 shrink-0 rounded-[8px] object-cover"
          />
          <span className="font-goga text-[20px] font-medium tracking-tight text-ink">
            Kivo
          </span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div className="flex w-full max-w-[640px] flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-pills border border-destructive/20 bg-destructive/10 px-3.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-destructive">
            <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            Something went wrong
          </span>

          <h1 className="mt-6 text-balance font-goga text-[28px] font-medium leading-[0.95] tracking-[-0.03em] text-ink sm:text-[34px]">
            We hit a snag.
          </h1>
          <p className="mt-3 max-w-[520px] text-balance font-sans text-[14px] leading-[1.6] text-ink-muted sm:text-[15px]">
            Kivo ran into an unexpected error. Your data is safe — try again, or
            head back to a safe place. If it persists, check docs or try
            refreshing.
          </p>

          {/* error message — truncated, muted, no stack */}
          <p className="mt-4 max-w-[560px] truncate rounded-lg border border-hairline bg-surface-1 px-3 py-2 font-mono text-[12px] text-ink-muted">
            {message.length > 180 ? `${message.slice(0, 180)}…` : message}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="kivo-cta kivo-focus inline-flex min-h-[44px] items-center justify-center rounded-pills px-6 text-[14px] font-semibold"
            >
              Try again
            </button>
            <Link
              href="/"
              className="kivo-focus inline-flex min-h-[44px] items-center justify-center rounded-pills border border-hairline bg-surface-1 px-6 text-[14px] font-medium text-ink transition-colors hover:bg-surface-2"
            >
              Go home
            </Link>
            <Link
              href="/app"
              className="kivo-focus inline-flex min-h-[44px] items-center justify-center rounded-pills border border-hairline bg-transparent px-6 text-[14px] font-medium text-ink-muted hover:text-ink"
            >
              Open app
            </Link>
          </div>

          <p className="mt-8 font-mono text-[11px] text-ink-muted/60">
            Error 500 ·{" "}
            <Link href="/docs" className="underline underline-offset-4 hover:text-ink-muted">
              Docs
            </Link>{" "}
            ·{" "}
            <Link href="/author" className="underline underline-offset-4 hover:text-ink-muted">
              Report issue
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
