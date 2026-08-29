"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Navbar } from "../components/navbar/navbar";
import { GuestGate } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

/* Drop your hero visual in /public and point this at the file.
   e.g. "/hero-image.png". Until it exists, a placeholder is shown. */
const HERO_IMAGE = "/hero-image";

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
                  <Button
                    render={<a href="#get-started" />}
                    className="kivo-cta h-auto rounded-pills px-6 py-3 text-[16px] font-medium leading-none tracking-[-0.352px] transition-[transform,filter] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:ring-accent-blue/30 has-[>svg]:px-6"
                  >
                    Get Started
                  </Button>
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
                    render={<a href="#learn-more" />}
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
