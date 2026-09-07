import Link from "next/link";
import NotFoundBackButtonClient from "./not-found-client";

export const metadata = {
  title: "Page not found — Kivo",
  description:
    "The page you’re looking for doesn’t exist or was moved. Head back home or open the Kivo app.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-canvas text-ink">
      {/* subtle grid + glow — same spirit as landing */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(circle_at_50%_30%,black,transparent_75%)]" />
        <div className="absolute left-1/2 top-[-10%] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(75,169,225,0.12),transparent_70%)] blur-[1px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[420px] w-[520px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_70%)]" />
      </div>

      {/* minimal header — keeps navigation even on 404 */}
      <header className="relative z-10 flex h-[68px] shrink-0 items-center justify-between px-4 sm:px-6 lg:px-8">
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

        <nav
          aria-label="Quick links"
          className="hidden items-center gap-1 sm:flex"
        >
          <Link
            href="/docs"
            className="kivo-focus rounded-pills px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-white/6 hover:text-ink"
          >
            Docs
          </Link>
          <Link
            href="/learn"
            className="kivo-focus rounded-pills px-3 py-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-white/6 hover:text-ink"
          >
            Learn
          </Link>
          <Link
            href="/app"
            className="kivo-cta kivo-focus ml-1 inline-flex items-center rounded-pills px-4 py-1.5 text-[13px] font-semibold"
          >
            Open app
          </Link>
        </nav>
      </header>

      {/* center stage */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex w-full max-w-[720px] flex-col items-center text-center">
          {/* pill */}
          <span className="inline-flex items-center gap-2 rounded-pills border border-accent-blue/20 bg-accent-blue/10 px-3.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-blue">
            <span className="size-1.5 rounded-full bg-accent-blue" aria-hidden="true" />
            404 — Page not found
          </span>

          {/* giant 404 */}
          <h1
            aria-label="404"
            className="framer-display mt-6 select-none font-goga text-[88px] font-medium leading-[0.85] tracking-[-0.06em] text-ink sm:text-[124px] lg:text-[148px]"
          >
            4<span className="text-accent-blue">0</span>4
          </h1>

          <h2 className="mt-5 max-w-[560px] text-balance font-goga text-[28px] font-medium leading-[0.95] tracking-[-0.03em] text-ink sm:text-[36px]">
            This page wandered off.
          </h2>

          <p className="mt-3 max-w-[520px] text-balance font-sans text-[14px] leading-[1.6] text-ink-muted sm:text-[15px]">
            The link you followed doesn’t exist, was moved, or you don’t have
            access. If you typed it, check the spelling — otherwise let’s get
            you back to somewhere useful.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="kivo-cta kivo-focus inline-flex min-h-[44px] items-center justify-center rounded-pills px-6 text-[14px] font-semibold leading-none"
            >
              Go home
            </Link>
            <Link
              href="/app"
              className="kivo-focus inline-flex min-h-[44px] items-center justify-center rounded-pills border border-hairline bg-surface-1 px-6 text-[14px] font-medium leading-none text-ink transition-colors hover:bg-surface-2"
            >
              Open app
            </Link>
            <NotFoundBackButtonClient />
          </div>

          {/* helpful links — keeps bounce rate low, aids discovery */}
          <div className="mt-10 grid w-full gap-3 text-left sm:grid-cols-3">
            <HelpCard
              title="Explore features"
              desc="DMs, groups & Spaces — see what’s inside."
              href="/#features"
              label="View features"
            />
            <HelpCard
              title="Read the docs"
              desc="How DMs, Spaces, themes & search work."
              href="/docs"
              label="Open docs"
            />
            <HelpCard
              title="Meet the author"
              desc="Solo-built, open source. The story behind Kivo."
              href="/author"
              label="Visit author"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-sans text-[13px] text-ink-muted">
            <span className="hidden sm:inline">Popular:</span>
            <Link href="/login" className="kivo-focus rounded-sm underline-offset-4 hover:text-ink hover:underline">
              Log in
            </Link>
            <span aria-hidden="true" className="size-1 rounded-full bg-hairline" />
            <Link href="/signup" className="kivo-focus rounded-sm underline-offset-4 hover:text-ink hover:underline">
              Sign up
            </Link>
            <span aria-hidden="true" className="size-1 rounded-full bg-hairline" />
            <Link href="/learn" className="kivo-focus rounded-sm underline-offset-4 hover:text-ink hover:underline">
              Learn
            </Link>
            <span aria-hidden="true" className="size-1 rounded-full bg-hairline" />
            <Link href="/privacy" className="kivo-focus rounded-sm underline-offset-4 hover:text-ink hover:underline">
              Privacy
            </Link>
          </div>

          {/* tiny reassurance */}
          <p className="mt-8 font-mono text-[11px] tracking-wide text-ink-muted/60">
            Error code: 404 · If you believe this is a bug,{" "}
            <Link href="/docs" className="kivo-focus rounded-sm underline underline-offset-4 hover:text-ink-muted">
              check docs
            </Link>{" "}
            or try again.
          </p>
        </div>
      </main>

      <footer className="relative z-10 border-t border-hairline-soft px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="font-sans text-[12px] text-ink-muted">
            © {new Date().getFullYear()} Kivo — Chat your way.
          </p>
          <div className="flex items-center gap-4 font-sans text-[12px] text-ink-muted">
            <Link href="/terms" className="kivo-focus rounded-sm hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="kivo-focus rounded-sm hover:text-ink">
              Privacy
            </Link>
            <Link href="/cookie" className="kivo-focus rounded-sm hover:text-ink">
              Cookies
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HelpCard({ title, desc, href, label }) {
  return (
    <Link
      href={href}
      className="kivo-focus group flex flex-col gap-1.5 rounded-cards border border-hairline bg-surface-1 p-4 transition-colors hover:bg-surface-2"
    >
      <span className="font-sans text-[13px] font-semibold leading-none text-ink">
        {title}
      </span>
      <span className="font-sans text-[12px] leading-[1.5] text-ink-muted">
        {desc}
      </span>
      <span className="mt-1 inline-flex items-center gap-1 font-sans text-[12px] font-medium text-accent-blue">
        {label}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          className="transition-transform duration-150 group-hover:translate-x-0.5"
        >
          <path
            d="M3 6h7M7 3.5 9.5 6 7 8.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}


