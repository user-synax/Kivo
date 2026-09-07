import Link from "next/link";

export const metadata = {
  title: "Profile not found — Kivo",
  robots: { index: false, follow: false },
};

export default function UserNotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-canvas text-ink">
      {/* keeps theme vars from parent layout but centers a branded card */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="flex w-full max-w-[520px] flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-pills border border-hairline bg-surface-1 px-3 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            <span className="size-1.5 rounded-full bg-accent-blue" aria-hidden="true" />
            Profile not found
          </span>

          <div className="mt-6 flex size-16 items-center justify-center rounded-2xl border border-hairline bg-surface-1 text-ink-muted">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M5 19c0-3.3 2.7-6 7-6s7 2.7 7 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <path
                d="M12 12l2.2 2.2M14.2 12L12 14.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h1 className="mt-5 text-balance font-goga text-[28px] font-medium leading-[0.95] tracking-[-0.03em] text-ink sm:text-[32px]">
            This profile doesn’t exist.
          </h1>
          <p className="mt-2 max-w-[440px] text-balance font-sans text-[14px] leading-[1.6] text-ink-muted">
            The username you’re looking for may have been changed, removed, or
            never existed. Double-check the spelling or discover people on Kivo.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="kivo-cta kivo-focus inline-flex min-h-[42px] items-center justify-center rounded-pills px-5 text-[14px] font-semibold"
            >
              Go home
            </Link>
            <Link
              href="/app"
              className="kivo-focus inline-flex min-h-[42px] items-center justify-center rounded-pills border border-hairline bg-surface-1 px-5 text-[14px] font-medium text-ink transition-colors hover:bg-surface-2"
            >
              Open app
            </Link>
            <Link
              href="/docs"
              className="kivo-focus inline-flex min-h-[42px] items-center justify-center rounded-pills border border-hairline bg-transparent px-5 text-[14px] font-medium text-ink-muted hover:text-ink"
            >
              Docs
            </Link>
          </div>

          <p className="mt-6 font-mono text-[11px] text-ink-muted/60">
            Error 404 · /u/ profile ·{" "}
            <Link href="/signup" className="underline underline-offset-4 hover:text-ink-muted">
              Create your own profile
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
