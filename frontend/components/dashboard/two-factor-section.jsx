"use client";

import {
  Check,
  Copy,
  KeyRound,
  Loader2,
  QrCode,
  Shield,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

const EASE = [0.22, 1, 0.36, 1];

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-[var(--accent)]";

const labelClass =
  "mb-1 block text-[11px] font-medium text-[var(--text-muted)]";

const fieldClass = "flex flex-col gap-1";

const primaryBtnClass =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-[var(--on-accent)] transition-[filter,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";

const ghostBtnClass =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-transparent px-4 py-2 text-[12px] font-medium text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

// ── Shared dialog chrome (backdrop + centered card) ─────────────────────────
function DialogFrame({ open, onClose, title, subtitle, children }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.2, ease: EASE }
            }
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px]"
          />
          <div className="pointer-events-none fixed inset-0 z-[61] flex items-center justify-center p-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.96, y: 10, filter: "blur(3px)" }
              }
              animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.97, y: 8, filter: "blur(2px)" }
              }
              transition={
                reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }
              }
              className="pointer-events-auto flex max-h-[88dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                    {title}
                  </h2>
                  {subtitle && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
                      {subtitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── The actual 2FA flow state machine ───────────────────────────────────────
function TwoFactorFlow({ mode, onClose, onChanged }) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(mode === "enable" ? "loading" : "disable");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(null); // { secret, accountName, uri, qrDataUrl }
  const [backupCodes, setBackupCodes] = useState([]);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  // Enable flow: stage 1 mints the secret + QR.
  useEffect(() => {
    if (phase !== "loading") return undefined;
    let active = true;
    setError(null);
    apiPost("/api/v1/auth/2fa/setup", {})
      .then((data) => {
        if (!active) return;
        setSetup(data);
        setPhase("qr");
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "Could not start 2FA setup.");
        setPhase("error");
      });
    return () => {
      active = false;
    };
  }, [phase]);

  async function handleEnable(e) {
    e?.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiPost("/api/v1/auth/2fa/enable", {
        code: code.trim(),
      });
      setBackupCodes(Array.isArray(data?.backupCodes) ? data.backupCodes : []);
      setPhase("backup");
    } catch (err) {
      setError(
        err?.message || "Could not enable 2FA. Check the code and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(e) {
    e?.preventDefault();
    if (!code.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("/api/v1/auth/2fa/disable", {
        code: code.trim(),
        password,
      });
      onChanged?.(false);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Could not disable 2FA.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyAll() {
    const ok = await copyText(backupCodes.join("\n"));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  const dialogTitle =
    phase === "disable"
      ? "Turn off two-factor authentication"
      : phase === "backup"
        ? "Save your backup codes"
        : phase === "error"
          ? "Enable two-factor authentication"
          : "Scan with your authenticator app";

  return (
    <DialogFrame
      open
      onClose={onClose}
      title={dialogTitle}
      subtitle={
        phase === "disable"
          ? "Enter your password plus a code from your authenticator app (or a backup code) to confirm."
          : undefined
      }
    >
      <motion.div
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05 } },
        }}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-4"
      >
        {phase === "loading" && (
          <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing setup…
          </div>
        )}

        {phase === "qr" && setup && (
          <>
            <motion.p
              variants={{
                hidden: { opacity: 0, y: 6 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.3, ease: EASE },
                },
              }}
              className="text-[13px] leading-relaxed text-[var(--text-muted)]"
            >
              Open an authenticator app (Google Authenticator, Authy,
              1Password…) and scan the QR code below. If scanning fails, add the
              key manually using the secret.
            </motion.p>
            <div className="flex items-center justify-center rounded-xl border border-[var(--border)] bg-white p-3">
              {/* QR data URLs are light-on-dark ready PNGs from the server */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qrDataUrl}
                alt={`Scan this QR code in your authenticator app to add Kivo (${setup.accountName})`}
                width={240}
                height={240}
                className="h-auto w-56 rounded-lg"
              />
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
              <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                Manual entry
              </span>
              <div className="flex items-center justify-between gap-3">
                <code className="min-w-0 select-all break-all font-mono text-[12px] leading-snug text-[var(--text-primary)]">
                  {setup.secret}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyText(setup.secret);
                    if (ok) {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                Account:{" "}
                <span className="text-[var(--text-primary)]">
                  {setup.accountName}
                </span>
                {" · "}Type: time-based
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
              Codes refresh every 30 seconds. If codes keep failing, make sure
              your device clock is set to automatic time.
            </p>
            <button
              type="button"
              onClick={() => setPhase("verify")}
              className={`${primaryBtnClass} w-full`}
            >
              I&apos;ve scanned it — next
            </button>
          </>
        )}

        {phase === "verify" && (
          <>
            <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
              Enter the 6-digit code currently shown in your authenticator app
              to confirm everything is set up correctly.
            </p>
            <form onSubmit={handleEnable} className="flex flex-col gap-3">
              <div className={fieldClass}>
                <label htmlFor="tf-enable-code" className={labelClass}>
                  Verification code
                </label>
                <input
                  id="tf-enable-code"
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
                  placeholder="123456"
                  className={inputClass}
                />
              </div>
              {error && <p className="text-[12px] text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy || code.length < 6}
                className={`${primaryBtnClass} w-full`}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enable two-factor authentication
              </button>
            </form>
          </>
        )}

        {phase === "backup" && (
          <>
            <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
              Two-factor authentication is on. These{" "}
              <strong className="font-medium text-[var(--text-primary)]">
                backup codes are shown only once
              </strong>{" "}
              — each can be used a single time to log in if you lose your
              authenticator app.
            </p>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3">
              <div className="flex items-center justify-between gap-2 pb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Backup codes
                </span>
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                >
                  {copied ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy all"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {backupCodes.map((c) => (
                  <code
                    key={c}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-center font-mono text-[12px] tracking-wide text-[var(--text-primary)] select-all"
                  >
                    {c}
                  </code>
                ))}
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
              Store them somewhere safe — Kivo can&apos;t recover them for you.
            </p>
            <button
              type="button"
              onClick={() => {
                onChanged?.(true);
                onClose?.();
              }}
              className={`${primaryBtnClass} w-full`}
            >
              I&apos;ve saved my backup codes
            </button>
          </>
        )}

        {phase === "disable" && (
          <>
            <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" />
              <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                After disabling, your account will only need a password to sign
                in. Your authenticator entries and remaining backup codes are
                deleted.
              </p>
            </div>
            <form onSubmit={handleDisable} className="flex flex-col gap-3">
              <div className={fieldClass}>
                <label htmlFor="tf-disable-password" className={labelClass}>
                  Password
                </label>
                <input
                  id="tf-disable-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your account password"
                  className={inputClass}
                />
              </div>
              <div className={fieldClass}>
                <label htmlFor="tf-disable-code" className={labelClass}>
                  Authentication code
                </label>
                <input
                  id="tf-disable-code"
                  name="code"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456 or ABCDE-FGHIJ"
                  className={inputClass}
                />
              </div>
              {error && <p className="text-[12px] text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy || !password || !code.trim()}
                className={`${ghostBtnClass} w-full !border-red-400/40 !text-red-400 hover:!bg-red-400/10 hover:!text-red-400`}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Turn off two-factor authentication
              </button>
            </form>
          </>
        )}

        {phase === "error" && (
          <>
            <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
              {error}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPhase("loading");
                }}
                className={`${primaryBtnClass} flex-1`}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`${ghostBtnClass} flex-1`}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </motion.div>
    </DialogFrame>
  );
}

