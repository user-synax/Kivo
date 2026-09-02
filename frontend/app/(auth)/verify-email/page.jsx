"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduce = useReducedMotion();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

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

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No verification link found. Please check your email for the correct link.");
      return;
    }

    fetch(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus("success");
          setMessage("Your email has been verified! You can now use all features of Kivo.");
        } else {
          setStatus("error");
          setMessage(data?.error?.message || "This verification link is invalid or has expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Network error. Please try again.");
      });
  }, [searchParams]);

  return (
    <AuthCard>
      <motion.div
        variants={containerVariants}
        initial={reduce ? false : "hidden"}
        animate="show"
        className="flex flex-col items-center gap-5 text-center"
      >
        <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
          <span className="font-sans text-[12px] font-medium uppercase tracking-[0.05em] text-pewter">
            Email Verification
          </span>
          <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
            {status === "loading"
              ? "Verifying…"
              : status === "success"
                ? "You're all set"
                : "Verification failed"}
          </h1>
        </motion.div>

        {status === "loading" && (
          <motion.div variants={itemVariants}>
            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-hairline border-t-eclipse-violet" />
          </motion.div>
        )}

        {status !== "loading" && (
          <motion.p
            variants={itemVariants}
            className="font-sans text-[14px] leading-relaxed text-pewter"
          >
            {message}
          </motion.p>
        )}

        <motion.div variants={itemVariants} className="mt-2">
          <button
            type="button"
            onClick={() => router.push(status === "success" ? "/app" : "/login")}
            className="font-sans text-[14px] font-medium text-electric-blue transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink-black"
          >
            {status === "success" ? "Go to app" : "Back to login"}
          </button>
        </motion.div>
      </motion.div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthCard>
          <div className="flex flex-col items-center gap-5 text-center">
            <div className="flex flex-col gap-1.5">
              <span className="font-sans text-[12px] font-medium uppercase tracking-[0.05em] text-pewter">
                Email Verification
              </span>
              <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
                Verifying…
              </h1>
            </div>
            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-hairline border-t-eclipse-violet" />
          </div>
        </AuthCard>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
