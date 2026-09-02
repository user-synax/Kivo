"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { GuestGate } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

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

  function validate(fields) {
    const errs = {};
    if (!fields.newPassword) {
      errs.newPassword = "Password is required.";
    } else if (fields.newPassword.length < 8) {
      errs.newPassword = "Password must be at least 8 characters.";
    }
    if (!fields.confirmPassword) {
      errs.confirmPassword = "Please confirm your password.";
    } else if (fields.newPassword !== fields.confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    return errs;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (serverError) setServerError("");
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    const fieldErrors = validate({ ...formData, [name]: value });
    if (fieldErrors[name]) {
      setErrors((prev) => ({ ...prev, [name]: fieldErrors[name] }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token) {
      setServerError("No reset token found. Please request a new link from the login page.");
      return;
    }

    const fieldErrors = validate(formData);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    setServerError("");

    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: formData.newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data?.error?.message || "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setServerError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthCard>
        <motion.div
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="flex flex-col items-center gap-5 text-center"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
            <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
              Invalid link
            </h1>
            <p className="font-sans text-[14px] leading-relaxed text-pewter">
              This password reset link is invalid. Please request a new one.
            </p>
          </motion.div>
          <motion.div variants={itemVariants}>
            <a
              href="/forgot-password"
              className="font-sans text-[14px] font-medium text-electric-blue transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink-black"
            >
              Request a new link
            </a>
          </motion.div>
        </motion.div>
      </AuthCard>
    );
  }

  if (success) {
    return (
      <AuthCard>
        <motion.div
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="flex flex-col items-center gap-5 text-center"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
            <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
              Password reset
            </h1>
            <p className="font-sans text-[14px] leading-relaxed text-pewter">
              Your password has been reset. You can now log in with your new password.
            </p>
          </motion.div>
          <motion.div variants={itemVariants}>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="font-sans text-[14px] font-medium text-electric-blue transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink-black"
            >
              Go to login
            </button>
          </motion.div>
        </motion.div>
      </AuthCard>
    );
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
              New password
            </span>
            <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
              Reset your password
            </h1>
            <p className="font-sans text-[14px] leading-relaxed text-pewter">
              Choose a strong new password for your account.
            </p>
          </motion.div>

          {serverError && (
            <motion.div
              variants={itemVariants}
              className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5 font-sans text-[13px] text-red-400"
            >
              {serverError}
            </motion.div>
          )}

          <motion.div variants={itemVariants}>
            <AuthInput
              id="newPassword"
              label="New Password"
              value={formData.newPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.newPassword}
              autoComplete="new-password"
              required
              isPassword
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <AuthInput
              id="confirmPassword"
              label="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.confirmPassword}
              autoComplete="new-password"
              required
              isPassword
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
                  Resetting…
                </span>
              ) : (
                "Reset Password"
              )}
            </Button>
          </motion.div>
        </motion.form>
      </AuthCard>
    </GuestGate>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex flex-col gap-1.5">
              <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
                Loading…
              </h1>
            </div>
            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-hairline border-t-eclipse-violet" />
          </div>
        </AuthCard>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
