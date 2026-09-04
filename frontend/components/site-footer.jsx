"use client";

import { motion, useReducedMotion } from "motion/react";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Customization", href: "/#customization" },
      { label: "Security", href: "/#security" },
      { label: "Roadmap", href: "/#roadmap" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Author", href: "/author" },
      { label: "Open app", href: "/app" },
      { label: "Log in", href: "/login" },
      { label: "Sign up", href: "/signup" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function SiteFooter() {
  const reduce = useReducedMotion();
  const year = new Date().getFullYear();

  return (
    <motion.footer
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: EASE_SMOOTH_OUT }}
      className="border-t border-hairline/60 bg-canvas px-4 pb-8 pt-16 sm:px-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-[1280px]">
        <div className="grid gap-10 pb-12 lg:grid-cols-[1.2fr_2fr] lg:gap-16">
          {/* Brand block */}
          <div className="flex flex-col gap-4">
            <a
              href="/"
              aria-label="Kivo home"
              className="kivo-focus flex w-fit items-center gap-2 rounded-pills"
            >
              <img
                src="/icons/icon-192.png"
                alt="Kivo"
                width="24"
                height="24"
                className="size-6 shrink-0 rounded-[6px] object-cover"
              />
              <span className="font-goga text-[20px] font-medium tracking-tight text-ink">
                Kivo
              </span>
            </a>
            <p className="max-w-[320px] font-sans text-[14px] leading-[1.6] text-ink-muted">
              Chat your way — DMs, groups, and communities in one realtime app.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href="/signup"
                className="kivo-cta kivo-focus rounded-pills px-5 py-2 font-sans text-[13px] font-medium text-inverse-ink"
              >
                Get started
              </a>
              <a
                href="/docs"
                className="kivo-focus rounded-pills border border-hairline bg-surface-1 px-5 py-2 font-sans text-[13px] font-medium text-ink transition-colors duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-2"
              >
                Docs
              </a>
            </div>
          </div>

          {/* Link columns — staggered rise on entry (texts-reveal) */}
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-8 sm:grid-cols-3"
          >
            {COLUMNS.map((col, ci) => (
              <div
                key={col.title}
                className="t-stagger flex flex-col gap-4"
                style={{ "--stagger-index": ci }}
              >
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {col.title}
                </p>
                <ul className="flex flex-col gap-1">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="kivo-focus t-learn group inline-flex min-h-[32px] items-center rounded-md font-sans text-[13px] font-medium text-ink-muted transition-colors duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink"
                      >
                        {link.label}
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                          className="opacity-0 transition-opacity duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100"
                        >
                          <path
                            d="M3 6h7M7 3.5 9.5 6 7 8.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline-soft pt-6 sm:flex-row">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <p className="font-sans text-[12px] leading-[1.2] text-ink-muted">
              © {year} Kivo — Built for realtime. Designed to be yours.
            </p>
            <p className="font-sans text-[12px] leading-[1.2] text-ink-muted/70">
              Crafted by{" "}
              <a
                href="/author"
                className="kivo-focus rounded-sm font-medium text-ink-muted transition-colors duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink"
              >
                Ayush
              </a>{" "}
              ·{" "}
              <a
                href="https://github.com/user-synax/Kivo"
                target="_blank"
                rel="noopener noreferrer"
                className="kivo-focus rounded-sm font-medium text-ink-muted transition-colors duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink"
              >
                Open source
              </a>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/author"
              className="kivo-focus rounded-sm font-sans text-[12px] text-ink-muted transition-colors duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink"
            >
              Author
            </a>
            <span
              aria-hidden="true"
              className="size-1 rounded-full bg-hairline"
            />
            <a
              href="/privacy"
              className="kivo-focus rounded-sm font-sans text-[12px] text-ink-muted transition-colors duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink"
            >
              Privacy
            </a>
            <span
              aria-hidden="true"
              className="size-1 rounded-full bg-hairline"
            />
            <a
              href="/terms"
              className="kivo-focus rounded-sm font-sans text-[12px] text-ink-muted transition-colors duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}

export default SiteFooter;
