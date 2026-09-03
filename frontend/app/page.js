"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Navbar } from "../components/navbar/navbar";
import { SiteFooter } from "../components/site-footer";
import { GuestGate } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { RadialButton } from "@/components/ui/radial-button";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

/* Drop your hero visual in /public and point this at the file.
   e.g. "/hero-image.png". Until it exists, a placeholder is shown. */
const HERO_IMAGE = "/hero-image.png";

export default function Home() {
  const reduce = useReducedMotion();

  const textContainerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.08, delayChildren: 0.1 },
    },
  };

  const textItemVariants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: EASE_SMOOTH_OUT },
        },
      };

  const imageVariants = reduce
    ? { hidden: { opacity: 1, scale: 1 }, show: { opacity: 1, scale: 1 } }
    : {
        hidden: { opacity: 0, y: 16, scale: 0.96 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.55, ease: EASE_SMOOTH_OUT, delay: 0.38 },
        },
      };

  return (
    <GuestGate>
      <main className="min-h-screen bg-canvas text-ink">
        <Navbar />

        <section className="relative flex min-h-screen flex-col justify-center overflow-hidden px-4 pb-20 pt-36 sm:px-6 sm:pt-40 lg:px-8 lg:pb-24">
          <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-12 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 xl:gap-16">
            {/* Text column */}
            <motion.div
              variants={textContainerVariants}
              initial={reduce ? false : "hidden"}
              animate="show"
              className="flex max-w-[640px] flex-col gap-6 lg:max-w-none lg:gap-8"
            >
              {/* Pill badge kicker */}
              <motion.span
                variants={textItemVariants}
                className="inline-flex w-fit items-center gap-1.5 rounded-pills border border-accent-blue/20 bg-accent-blue/10 px-3.5 py-1 font-sans text-[12px] font-semibold text-accent-blue"
              >
                <span className="size-1.5 rounded-full bg-accent-blue" />
                Introducing Kivo
              </motion.span>

              <motion.h1
                variants={textItemVariants}
                className="font-goga text-[44px] font-medium leading-[0.95] tracking-[-0.03em] text-ink sm:text-[64px] sm:tracking-[-0.04em] lg:text-[80px] xl:text-[88px] xl:tracking-[-0.055em] xl:leading-[1]"
              >
                <span className="text-accent-blue">Chat</span> your way.
              </motion.h1>

              <motion.p
                variants={textItemVariants}
                className="max-w-[560px] font-sans text-[16px] font-normal leading-[1.5] tracking-[-0.352px] text-ink-muted sm:text-[18px] lg:text-[20px] lg:leading-[1.5] lg:tracking-[-0.36px]"
              >
                DMs, groups, and communities - all in one place, built around how
                you communicate.
              </motion.p>

              <motion.div
                variants={textItemVariants}
                className="flex flex-wrap items-center gap-3 pt-1 sm:gap-4"
              >
                {/* Primary CTA - white pill */}
                <motion.div
                  whileHover={reduce ? undefined : { scale: 1.02 }}
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                  transition={{ duration: 0.2, ease: EASE_SMOOTH_OUT }}
                  className="shrink-0"
                >
                  <RadialButton
                    onClick={() => window.location.href = "/signup"}
                    className="kivo-cta h-auto rounded-pills px-6 py-3 text-[16px] font-medium leading-none tracking-[-0.352px] transition-[transform,filter] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-accent-blue/30 has-[>svg]:px-6"
                  >
                    Get Started
                  </RadialButton>
                </motion.div>

                {/* Secondary CTA - ghost outline */}
                <motion.div
                  whileHover={reduce ? undefined : { scale: 1.02 }}
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                  transition={{ duration: 0.2, ease: EASE_SMOOTH_OUT }}
                  className="shrink-0"
                >
                  <Button
                    variant="outline"
                    render={<a href="#features" />}
                    className="h-auto rounded-pills border border-ink/20 bg-transparent px-6 py-3 text-[16px] font-medium leading-none tracking-[-0.352px] text-ink shadow-none hover:bg-ink/5 hover:text-ink focus-visible:ring-ink/20 has-[>svg]:px-6"
                  >
                    Learn More
                  </Button>
                </motion.div>
              </motion.div>
            </motion.div>

            {/* Hero image column */}
            <motion.div
              variants={imageVariants}
              initial={reduce ? false : "hidden"}
              animate="show"
              className="relative w-full min-w-0 lg:pl-2"
            >
              <HeroImage />
            </motion.div>
          </div>
        </section>

        <FeaturesSection />
        <PowerFeaturesSection />
        <CustomizationSection />
        <SecuritySection />
        <RoadmapSection />
        <FaqSection />

        <SiteFooter />
      </main>
    </GuestGate>
  );
}