// ── Settings card ───────────────────────────────────────────────────────────
export function TwoFactorSection() {
  const [enabled, setEnabled] = useState(null); // null = loading
  const [flow, setFlow] = useState(null); // null | "enable" | "disable"
  const [loadError, setLoadError] = useState(null);

  const refresh = useCallback(() => {
    apiGet("/api/v1/auth/2fa/status")
      .then((data) => setEnabled(Boolean(data?.enabled)))
      .catch((err) => {
        setLoadError(err?.message || "Could not load 2FA status");
        setEnabled(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)]">
            <Shield className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">
              Security
            </h3>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
              Two-factor authentication adds an extra code to sign in.
            </p>
            <div className="mt-3">
              {enabled === null ? (
                <div className="flex items-center gap-2 py-1 text-[12px] text-[var(--text-muted)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking…
                </div>
              ) : (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3">
                  {enabled ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full bg-[#22c55e]"
                          aria-hidden="true"
                        />
                        <p className="text-[13px] font-medium text-[var(--text-primary)]">
                          Two-factor authentication is on
                        </p>
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
                        Sign-in now asks for a code from your authenticator app
                        or a backup code.
                      </p>
                      <button
                        type="button"
                        onClick={() => setFlow("disable")}
                        className="mt-3 inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                      >
                        Turn off 2FA
                      </button>
                    </>
                  ) : (
                    <>
                      {loadError ? (
                        <p className="text-[12px] leading-relaxed text-red-400">
                          {loadError}
                        </p>
                      ) : (
                        <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
                          Protect your account with a time-based code from an
                          authenticator app. You&apos;ll also get one-time
                          backup codes.
                        </p>
                      )}
                      <div className="mt-2.5 flex flex-col gap-1.5">
                        <p className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
                          <Smartphone className="h-3.5 w-3.5 shrink-0" />
                          Scan a QR code with any authenticator app
                        </p>
                        <p className="flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
                          <KeyRound className="h-3.5 w-3.5 shrink-0" />
                          Save backup codes for when you lose your device
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFlow("enable")}
                        className="mt-3 inline-flex items-center justify-center rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98]"
                      >
                        <QrCode className="mr-1.5 h-3.5 w-3.5" />
                        Enable 2FA
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {flow && (
        <TwoFactorFlow
          mode={flow}
          onClose={() => setFlow(null)}
          onChanged={(value) => {
            setEnabled(value);
            setLoadError(null);
          }}
        />
      )}
    </>
  );
}

export default TwoFactorSection;
