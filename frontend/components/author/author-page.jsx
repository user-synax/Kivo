"use client";

import { motion, useReducedMotion } from "motion/react";
import { Navbar } from "@/components/navbar/navbar";
import { SiteFooter } from "@/components/site-footer";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

function SocialIcon({ id }) {
  const cls = "h-[18px] w-[18px] shrink-0";
  switch (id) {
    case "github":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={cls}
        >
          <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
        </svg>
      );
    case "x":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={cls}
        >
          <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z" />
        </svg>
      );
    case "instagram":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cls}
        >
          <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle
            cx="17.4"
            cy="6.6"
            r="1.1"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      );
    case "youtube":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={cls}
        >
          <path d="M23.5 7.2a3 3 0 0 0-2.1-2.13C19.5 4.55 12 4.55 12 4.55s-7.5 0-9.4.52A3 3 0 0 0 .5 7.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.13c1.9.52 9.4.52 9.4.52s7.5 0 9.4-.52a3 3 0 0 0 2.1-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-4.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
        </svg>
      );
    case "website":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cls}
        >
          <circle cx="12" cy="12" r="9.5" />
          <path d="M2.5 12h19M12 2.5c2.7 2.4 4.1 5.7 4.1 9.5s-1.4 7.1-4.1 9.5c-2.7-2.4-4.1-5.7-4.1-9.5S9.3 4.9 12 2.5Z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          className={cls}
        >
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.55V9h3.57v11.45Z" />
        </svg>
      );
    case "email":
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cls}
        >
          <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
          <path d="m3.5 7 8.5 6 8.5-6" />
        </svg>
      );
    default:
      return null;
  }
}

const SOCIAL_META = [
  { id: "github", label: "GitHub" },
  { id: "x", label: "X (Twitter)" },
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "website", label: "Website" },
  { id: "linkedin", label: "LinkedIn" },
];

function shortHandle(url) {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/|\/$/g, "");
    if (!path) return u.hostname.replace(/^www\./, "");
    return `@${path.split("/")[0]}`;
  } catch {
    return url;
  }
}

