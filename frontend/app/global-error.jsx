"use client";

import Link from "next/link";

// global-error replaces the root layout on unrecoverable errors, so it must
// render its own <html> + <body>. Keep it minimal and self-contained.
export default function GlobalError({ error, reset }) {
  const message =
    error?.message && typeof error.message === "string"
      ? error.message
      : "An unexpected error occurred.";

  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="flex min-h-full flex-col bg-[#090909] text-white antialiased">
        <div className="flex min-h-screen flex-col">
          <header className="flex h-[64px] shrink-0 items-center px-4 sm:px-6">
            <Link
              href="/"
              aria-label="Kivo home"
              className="flex items-center gap-2 rounded-full px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4ba9e1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090909]"
            >
              <img
                src="/icons/icon-192.png"
                alt="Kivo"
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-[8px] object-cover"
              />
              <span
                style={{ fontFamily: "var(--font-outfit), system-ui, sans-serif" }}
                className="text-[20px] font-medium tracking-tight"
              >
                Kivo
              </span>
            </Link>
          </header>

          <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
            <div className="flex w-full max-w-[640px] flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ff5577]/20 bg-[#ff5577]/10 px-3.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-[#ff5577]">
                <span className="size-1.5 rounded-full bg-[#ff5577]" aria-hidden="true" />
                Critical error
              </span>

              <h1 className="mt-6 text-balance font-medium leading-[0.95] tracking-[-0.03em] text-white text-[30px] sm:text-[36px]" style={{ fontFamily: "var(--font-outfit), system-ui, sans-serif" }}>
                Something broke badly.
              </h1>
              <p className="mt-3 max-w-[520px] text-balance font-sans text-[14px] leading-[1.6] text-[#999999] sm:text-[15px]">
                A critical error stopped the page from loading. Try again — if it
                keeps happening, return home and we’ll get it sorted.
              </p>

              <p className="mt-4 max-w-[560px] truncate rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 font-mono text-[12px] text-[#999999]">
                {message.length > 180 ? `${message.slice(0, 180)}…` : message}
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-6 text-[14px] font-semibold text-black transition-[filter] hover:brightness-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4ba9e1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090909]"
                >
                  Try again
                </button>
                <a
                  href="/"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#262626] bg-[#141414] px-6 text-[14px] font-medium text-white transition-colors hover:bg-[#1c1c1c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4ba9e1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090909]"
                >
                  Go home
                </a>
              </div>
            </div>
          </main>

          <footer className="border-t border-[#1a1a1a] px-4 py-6 sm:px-6">
            <p className="text-center font-mono text-[11px] text-[#999999]/60">
              Kivo · global-error ·{" "}
              <a href="/docs" className="underline underline-offset-4 hover:text-[#999999]">
                Docs
              </a>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
