"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { GuestGate } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

export default function ForgotPasswordPage() {
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.12 } },
  };
  const itemVariants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 8 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: EASE_SMOOTH_OUT },
        },
      };

  function handleChange(e) {
    setEmail(e.target.value);
    if (errors.email) setErrors({});
  }

  function handleBlur(e) {
    if (!e.target.value.trim()) {
      setErrors({ email: "Email is required." });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
      setErrors({ email: "Please enter a valid email address." });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      setErrors({ email: "Email is required." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: "Please enter a valid email address." });
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Always show success message regardless of whether email exists
      setSubmitted(true);
    } catch {
      // Even on network error, show the same message (don't leak info)
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <GuestGate>
      <AuthCard>
        <motion.form
          onSubmit={handleSubmit}
          noValidate
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="flex flex-col gap-5"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
            <span className="font-sans text-[12px] font-medium uppercase tracking-[0.05em] text-pewter">
              Reset password
            </span>
            <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
              Forgot your password?
            </h1>
            <p className="font-sans text-[14px] leading-relaxed text-pewter">
              {submitted
                ? "If an account exists with that email, we've sent a password reset link. Check your inbox."
                : "Enter the email address associated with your account and we'll send you a link to reset your password."}
            </p>
          </motion.div>

          {!submitted && (
            <>
              <motion.div variants={itemVariants}>
                <AuthInput
                  id="email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={errors.email}
                  autoComplete="email"
                  required
                />
              </motion.div>

              <motion.div variants={itemVariants}>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="kivo-cta h-auto w-full rounded-pills px-6 py-3 text-[15px] font-medium shadow-[0_10px_28px_-10px_rgba(0,0,0,0.6)] transition-[transform,filter] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110 active:scale-[0.98] disabled:opacity-60 focus-visible:ring-accent-blue/30"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin"
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="opacity-25"
                        />
                        <path
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          fill="currentColor"
                          className="opacity-75"
                        />
                      </svg>
                      Sending link…
                    </span>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </motion.div>
            </>
          )}

          {submitted && (
            <motion.div variants={itemVariants}>
              <div className="rounded-lg border border-green-400/30 bg-green-400/10 px-3 py-2.5 font-sans text-[13px] text-green-600">
                Check your email for the reset link. It may take a minute to arrive.
              </div>
            </motion.div>
          )}

          <motion.p
            variants={itemVariants}
            className="text-center font-sans text-[14px] text-pewter"
          >
            <a
              href="/login"
              className="font-medium text-electric-blue transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink-black"
            >
              Back to login
            </a>
          </motion.p>
        </motion.form>
      </AuthCard>
    </GuestGate>
  );
}
