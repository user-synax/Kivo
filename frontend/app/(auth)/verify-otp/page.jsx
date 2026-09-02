"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { GuestGate } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { OTP, OTPSlots } from "@/components/ui/input-otp";
import { setSession } from "@/lib/auth";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];
const RESEND_COOLDOWN_SECONDS = 60;

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();
  const uid = searchParams.get("uid") || "";

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const submittedRef = useRef("");

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

  // 60s resend countdown, mirroring the backend resend limiter.
  useEffect(() => {
    if (resendSecondsLeft <= 0) return undefined;
    const timer = setInterval(() => {
      setResendSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSecondsLeft]);

  async function submitOtp(code) {
    if (!uid) {
      setError("Missing verification context. Please sign up again.");
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, otp: code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error?.message || "Invalid code. Please try again.");
        setOtp("");
        submittedRef.current = "";
        return;
      }

      const session = data.data || data;
      setSession(session.user, session.accessToken);
      router.push("/app");
    } catch {
      setError("Network error. Please try again.");
      setOtp("");
      submittedRef.current = "";
    } finally {
      setIsSubmitting(false);
    }
  }

  // Auto-submit once all 6 digits are entered. The ref guard prevents double
  // submits while a request is in flight or when the parent re-renders.
  function handleValueChange(value) {
    setOtp(value);
    if (error) setError("");
    if (value.length === 6 && !isSubmitting && submittedRef.current !== value) {
      submittedRef.current = value;
      submitOtp(value);
    }
  }

  async function handleResend() {
    if (!uid || isResending || resendSecondsLeft > 0) return;
    setIsResending(true);
    setError("");

    try {
      const res = await fetch("/api/v1/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(
          data?.error?.message ||
            "Could not resend the code. Please try again.",
        );
        return;
      }

      setOtp("");
      submittedRef.current = "";
      setResendSecondsLeft(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <GuestGate>
      <AuthCard>
        <motion.div
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          animate="show"
          className="flex flex-col gap-5"
        >
          <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
            <span className="font-sans text-[12px] font-medium uppercase tracking-[0.05em] text-pewter">
              Email verification
            </span>
            <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
              Enter your code
            </h1>
            <p className="font-sans text-[14px] leading-relaxed text-pewter">
              We sent a 6-digit code to your email. It expires in 10 minutes.
            </p>
          </motion.div>

          <motion.div variants={itemVariants}>
            <OTP
              length={6}
              invalid={!!error}
              errorMessage={error}
              errorMessageClassName="font-sans text-[13px]"
              value={otp}
              disabled={isSubmitting}
              onValueChange={handleValueChange}
              containerClassName="py-2"
            >
              <OTPSlots />
            </OTP>
          </motion.div>

          <motion.div variants={itemVariants} className="flex flex-col gap-3">
            <Button
              type="button"
              onClick={handleResend}
              disabled={isResending || resendSecondsLeft > 0}
              className="kivo-cta h-auto w-full rounded-pills px-6 py-3 text-[15px] font-medium shadow-[0_10px_28px_-10px_rgba(0,0,0,0.6)] transition-[transform,filter] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110 active:scale-[0.98] disabled:opacity-60 focus-visible:ring-accent-blue/30"
            >
              {resendSecondsLeft > 0
                ? `Resend code in ${resendSecondsLeft}s`
                : isResending
                  ? "Sending…"
                  : "Resend code"}
            </Button>

            <p className="text-center font-sans text-[14px] text-pewter">
              Wrong email?{" "}
              <a
                href="/signup"
                className="font-medium text-electric-blue transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink-black"
              >
                Sign up again
              </a>
            </p>
          </motion.div>
        </motion.div>
      </AuthCard>
    </GuestGate>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-[12px] font-medium uppercase tracking-[0.05em] text-pewter">
                Email verification
              </span>
              <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
                Loading…
              </h1>
            </div>
            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-hairline border-t-eclipse-violet" />
          </div>
        </AuthCard>
      }
    >
      <VerifyOtpContent />
    </Suspense>
  );
}
