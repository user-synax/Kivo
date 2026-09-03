"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { Navbar } from "@/components/navbar/navbar";
import { SiteFooter } from "@/components/site-footer";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

/* Shared legal-article shell for /privacy and /terms.
   Design system: dark canvas, surface-1 cards, hairline borders, white
   display type (font-goga), Inter body, accent-blue reserved for links.
   Motion (transitions-dev): texts-reveal stagger on the hero + TOC,
   accordion expand (t-acc) for each section, panel-reveal on the TOC card. */
export function LegalPage({ eyebrow, title, updated, intro, sections }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(() => new Set([sections[0]?.id]));

  const toggle = (id) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const heroContainer = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };
  const heroItem = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14, filter: "blur(3px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.5, ease: EASE_SMOOTH_OUT },
        },
      };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#legal-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-pills focus:bg-ink focus:px-4 focus:py-2 focus:text-inverse-ink"
      >
        Skip to content
      </a>
      <Navbar />

      <main
        id="legal-main"
        className="px-4 pb-24 pt-32 sm:px-6 sm:pt-36 lg:px-8"
      >
        <div className="mx-auto w-full max-w-[800px]">
          {/* Hero — texts-reveal */}
          <motion.header
            variants={heroContainer}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="flex flex-col gap-5"
          >
            <motion.span
              variants={heroItem}
              className="inline-flex w-fit items-center gap-1.5 rounded-pills border border-accent-blue/20 bg-accent-blue/10 px-3.5 py-1 font-sans text-[12px] font-semibold text-accent-blue"
            >
              <span className="size-1.5 rounded-full bg-accent-blue" />
              {eyebrow}
            </motion.span>
            <motion.h1
              variants={heroItem}
              className="font-goga text-[40px] font-medium leading-[0.95] tracking-[-0.03em] text-ink sm:text-[56px]"
            >
              {title}
            </motion.h1>
            <motion.p
              variants={heroItem}
              className="max-w-[640px] font-sans text-[15px] leading-[1.6] text-ink-muted sm:text-[16px]"
            >
              {intro}
            </motion.p>
            <motion.p
              variants={heroItem}
              className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-ink-muted"
            >
              Last updated — {updated}
            </motion.p>
          </motion.header>

          {/* TOC — panel reveal + staggered items */}
          <nav
            aria-label="On this page"
            className="t-panel-slide mt-10 rounded-cards border border-hairline bg-surface-1 p-4 sm:p-5"
          >
            <p className="mb-2 px-2 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              On this page
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {sections.map((s, i) => (
                <li
                  key={s.id}
                  className="t-stagger"
                  style={{ "--stagger-index": i }}
                >
                  <a
                    href={`#${s.id}`}
                    className="kivo-focus flex min-h-[40px] items-center gap-2.5 rounded-lg px-2 font-sans text-[13px] font-medium text-ink-muted transition-colors duration-[150ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-2 hover:text-ink"
                  >
                    <span
                      aria-hidden="true"
                      className="size-1.5 shrink-0 rounded-full bg-accent-blue/60"
                    />
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Sections — accordion expand (t-acc) */}
          <div className="mt-8 flex flex-col gap-3">
            {sections.map((s) => {
              const isOpen = open.has(s.id);
              return (
                <div
                  key={s.id}
                  id={s.id}
                  className="t-acc scroll-mt-28"
                  data-open={String(isOpen)}
                >
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    aria-expanded={isOpen}
                    aria-controls={`${s.id}-panel`}
                    className="t-acc-head kivo-focus"
                  >
                    <span className="font-goga text-[17px] font-medium tracking-tight text-ink sm:text-[18px]">
                      {s.title}
                    </span>
                    <span className="t-acc-chevron" aria-hidden="true">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <path
                          d="M4 6.5 8 10.5 12 6.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  <div className="t-acc-panel">
                    <div
                      id={`${s.id}-panel`}
                      className="t-acc-panel-inner px-6 pb-6"
                    >
                      <div className="flex flex-col gap-3 font-sans text-[14px] leading-[1.65] text-ink-muted">
                        {s.paragraphs?.map((p) => (
                          <p key={p.slice(0, 48)}>{p}</p>
                        ))}
                        {s.bullets && (
                          <ul className="flex flex-col gap-2 pt-1">
                            {s.bullets.map((b) => (
                              <li key={b} className="flex gap-3">
                                <span
                                  aria-hidden="true"
                                  className="mt-[8px] size-1.5 shrink-0 rounded-full bg-accent-blue/70"
                                />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Closing card */}
          <section
            aria-label="Questions"
            className="mt-8 rounded-cards border border-hairline bg-surface-1 p-6 sm:p-8"
          >
            <h2 className="font-goga text-[22px] font-medium tracking-tight text-ink">
              Questions about this page?
            </h2>
            <p className="mt-2 font-sans text-[14px] leading-[1.6] text-ink-muted">
              Read the{" "}
              <a
                href="/docs"
                className="kivo-focus rounded-sm font-medium text-accent-blue underline-offset-2 hover:underline"
              >
                Docs
              </a>{" "}
              to see how Kivo works in practice, or head to the{" "}
              <a
                href="/app"
                className="kivo-focus rounded-sm font-medium text-accent-blue underline-offset-2 hover:underline"
              >
                app
              </a>{" "}
              if you already have an account.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
