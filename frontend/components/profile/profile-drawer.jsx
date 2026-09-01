"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { ProfileContent } from "@/components/profile/profile-content";

const EASE = [0.22, 1, 0.36, 1];

export function ProfileDrawer({ username, open, onClose, onMessage }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    // lock scroll while drawer is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && username && (
        <>
          {/* backdrop — t-modal-backdrop pattern: opacity 0→1, 250ms, same ease */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: 0.25, ease: EASE }
            }
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
          />
          {/* sheet — transitions-dev 06-modal + 07-panel-reveal mapping:
              bottom-anchored, y:100%→0, open 400ms / close 350ms, ease [0.22,1,0.36,1],
              reducedMotion → instant. */}
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Profile of @${username}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={
              reduce
                ? { duration: 0 }
                : open
                  ? { duration: 0.4, ease: EASE }
                  : { duration: 0.35, ease: EASE }
            }
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.12}
            onDragEnd={(_, info) => {
              if (info.offset.y > 80 || info.velocity.y > 600) onClose?.();
            }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[20px] border-x border-t border-[var(--hairline)] bg-[var(--canvas)] shadow-[0_-16px_48px_rgba(0,0,0,0.45)] sm:left-1/2 sm:w-full sm:max-w-[560px] sm:-translate-x-1/2"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
          >
            {/* drag handle */}
            <div className="flex shrink-0 justify-center pb-1 pt-3">
              <span className="h-1.5 w-9 rounded-full bg-[var(--hairline)]" aria-hidden="true" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <ProfileContent username={username} variant="drawer" onClose={onClose} onMessage={onMessage} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ProfileDrawer;