function HeroImage() {
  const [errored, setErrored] = useState(false);

  return (
    <div className="relative mx-auto w-full max-w-full overflow-hidden rounded-cards border border-hairline bg-surface-1 sm:max-w-[560px] lg:mx-0 lg:ml-auto">
      {!errored ? (
        <img
          src={HERO_IMAGE}
          alt="Kivo - chat your way"
          onError={() => setErrored(true)}
          className="block aspect-[16/10] h-auto w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 bg-surface-1 px-6 text-center">
          <span className="font-sans text-[15px] font-medium text-ink">
            Hero image goes here
          </span>
          <span className="font-sans text-[13px] leading-[1.4] text-ink-muted">
            Drop{" "}
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-ink">
              {HERO_IMAGE}
            </code>{" "}
            into <code className="rounded bg-surface-2 px-1.5 py-0.5 text-ink">public/</code>{" "}
            to show your visual
          </span>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Shared section helpers — same easing grid as Navbar/Hero
   ─────────────────────────────────────────────────────────── */
function SectionEyebrow({ children }) {
  return (
    <span className="inline-flex items-center gap-2 font-sans text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
      <span className="size-1.5 rounded-full bg-accent-blue" aria-hidden="true" />
      {children}
    </span>
  );
}

function SectionTitle({ children, className = "" }) {
  return (
    <h2
      className={`font-goga text-[32px] font-medium leading-[0.95] tracking-[-0.03em] text-ink sm:text-[40px] lg:text-[48px] ${className}`}
    >
      {children}
    </h2>
  );
}

/* ───────────────────────────────────────────────────────────────
   Features — grid/cards layout (5 cards)
   ─────────────────────────────────────────────────────────── */
function FeaturesSection() {
  const reduce = useReducedMotion();
  const containerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.06, delayChildren: 0.08 },
    },
  };
  const itemVariants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: EASE_SMOOTH_OUT },
        },
      };

  const features = [
    {
      label: "Realtime messaging",
      title: "DMs & group chat",
      desc: "1:1 DMs and small-group chats with cursor-paginated history, optimistic sends, and instant delivery over Socket.IO.",
    },
    {
      label: "Spaces",
      title: "Discord-style communities",
      desc: "Spaces with text & announcement channels and role-based permissions — owner, admin, moderator, member — enforced server-side.",
    },
    {
      label: "Live presence",
      title: "Typing, receipts & presence",
      desc: "Typing indicators, delivered / read receipts, and live online presence so conversations feel immediate.",
    },
    {
      label: "Expressive",
      title: "Reactions, edit & delete",
      desc: "React with emoji, edit after sending, or soft-delete — all synced realtime to every participant.",
    },
    {
      label: "Stay in the loop",
      title: "In-app & push notifications",
      desc: "In-app bell plus VAPID web push — you get notified even when the app is closed. DM-focused suppression keeps it quiet when you are already viewing the chat.",
    },
  ];

  return (
    <section
      id="features"
      className="scroll-mt-24 border-t border-hairline/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <motion.div
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex flex-col gap-6"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-4">
            <SectionEyebrow>Features</SectionEyebrow>
            <SectionTitle>
              Everything for{" "}
              <span className="text-ink-muted">realtime chat</span>
            </SectionTitle>
            <p className="max-w-[640px] font-sans text-[15px] leading-[1.6] text-ink-muted sm:text-[16px]">
              Kivo bundles the core of modern chat — fast, reliable, and
              community-ready — on one near-black canvas.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={itemVariants}
                className="flex flex-col gap-3 rounded-cards border border-hairline bg-surface-1 p-6"
              >
                <span className="inline-flex w-fit rounded-full border border-hairline bg-surface-2 px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {f.label}
                </span>
                <h3 className="font-goga text-[18px] font-medium leading-tight tracking-tight text-ink">
                  {f.title}
                </h3>
                <p className="font-sans text-[14px] leading-[1.6] text-ink-muted">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Customization — core differentiator, give it weight
   ─────────────────────────────────────────────────────────── */
function CustomizationSection() {
  const reduce = useReducedMotion();
  const containerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.07, delayChildren: 0.08 },
    },
  };
  const itemVariants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: EASE_SMOOTH_OUT },
        },
      };

  return (
    <section
      id="customization"
      className="scroll-mt-24 border-t border-hairline/60 bg-surface-1/40 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <motion.div
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-12"
        >
          {/* Left — editorial */}
          <motion.div variants={itemVariants} className="flex flex-col gap-5">
            <SectionEyebrow>Customization</SectionEyebrow>
            <SectionTitle>
              Built to be{" "}
              <span className="text-accent-blue">re-skinned</span>, not just
              re-colored.
            </SectionTitle>
            <p className="font-sans text-[15px] leading-[1.6] text-ink-muted sm:text-[16px]">
              Theming is a first-class system in Kivo, not an afterthought.
            </p>
            <p className="max-w-[560px] font-sans text-[15px] leading-[1.6] text-ink-muted">
              One theme object restyles the whole app — canvas, surfaces,
              borders, bubbles, and motion — with no component edits. Switch
              live, layer on your own accent and canvas tone, and keep the same
              near-black, hairline geometry everywhere.
            </p>
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent-blue" />
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-[13px] font-semibold text-ink">
                    Single theme object
                  </span>
                  <span className="font-sans text-[13px] leading-[1.5] text-ink-muted">
                    A single token set drives every surface — restyle once,
                    render everywhere.
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent-blue" />
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-[13px] font-semibold text-ink">
                    Theme studio — yours, live
                  </span>
                  <span className="font-sans text-[13px] leading-[1.5] text-ink-muted">
                    Pick any palette as your base, then recolor its accent and
                    canvas tone — saved to your account everywhere you sign
                    in. Every Space can carry its own palette too, set by its
                    owners and seen by all its members.
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent-blue" />
                <div className="flex flex-col gap-1">
                  <span className="font-sans text-[13px] font-semibold text-ink">
                    Dark-first, phosphor-spirit
                  </span>
                  <span className="font-sans text-[13px] leading-[1.5] text-ink-muted">
                    Near-black canvas, pale type, hairline borders, minimal
                    shadows — calm by default, expressive on demand.
                  </span>
                </div>
              </div>
            </div>
            <p className="pt-1 font-sans text-[13px] font-medium italic text-ink-muted">
              One canvas. Every surface answers to it.
            </p>
          </motion.div>

          {/* Right — preview card */}
          <motion.div
            variants={itemVariants}
            className="relative overflow-hidden rounded-cards border border-hairline bg-canvas p-6 sm:p-7"
          >
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  Theme engine preview
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-blue/20 bg-accent-blue/10 px-2.5 py-1 font-sans text-[11px] font-semibold text-accent-blue">
                  <span className="size-1.5 rounded-full bg-accent-blue" />
                  Live switch
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: "Framer", swatch: "bg-ink" },
                  { name: "Midnight", swatch: "bg-accent-blue" },
                  { name: "Porcelain", swatch: "bg-surface-2" },
                ].map((t) => (
                  <div
                    key={t.name}
                    className="flex flex-col items-center gap-2 rounded-xl border border-hairline bg-surface-1 p-3"
                  >
                    <span
                      className={`size-8 rounded-full border border-hairline ${t.swatch}`}
                      aria-hidden="true"
                    />
                    <span className="font-sans text-[12px] font-medium text-ink">
                      {t.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-hairline bg-surface-1 p-4">
                <p className="font-mono text-[12px] leading-[1.6] text-ink-muted">
                  <span className="text-ink">{"{ "}</span>
                  canvas: var(--canvas),<br />
                  &nbsp;&nbsp;ink: var(--ink),<br />
                  &nbsp;&nbsp;accent: var(--accent-blue),<br />
                  &nbsp;&nbsp;hairline: var(--hairline)
                  <span className="text-ink">{" }"}</span>
                </p>
              </div>

              <p className="font-sans text-[13px] leading-[1.5] text-ink-muted">
                Tokens flow through CSS variables — no hardcoded colors, no
                per-component overrides.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Security — credible, implementation-accurate
   ─────────────────────────────────────────────────────────── */
function SecuritySection() {
  const reduce = useReducedMotion();
  const containerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.06, delayChildren: 0.08 },
    },
  };
  const itemVariants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: EASE_SMOOTH_OUT },
        },
      };

  const points = [
    {
      title: "Custom auth — no third-party provider",
      desc: "Email + password with bcrypt hashing, owned entirely by Kivo. No external identity dependency to leak scope or session control.",
    },
    {
      title: "15-minute access, httpOnly refresh",
      desc: "Short-lived JWT access tokens in the Authorization header, refreshed silently via an httpOnly cookie. Even if an access token leaks, its window is minutes.",
    },
    {
      title: "Server-tracked sessions & force-logout",
      desc: "Every refresh token is backed by a Session document with TTL. Users can log out everywhere; admins can force-logout any account — revocation is real, not client-side.",
    },
    {
      title: "Zod at every boundary",
      desc: "HTTP bodies, query params, and route params are validated server-side with Zod. First error wins with a clear VALIDATION_ERROR — the client is never trusted.",
    },
  ];

  return (
    <section
      id="security"
      className="scroll-mt-24 border-t border-hairline/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <motion.div
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex flex-col gap-6"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-4">
            <SectionEyebrow>Security</SectionEyebrow>
            <SectionTitle>
              Built <span className="text-ink-muted">security-first</span>
            </SectionTitle>
            <p className="max-w-[680px] font-sans text-[15px] leading-[1.6] text-ink-muted sm:text-[16px]">
              Kivo&apos;s auth and validation are implementation details you can
              verify — not marketing claims. Short lifetimes, server-owned
              sessions, and strict boundaries keep trust measurable.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            className="grid gap-4 pt-2 sm:grid-cols-2"
          >
            {points.map((p) => (
              <motion.div
                key={p.title}
                variants={itemVariants}
                className="flex flex-col gap-2 rounded-cards border border-hairline bg-surface-1 p-6"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 size-1.5 shrink-0 rounded-full bg-accent-blue"
                    aria-hidden="true"
                  />
                  <h3 className="font-sans text-[14px] font-semibold leading-[1.4] text-ink">
                    {p.title}
                  </h3>
                </div>
                <p className="pl-4 font-sans text-[13px] leading-[1.6] text-ink-muted">
                  {p.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="max-w-[720px] font-sans text-[13px] leading-[1.6] text-ink-muted"
          >
            Rate limiting, Helmet headers, secure CORS, and never exposing stack
            traces or secrets in production complete the picture. Security is
            the foundation — not a feature.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Roadmap — two-column, shipped vs coming next, no dates
   ─────────────────────────────────────────────────────────── */
function RoadmapSection() {
  const reduce = useReducedMotion();
  const containerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.06, delayChildren: 0.08 },
    },
  };
  const itemVariants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: EASE_SMOOTH_OUT },
        },
      };

  const shipped = [
    "DMs — 1:1 private conversations",
    "Groups — private multi-member chats",
    "Spaces & Channels — text / announcement, role-based",
    "Notifications — in-app bell + VAPID web push",
    "Attachments — images & documents",
    "Public profiles, blocking & global search",
  ];
  const next = [
    "DM & group voice / video calls",
    "Message threads",
    "2FA — second-factor authentication",
    "Pinned & saved messages",
    "Custom user themes",
  ];

  return (
    <section
      id="roadmap"
      className="scroll-mt-24 border-t border-hairline/60 bg-surface-1/40 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <motion.div
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex flex-col gap-6"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-4">
            <SectionEyebrow>Roadmap</SectionEyebrow>
            <SectionTitle>
              Shipped & <span className="text-ink-muted">coming next</span>
            </SectionTitle>
            <p className="max-w-[640px] font-sans text-[15px] leading-[1.6] text-ink-muted sm:text-[16px]">
              What you can use today and what is being built next. No dates
              — these move when they are ready.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            className="grid gap-4 pt-2 lg:grid-cols-2"
          >
            {/* Shipped */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col gap-4 rounded-cards border border-hairline bg-surface-1 p-6 sm:p-7"
            >
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-semantic-success" aria-hidden="true" />
                <h3 className="font-goga text-[16px] font-medium tracking-tight text-ink">
                  Shipped
                </h3>
                <span className="ml-auto rounded-full bg-surface-2 px-2.5 py-1 font-sans text-[11px] font-semibold tracking-[0.04em] text-ink-muted">
                  LIVE
                </span>
              </div>
              <ul className="flex flex-col gap-2.5">
                {shipped.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 border-t border-hairline/60 pt-2.5 first:border-0 first:pt-0"
                  >
                    <span
                      className="mt-[7px] size-1.5 shrink-0 rounded-full bg-ink/40"
                      aria-hidden="true"
                    />
                    <span className="font-sans text-[14px] leading-[1.5] text-ink-muted">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Coming next */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col gap-4 rounded-cards border border-hairline bg-canvas p-6 sm:p-7"
            >
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-accent-blue" aria-hidden="true" />
                <h3 className="font-goga text-[16px] font-medium tracking-tight text-ink">
                  Coming next
                </h3>
                <span className="ml-auto rounded-full border border-accent-blue/20 bg-accent-blue/10 px-2.5 py-1 font-sans text-[11px] font-semibold tracking-[0.04em] text-accent-blue">
                  NEXT
                </span>
              </div>
              <ul className="flex flex-col gap-2.5">
                {next.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 border-t border-hairline/60 pt-2.5 first:border-0 first:pt-0"
                  >
                    <span
                      className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent-blue/60"
                      aria-hidden="true"
                    />
                    <span className="font-sans text-[14px] leading-[1.5] text-ink-muted">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="font-sans text-[13px] leading-[1.5] text-ink-muted"
          >
            Roadmap items are factual and update-friendly — check back as
            milestones ship.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   Power features — differentiators the hero grid doesn't cover
   ─────────────────────────────────────────────────────────── */
function PowerFeaturesSection() {
  const reduce = useReducedMotion();
  const containerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.06, delayChildren: 0.08 },
    },
  };
  const itemVariants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: EASE_SMOOTH_OUT },
        },
      };

  const items = [
    {
      label: "Search",
      title: "Ctrl+K global search",
      desc: "One command palette across messages, people, and Spaces — with jump-to-message that lands you on the exact bubble, highlighted.",
    },
    {
      label: "Attachments",
      title: "Images & documents",
      desc: "Up to 10 files per message at 30 MB each. Images open in a fullscreen lightbox with keyboard navigation; docs render as download cards.",
    },
    {
      label: "PWA & offline",
      title: "Installable, queue-aware",
      desc: "Install Kivo to your home screen, get VAPID push when it's closed, and keep typing offline — text queues in a durable outbox and flushes on reconnect.",
    },
    {
      label: "Profiles",
      title: "Public pages & verified badges",
      desc: "Every account gets a shareable /u/username page with country flag and GitHub graph. Trusted accounts carry an admin-granted verified badge.",
    },
    {
      label: "Invites",
      title: "Private Space invite codes",
      desc: "Private Spaces stay hidden from Discover and admit members only through rotating 7-day invite codes — share a link or a code, rotate or revoke anytime.",
    },
    {
      label: "Sounds",
      title: "Per-category sound cues",
      desc: "DMs, mentions, groups, Spaces, and friend requests each get their own synthesized chime with preview and a master switch. Already viewing the DM? Kivo stays quiet.",
    },
  ];

  return (
    <section
      id="power-features"
      className="scroll-mt-24 border-t border-hairline/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <motion.div
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex flex-col gap-6"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-4">
            <SectionEyebrow>Power features</SectionEyebrow>
            <SectionTitle>
              The details <span className="text-ink-muted">that add up</span>
            </SectionTitle>
            <p className="max-w-[640px] font-sans text-[15px] leading-[1.6] text-ink-muted sm:text-[16px]">
              Beyond the basics — the differentiators that make Kivo feel
              finished, not demo-grade.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((f) => (
              <motion.div
                key={f.title}
                variants={itemVariants}
                className="flex flex-col gap-3 rounded-cards border border-hairline bg-surface-1 p-6"
              >
                <span className="inline-flex w-fit rounded-full border border-hairline bg-surface-2 px-2.5 py-1 font-sans text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {f.label}
                </span>
                <h3 className="font-goga text-[18px] font-medium leading-tight tracking-tight text-ink">
                  {f.title}
                </h3>
                <p className="font-sans text-[14px] leading-[1.6] text-ink-muted">
                  {f.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────────────────────────────────────────────────────────
   FAQ — t-acc accordion + FAQPage JSON-LD for SEO
   ─────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Is Kivo free?",
    a: "Yes. Kivo is a free student full-stack project. Sign up with a display name, username, email, and password (at least 8 characters) and you land in chat instantly — no OTP, no waiting, no paid tier.",
  },
  {
    q: "Do I need to install anything?",
    a: "No — Kivo runs in any modern browser. If you want it to feel native, install it: use the install icon in the Chrome/Edge address bar, Add to Home Screen on Android, or Share → Add to Home Screen on iPhone. The installed app opens straight into chat.",
  },
  {
    q: "How is Kivo different from Discord or WhatsApp?",
    a: "It puts both styles under one identity: WhatsApp-like private DMs and small groups, plus Discord-like Spaces with text and announcement channels. The differentiator on top is customization — a theme engine with per-user and per-Space palettes. It is deliberately not a Slack-style work tool.",
  },
  {
    q: "Is my account secure?",
    a: "Passwords are hashed with bcrypt and never stored readably. Sessions use short-lived 15-minute access tokens plus an httpOnly refresh cookie you can revoke with logout-everywhere, and every request is validated server-side with rate limiting on auth endpoints. Optional two-factor via authenticator app with backup codes adds a second step, and a password reset signs you out on all devices.",
  },
  {
    q: "Does Kivo work offline?",
    a: "Partly. Your lists and the latest 50 messages per chat are cached in the browser and paint instantly, and text you send while offline is queued in a durable outbox that delivers automatically on reconnect. Attachments need a connection, and full history requires one too.",
  },
  {
    q: "What isn't in Kivo yet?",
    a: "Threads, voice/video calls, and pinned or saved messages are not built yet — see the roadmap above for what shipped versus what is coming next. The Docs page documents exactly what works today.",
  },
];

function FaqSection() {
  const reduce = useReducedMotion();
  const [openIndex, setOpenIndex] = useState(0);

  const containerVariants = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.06, delayChildren: 0.08 },
    },
  };
  const itemVariants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: EASE_SMOOTH_OUT },
        },
      };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section
      id="faq"
      className="scroll-mt-24 border-t border-hairline/60 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
    >
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static FAQ JSON-LD serialized from a local constant — no user input */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-[800px]">
        <motion.div
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex flex-col gap-6"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-4">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <SectionTitle>
              Questions, <span className="text-ink-muted">answered</span>
            </SectionTitle>
            <p className="max-w-[640px] font-sans text-[15px] leading-[1.6] text-ink-muted sm:text-[16px]">
              The short version. For the full how-to, see the{" "}
              <a
                href="/docs"
                className="kivo-focus rounded-sm font-medium text-accent-blue underline-offset-2 hover:underline"
              >
                Docs
              </a>
              .
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={item.q}
                  className="t-acc"
                  data-open={String(isOpen)}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className="t-acc-head kivo-focus"
                  >
                    <span className="font-sans text-[14px] font-semibold leading-[1.4] text-ink sm:text-[15px]">
                      {item.q}
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
                    <div className="t-acc-panel-inner px-6 pb-6">
                      <p className="font-sans text-[14px] leading-[1.65] text-ink-muted">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
