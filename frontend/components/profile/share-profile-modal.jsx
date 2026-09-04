"use client";

import { Check, Copy, Share2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1];

function profileUrl(username) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/u/${encodeURIComponent(username)}`;
}

// Draws the profile URL as a QR code into a <canvas> using the `qrcode`
// package (pure JS, no network). Dark modules on transparent canvas so the
// code blends into the current theme.
function QrCanvas({ value, size = 168, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    let active = true;
    QRCode.toCanvas(
      ref.current,
      value,
      {
        width: size,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#ffffff", light: "#00000000" },
      },
      (err) => {
        if (err && active) {
          // Fallback: still show the URL as text so the feature never dead-ends.
          ref.current.style.display = "none";
        }
      },
    );
    return () => {
      active = false;
    };
  }, [value, size]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={cn("h-auto w-full max-w-[168px] rounded-lg", className)}
      aria-label="QR code linking to this profile"
      role="img"
    />
  );
}

export function ShareProfileModal({ username, profile, open, onClose }) {
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const url = profileUrl(username);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // no-op
    }
  };

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${profile?.displayName || profile?.username || username} on Kivo`,
          url,
        });
        return;
      }
    } catch {
      // user cancelled — fall through to clipboard
    }
    copyLink();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="share-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[2px]"
          />
          <motion.div
            key="share-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Share profile"
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }
            }
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.25, ease: EASE }
            }
            className="fixed inset-x-0 bottom-0 z-[90] mx-auto flex max-h-[88dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl border border-[var(--hairline)] bg-[var(--canvas)] shadow-2xl sm:bottom-auto sm:top-1/2 sm:max-h-[86vh] sm:-translate-y-1/2 sm:rounded-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--hairline-soft)] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Avatar
                  name={
                    profile?.displayName || profile?.username || username || "?"
                  }
                  url={profile?.avatarUrl}
                  size="xs"
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                    Share profile
                  </p>
                  <p className="truncate text-[11px] text-[var(--ink-muted)]">
                    {profile?.displayName || profile?.username || username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-full text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-1)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <div className="flex flex-col items-center gap-5">
                <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-1)] p-4">
                  <QrCanvas value={url} />
                </div>
                <p className="-mt-2 text-center text-[12px] text-[var(--ink-muted)]">
                  Scan to open {username ? `@${username}` : "this profile"} on
                  Kivo
                </p>

                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={nativeShare}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 text-[13px] font-semibold text-[var(--inverse-ink)] transition-opacity hover:opacity-90"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface-1)] px-4 text-[13px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--surface-2)]"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-[var(--semantic-success)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {copied ? "Copied" : "Copy link"}
                  </button>
                </div>

                <div className="w-full rounded-xl border border-[var(--hairline-soft)] bg-[var(--surface-1)] px-3 py-2 text-center text-[11px] text-[var(--ink-muted)]">
                  {url}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ShareProfileModal;