export function AuthorPage({ author }) {
  const reduce = useReducedMotion();
  const a = author || {};

  const socials = SOCIAL_META.map((m) => ({
    ...m,
    url: a.socials?.[m.id] || "",
  })).filter((s) => Boolean(s.url));

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };
  const item = reduce
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
      <Navbar />
      <main className="px-4 pb-24 pt-32 sm:px-6 sm:pt-36 lg:px-8">
        <div className="mx-auto w-full max-w-[800px]">
          <motion.header
            variants={container}
            initial={reduce ? false : "hidden"}
            animate="show"
            className="flex flex-col gap-5"
          >
            <motion.span
              variants={item}
              className="inline-flex w-fit items-center gap-1.5 rounded-pills border border-accent-blue/20 bg-accent-blue/10 px-3.5 py-1 font-sans text-[12px] font-semibold text-accent-blue"
            >
              <span className="size-1.5 rounded-full bg-accent-blue" />
              Author
            </motion.span>
            <motion.h1
              variants={item}
              className="font-goga text-[40px] font-medium leading-[0.95] tracking-[-0.03em] text-ink sm:text-[56px]"
            >
              Built by {a.name || "Ayush"}
            </motion.h1>
            <motion.p
              variants={item}
              className="max-w-[640px] font-sans text-[15px] leading-[1.6] text-ink-muted sm:text-[16px]"
            >
              {a.tagline}
            </motion.p>
          </motion.header>

          {/* Identity card */}
          <motion.section
            variants={container}
            initial={reduce ? false : "hidden"}
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="mt-10 rounded-cards border border-hairline bg-surface-1 p-5 sm:p-7"
          >
            <motion.div
              variants={item}
              className="flex flex-col gap-5 sm:flex-row sm:items-center"
            >
              {a.photo ? (
                <img
                  src={a.photo}
                  alt={a.name}
                  width={96}
                  height={96}
                  className="size-20 shrink-0 rounded-2xl object-cover sm:size-24"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-20 shrink-0 items-center justify-center rounded-2xl font-goga text-[36px] font-medium text-white sm:size-24 sm:text-[44px]"
                  style={{
                    background:
                      "linear-gradient(135deg, #4ba9e1 0%, #7a40ed 60%, #1c1c1c 130%)",
                  }}
                >
                  {a.initials || (a.name || "A").charAt(0)}
                </span>
              )}
              <div className="min-w-0">
                <p className="font-goga text-[24px] font-medium tracking-tight text-ink sm:text-[28px]">
                  {a.name}
                </p>
                <p className="font-sans text-[13px] text-ink-muted">
                  @{a.handle} · {a.role}
                </p>
                {a.location && (
                  <p className="mt-1 font-sans text-[12px] text-ink-muted">
                    {a.location}
                  </p>
                )}
              </div>
            </motion.div>

            {(a.bio || []).map((p, i) => (
              <motion.p
                key={i}
                variants={item}
                className="mt-4 font-sans text-[14px] leading-[1.7] text-ink-muted"
              >
                {p}
              </motion.p>
            ))}

            {(a.stack || []).length > 0 && (
              <motion.div
                variants={item}
                className="mt-5 flex flex-wrap gap-1.5"
              >
                {a.stack.map((s) => (
                  <span
                    key={s}
                    className="rounded-pills border border-hairline bg-surface-2 px-3 py-1 font-sans text-[12px] font-medium text-ink-muted"
                  >
                    {s}
                  </span>
                ))}
              </motion.div>
            )}

            <motion.div variants={item} className="mt-6 flex flex-wrap gap-2">
              <a
                href="/app"
                className="kivo-cta kivo-focus rounded-pills px-5 py-2 font-sans text-[13px] font-medium text-inverse-ink"
              >
                Open Kivo
              </a>
              {a.repo && (
                <a
                  href={a.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kivo-focus inline-flex items-center gap-2 rounded-pills border border-hairline bg-surface-2 px-5 py-2 font-sans text-[13px] font-medium text-ink transition-colors hover:bg-surface-1"
                >
                  <SocialIcon id="github" />
                  Source code
                </a>
              )}
              {a.kivoUsername && (
                <a
                  href={`/u/${encodeURIComponent(a.kivoUsername)}`}
                  className="kivo-focus inline-flex items-center gap-2 rounded-pills border border-hairline bg-surface-2 px-5 py-2 font-sans text-[13px] font-medium text-ink transition-colors hover:bg-surface-1"
                >
                  View Kivo profile
                </a>
              )}
            </motion.div>
          </motion.section>

          {/* Socials — only configured links render */}
          <motion.section
            variants={container}
            initial={reduce ? false : "hidden"}
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="mt-6"
          >
            <motion.h2
              variants={item}
              className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted"
            >
              Find me
            </motion.h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {socials.map((s) => (
                <motion.a
                  key={s.id}
                  variants={item}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="kivo-focus group flex items-center gap-3 rounded-cards border border-hairline bg-surface-1 px-4 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-ink transition-colors group-hover:bg-surface-1">
                    <SocialIcon id={s.id} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-sans text-[13px] font-medium text-ink">
                      {s.label}
                    </span>
                    <span className="block truncate font-sans text-[12px] text-ink-muted">
                      {shortHandle(s.url)}
                    </span>
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                    className="shrink-0 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5"
                  >
                    <path
                      d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.a>
              ))}
              {a.email && (
                <motion.a
                  variants={item}
                  href={`mailto:${a.email}`}
                  className="kivo-focus group flex items-center gap-3 rounded-cards border border-hairline bg-surface-1 px-4 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-hairline bg-surface-2 text-ink transition-colors group-hover:bg-surface-1">
                    <SocialIcon id="email" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-sans text-[13px] font-medium text-ink">
                      Email
                    </span>
                    <span className="block truncate font-sans text-[12px] text-ink-muted">
                      {a.email}
                    </span>
                  </span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    aria-hidden="true"
                    className="shrink-0 text-ink-muted transition-transform duration-200 group-hover:translate-x-0.5"
                  >
                    <path
                      d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </motion.a>
              )}
            </div>
            {socials.length === 0 && !a.email && (
              <p className="font-sans text-[13px] text-ink-muted">
                Social links coming soon.
              </p>
            )}
          </motion.section>

          {/* Why Kivo */}
          <motion.section
            variants={container}
            initial={reduce ? false : "hidden"}
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="mt-6 rounded-cards border border-hairline bg-surface-1 p-5 sm:p-7"
          >
            <motion.h2
              variants={item}
              className="font-goga text-[22px] font-medium tracking-tight text-ink"
            >
              Why Kivo?
            </motion.h2>
            <motion.p
              variants={item}
              className="mt-3 font-sans text-[14px] leading-[1.7] text-ink-muted"
            >
              Kivo started as a student full-stack project — a way to learn
              realtime systems properly: auth and sessions, Socket.IO presence,
              MongoDB modeling, offline caching, and push. It stayed honest: no
              ads, no tracking, no enterprise bloat. Just DMs, groups, and
              Spaces that feel instant and look yours.
            </motion.p>
            <motion.p
              variants={item}
              className="mt-3 font-sans text-[14px] leading-[1.7] text-ink-muted"
            >
              If you use it, break it, or want a feature — open an issue on
              GitHub. Real feedback is the best roadmap.
            </motion.p>
          </motion.section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default AuthorPage;
