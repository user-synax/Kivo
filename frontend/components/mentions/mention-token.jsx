"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Avatar } from "@/components/dashboard/avatar";
import { participantAvatarName, participantName } from "@/lib/chat";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1];
const HOVER_OPEN_DELAY = 250;
const HOVER_CLOSE_DELAY = 180;

export function MentionToken({ username, user, isOnline = false }) {
  const [isDesktopHover, setIsDesktopHover] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, side: "top" });

  const tokenRef = useRef(null);
  const cardRef = useRef(null);
  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  // Check desktop hover capability: window.matchMedia("(hover: hover) and (pointer: fine)")
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setIsDesktopHover(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const cancelTimers = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  useEffect(() => () => cancelTimers(), []);

  const updatePosition = () => {
    if (!tokenRef.current) return;
    const rect = tokenRef.current.getBoundingClientRect();
    const cardWidth = 240;
    const cardHeight = 110;

    const spaceAbove = rect.top;
    const side = spaceAbove < cardHeight + 16 ? "bottom" : "top";

    const top =
      side === "top"
        ? Math.max(12, rect.top - cardHeight - 8)
        : rect.bottom + 8;

    let left = rect.left + rect.width / 2 - cardWidth / 2;
    // Clamp to viewport
    const maxLeft = (typeof window !== "undefined" ? window.innerWidth : 800) - cardWidth - 12;
    left = Math.max(12, Math.min(left, maxLeft));

    setPosition({ top, left, side });
  };

  const handlePointerEnter = () => {
    if (!isDesktopHover) return;
    cancelTimers();
    openTimer.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, HOVER_OPEN_DELAY);
  };

  const handlePointerLeave = () => {
    if (!isDesktopHover) return;
    cancelTimers();
    closeTimer.current = setTimeout(() => {
      setIsOpen(false);
    }, HOVER_CLOSE_DELAY);
  };

  const name = participantName(user) || username;
  const avatarName = participantAvatarName(user) || username;
  const handleTag = `@${username}`;

  return (
    <>
      <span
        ref={tokenRef}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={cn(
          "inline-flex items-center rounded bg-[var(--accent)]/15 px-1 py-0.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/25",
          isDesktopHover && "cursor-pointer",
        )}
      >
        {handleTag}
      </span>

      {isDesktopHover &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={cardRef}
                onPointerEnter={cancelTimers}
                onPointerLeave={handlePointerLeave}
                initial={{ opacity: 0, scale: 0.95, y: position.side === "top" ? 4 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: position.side === "top" ? 4 : -4 }}
                transition={{ duration: 0.2, ease: EASE }}
                style={{
                  position: "fixed",
                  top: position.top,
                  left: position.left,
                }}
                className="z-[9999] w-60 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 shadow-2xl backdrop-blur-xl"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={avatarName}
                    online={isOnline}
                    avatarStyle={user?.avatarStyle}
                    url={user?.avatarUrl}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {name}
                    </p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {handleTag}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          isOnline ? "bg-emerald-500" : "bg-[var(--text-muted)]/40",
                        )}
                      />
                      <span className="text-[var(--text-muted)]">
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

export default MentionToken;
