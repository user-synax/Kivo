"use client";

import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

export function Hero() {
  const reduce = useReducedMotion();

  const textContainerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const textItemVariants = reduce
    ? {
        hidden: { opacity: 1 },
        show: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0, y: 14 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.5, ease: EASE_SMOOTH_OUT },
        },
      };

  const previewVariants = reduce
    ? {
        hidden: { opacity: 1, scale: 1 },
        show: { opacity: 1, scale: 1 },
      }
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
    <section className="relative flex min-h-[calc(100vh-84px)] flex-col justify-center items-center overflow-hidden overflow-x-hidden bg-warm-canvas px-4 pb-16 pt-[84px] sm:min-h-[calc(100vh-92px)] sm:px-6 sm:pb-20 sm:pt-[92px] md:min-h-[calc(100vh-82px)] md:pt-[82px] lg:min-h-[calc(100vh-82px)] lg:px-8 lg:pb-24 lg:items-start">
      {/* subtle radial glow behind the preview - carries personality, does not compete */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-[58%] h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember-orange/[0.06] blur-[80px] lg:left-[68%] lg:top-[52%] lg:h-[900px] lg:w-[900px]" />
        <div className="absolute left-1/2 top-[62%] h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ember-orange/[0.08] blur-[48px] lg:left-[68%] lg:top-[56%]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-10 lg:grid lg:grid-cols-2 lg:items-center lg:gap-12 xl:gap-16">
        {/* Text column */}
        <motion.div
          variants={textContainerVariants}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="flex max-w-[640px] flex-col gap-6 lg:max-w-none lg:gap-8"
        >
          <motion.h1
            variants={textItemVariants}
            className="font-goga text-[36px] font-normal leading-[0.95] tracking-[-0.017em] text-ink-black sm:text-[48px] sm:tracking-[-0.007em] lg:text-[54px] xl:text-[64px] xl:tracking-[-0.448px] xl:leading-[1]"
            style={{ fontFeatureSettings: '"ss01"' }}
          >
            <span className="text-ember-orange">Chat</span> your way.
          </motion.h1>

          <motion.p
            variants={textItemVariants}
            className="max-w-[560px] font-sans text-[16px] font-normal leading-[1.5] tracking-[-0.352px] text-pewter sm:text-[18px] lg:text-[20px] lg:leading-[1.5] lg:tracking-[-0.36px]"
            style={{ fontFeatureSettings: '"cv11"' }}
          >
            DMs, groups, and communities - all in one place, built around how
            you communicate.
          </motion.p>

          <motion.div
            variants={textItemVariants}
            className="flex flex-wrap items-center gap-3 pt-1 sm:gap-4"
          >
            {/* Primary CTA - Ember Pill Button: 9999px, #ff3c00 fill, white text */}
            <motion.div
              whileHover={reduce ? undefined : { scale: 1.02 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={{ duration: 0.2, ease: EASE_SMOOTH_OUT }}
              className="shrink-0"
            >
              <Button
                render={<a href="#get-started" />}
                className="kivo-cta h-auto rounded-pills border border-ember-orange bg-ember-orange px-6 py-3 text-[16px] font-medium leading-none tracking-[-0.352px] text-white shadow-none hover:bg-ember-orange hover:text-white focus-visible:ring-ember-orange/30 has-[>svg]:px-6"
                style={{ fontFeatureSettings: '"cv11"' }}
              >
                Get Started
              </Button>
            </motion.div>

            {/* Secondary CTA - Ghost Outline Button: transparent, ink border */}
            <motion.div
              whileHover={reduce ? undefined : { scale: 1.02 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={{ duration: 0.2, ease: EASE_SMOOTH_OUT }}
              className="shrink-0"
            >
              <Button
                variant="outline"
                render={<a href="#learn-more" />}
                className="h-auto rounded-pills border border-ink-black bg-transparent px-6 py-3 text-[16px] font-medium leading-none tracking-[-0.352px] text-ink-black shadow-none hover:bg-ink-black/5 hover:text-ink-black focus-visible:ring-ink-black/20 has-[>svg]:px-6"
                style={{ fontFeatureSettings: '"cv11"' }}
              >
                Learn More
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Preview visual column */}
        <motion.div
          variants={previewVariants}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="relative w-full min-w-0 max-w-full lg:pl-2"
        >
          <div className="relative mx-auto w-full max-w-full overflow-hidden sm:max-w-[560px] lg:mx-0 lg:ml-auto">
            {/* outer card - Code Window / chat mockup */}
            <div className="relative w-full max-w-full overflow-hidden rounded-xl border border-stone/60 bg-fog shadow-md">
              {/* top bar - traffic lights */}
              <div className="flex h-10 min-w-0 max-w-full items-center justify-between overflow-hidden border-b border-stone bg-fog px-4">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56] opacity-90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e] opacity-90" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f] opacity-90" />
                </div>
                <span className="font-sans text-[12px] font-medium tracking-[0.6px] text-pewter">
                  kivo - general
                </span>
                <span className="h-2 w-2 rounded-full bg-ember-orange shadow-[0_0_8px_rgba(255,60,0,0.5)]" />
              </div>

              {/* body - split */}
              <div className="flex h-[320px] w-full max-w-full min-w-0 overflow-hidden sm:h-[360px]">
                {/* conversation list */}
                <div className="hidden w-[42%] max-w-[42%] min-w-0 flex-col border-r border-stone bg-warm-canvas/40 p-3 md:flex">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-ember-orange p-1">
                      <div className="h-full w-full rounded-full bg-fog" />
                    </div>
                    <span className="font-sans text-[12px] font-medium tracking-[0.6px] text-ink-black">
                      Chats
                    </span>
                    <span className="ml-auto rounded-pills bg-ember-orange px-2 py-0.5 font-sans text-[10px] font-medium leading-none text-white">
                      3 new
                    </span>
                  </div>

                  {/* search placeholder */}
                  <div className="mb-3 flex h-7 items-center gap-2 rounded-lg border border-stone/40 bg-fog px-2.5">
                    <span className="h-3 w-3 rounded-full border border-stone" />
                    <span className="font-sans text-[12px] text-pewter">
                      Search
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <ConversationRow
                      active
                      name="Design crew"
                      preview="Maya: the mock looks..."
                      unread={2}
                    />
                    <ConversationRow
                      name="Family group"
                      preview="Dad: dinner at 7?"
                    />
                    <ConversationRow
                      name="Alex Rivera"
                      preview="yeah, ship it"
                    />
                    <ConversationRow
                      name="Community - kivo"
                      preview="Welcome to #general"
                      muted
                    />
                  </div>

                  <div className="mt-auto flex items-center gap-2 rounded-lg border border-stone/30 bg-fog px-2.5 py-2">
                    <div className="h-6 w-6 rounded-full bg-fog" />
                    <div className="flex flex-col">
                      <span className="font-sans text-[12px] font-medium leading-none text-ink-black">
                        You
                      </span>
                      <span className="font-sans text-[10px] leading-none text-pewter">
                        Online
                      </span>
                    </div>
                    <span className="ml-auto h-2 w-2 rounded-full bg-ember-orange" />
                  </div>
                </div>

                {/* message thread */}
                <div className="flex min-w-0 w-full max-w-full flex-1 flex-col overflow-hidden bg-fog">
                  {/* thread header */}
                  <div className="flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden border-b border-stone px-4 py-3">
                    <div className="flex -space-x-1.5">
                      <span className="h-6 w-6 rounded-full border border-stone bg-sand" />
                      <span className="h-6 w-6 rounded-full border border-stone bg-driftwood" />
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-stone bg-ember-orange font-sans text-[10px] font-medium text-white">
                        +5
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-sans text-[13px] font-medium leading-none text-ink-black">
                        Design crew
                      </span>
                      <span className="font-sans text-[11px] leading-none text-pewter">
                        8 members - 3 online
                      </span>
                    </div>
                  </div>

                  {/* messages */}
                  <div className="flex min-w-0 max-w-full flex-1 flex-col gap-3 overflow-hidden p-4">
                    <div className="flex min-w-0 max-w-full gap-2">
                      <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-fog ring-1 ring-stone/40" />
                      <div className="flex min-w-0 max-w-[78%] flex-col gap-1">
                        <span className="font-sans text-[11px] font-medium text-pewter">
                          Maya - 10:42 AM
                        </span>
                        <div className="w-full max-w-full overflow-hidden rounded-lg rounded-bl-sm border border-stone/30 bg-fog px-3 py-2">
                          <p className="break-words font-sans text-[13px] leading-[1.43] tracking-[-0.1px] text-ink-black/90 [overflow-wrap:anywhere]">
                            The new thread view is so much cleaner. Love the
                            grouping.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-w-0 max-w-full gap-2">
                      <span className="mt-1 h-6 w-6 shrink-0 rounded-full bg-fog ring-1 ring-stone/40" />
                      <div className="flex min-w-0 max-w-[78%] flex-col gap-1">
                        <span className="font-sans text-[11px] font-medium text-pewter">
                          Jonah - 10:43 AM
                        </span>
                        <div className="w-full max-w-full overflow-hidden rounded-lg rounded-bl-sm border border-stone/30 bg-fog px-3 py-2">
                          <p className="break-words font-sans text-[13px] leading-[1.43] text-ink-black/90 [overflow-wrap:anywhere]">
                            Agreed - can we keep the DM sidebar collapsed by
                            default?
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* sent bubble with micro-interaction */}
                    <motion.div
                      className="ml-auto flex min-w-0 max-w-[72%] flex-col items-end gap-1"
                      whileHover={
                        reduce ? undefined : { scale: 1.015, y: -1 }
                      }
                      animate={
                        reduce
                          ? undefined
                          : { y: [0, -2, 0] }
                      }
                      transition={
                        reduce
                          ? undefined
                          : {
                              y: {
                                duration: 3.2,
                                repeat: Number.POSITIVE_INFINITY,
                                ease: "easeInOut",
                                delay: 1.2,
                              },
                              scale: { duration: 0.2, ease: EASE_SMOOTH_OUT },
                            }
                      }
                    >
                      <div className="w-full max-w-full overflow-hidden rounded-lg rounded-br-sm bg-ember-orange px-3 py-2">
                        <p className="break-words font-sans text-[13px] font-medium leading-[1.43] text-white [overflow-wrap:anywhere]">
                          Done - pushed an update. Try it now?
                        </p>
                      </div>
                      <span className="font-sans text-[10px] leading-none text-pewter">
                        You - 10:44 AM
                      </span>
                    </motion.div>
                  </div>

                  {/* composer */}
                  <div className="min-w-0 max-w-full overflow-hidden border-t border-stone bg-fog/60 p-2.5">
                    <div className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-pills border border-stone/40 bg-warm-canvas px-3 py-2">
                      <span className="h-4 w-4 shrink-0 rounded-full border border-stone" />
                      <span className="min-w-0 flex-1 truncate break-words font-sans text-[13px] text-pewter [overflow-wrap:anywhere]">
                        Message Design crew...
                      </span>
                      <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ember-orange">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M2 6L10 2L6 10L5 6.5L2 6Z"
                            fill="#ffffff"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* floating presence indicator - subtle personality accent */}
            <motion.div
              aria-hidden="true"
              className="absolute -right-2 -top-2 hidden items-center gap-1.5 rounded-pills border border-stone/50 bg-fog px-2.5 py-1 shadow-md sm:flex lg:-right-3"
              initial={reduce ? false : { opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                ease: EASE_SMOOTH_OUT,
                delay: 0.75,
              }}
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-ember-orange" />
              <span className="font-sans text-[11px] font-medium text-ink-black">
                Live
              </span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function ConversationRow({ name, preview, active, unread, muted }) {
  return (
    <div
      className={[
        "flex items-center gap-2.5 rounded-lg px-2 py-2",
        active
          ? "border border-stone/50 bg-fog"
          : "border border-transparent hover:bg-fog/40",
        muted ? "opacity-60" : "",
      ].join(" ")}
    >
      <span
        className={[
          "h-7 w-7 shrink-0 rounded-full",
          active ? "bg-ember-orange" : "bg-stone",
        ].join(" ")}
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={[
            "truncate font-sans text-[13px] font-medium leading-none",
            active ? "text-ink-black" : "text-ink-black/80",
          ].join(" ")}
        >
          {name}
        </span>
        <span className="truncate font-sans text-[11px] leading-none text-pewter">
          {preview}
        </span>
      </span>
      {unread ? (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-pills bg-ember-orange px-1 font-sans text-[11px] font-medium leading-none text-white">
          {unread}
        </span>
      ) : null}
    </div>
  );
}

export default Hero;
