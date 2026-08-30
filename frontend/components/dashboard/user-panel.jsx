"use client";

import { motion, useReducedMotion } from "motion/react";
import { Avatar } from "@/components/dashboard/avatar";

// Online / Offline status label — reuses the transitions-dev text-swap: the
// keyed span remounts on change so it blur-rises in (reduced-motion safe).
function StatusText({ online }) {
  return (
    <span key={online ? "on" : "off"} className="t-text-swap">
      {online ? "Online" : "Offline"}
    </span>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
      <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

function formatJoined(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString([], { month: "long", year: "numeric" });
}

const EASE = [0.22, 1, 0.36, 1];

export function UserPanel({ profile, loading, online, conversationCreatedAt }) {
  const reduce = useReducedMotion();

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
  };
  const item = {
    hidden: { opacity: 0, y: 10, filter: "blur(3px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: reduce ? { duration: 0 } : { duration: 0.45, ease: EASE },
    },
  };

  return (
    <motion.aside
      initial={reduce ? false : { opacity: 0, x: 28, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 28, filter: "blur(4px)" }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, ease: EASE }}
      className="t-scroll hidden h-full w-[320px] shrink-0 flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-elevated)] xl:flex"
      aria-label="Conversation details"
    >
      {/* Cover banner — animated GIF when the user has picked one, otherwise the
          default coral gradient. */}
      <div className="relative h-24 shrink-0 overflow-hidden bg-gradient-to-br from-accent-blue/40 to-[#6a4cf5]/40">
        {profile?.banner ? (
          <img
            src={profile.banner}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col px-5 pb-6"
      >
        {/* Identity block — avatar overlaps the cover, with comfortable top gap. */}
        <motion.div
          variants={item}
          className="-mt-8 flex flex-col items-center text-center"
        >
          <div className="rounded-[calc(var(--radius-cards)*0.5)] bg-[var(--bg-elevated)] p-1.5">
            <Avatar
              name={profile?.displayName || profile?.username || "?"}
              online={online}
              avatarStyle={profile?.avatarStyle}
              url={profile?.avatarUrl}
              size="xl"
            />
          </div>
          <h2 className="mt-3 text-[18px] font-semibold leading-tight text-[var(--text-primary)]">
            {profile?.displayName || profile?.username || "Unknown"}
          </h2>
          {profile?.username ? (
            <p className="text-[13px] text-[var(--text-muted)]">
              @{profile.username}
            </p>
          ) : null}
          <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
            <span
              className={`size-2 rounded-full ${online ? "bg-[var(--online)]" : "bg-[var(--color-stone)]"}`}
            />
            <StatusText online={online} />
          </div>
        </motion.div>

        {/* Custom status line (the user's free-text status). */}
        {profile?.status ? (
          <motion.div
            variants={item}
            className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-2.5 text-center text-[13px] italic text-[var(--text-muted)]"
          >
            {profile.status}
          </motion.div>
        ) : null}

        {/* About / bio. */}
        <motion.div variants={item} className="mt-4">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            About
          </p>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-8 py-3.5">
            {loading ? (
              <div className="h-3 w-2/3 animate-pulse rounded-full bg-[var(--color-driftwood)]" />
            ) : profile?.bio ? (
              <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">
                {profile.bio}
              </p>
            ) : (
              <p className="text-[13px] text-[var(--text-muted)]">
                No bio yet.
              </p>
            )}
          </div>
        </motion.div>

        {/* Structured details. */}
        <motion.div variants={item} className="mt-4">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Details
          </p>
          <div className="rounded-2xl divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--bg-surface)] px-8">
            <DetailRow label="Email" value={profile?.email} />
            <DetailRow label="Member since" value={formatJoined(profile?.createdAt)} />
            <DetailRow
              label="Conversation started"
              value={formatJoined(conversationCreatedAt)}
            />
          </div>
        </motion.div>

        <motion.p
          variants={item}
          className="mt-5 text-center text-[11px] text-[var(--text-muted)]"
        >
          You can only see what this person chooses to share.
        </motion.p>
      </motion.div>
    </motion.aside>
  );
}

export default UserPanel;
