"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { GuestGate } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { setSession } from "@/lib/auth";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

function validate(fields) {
  const errors = {};

  if (!fields.identifier.trim()) {
    errors.identifier = "Email or username is required.";
  }
  if (!fields.password) {
    errors.password = "Password is required.";
  }

  return errors;
}

export default function LoginPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

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
    const fieldErrors = validate(formData);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    setServerError("");

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: formData.identifier.trim(),
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(
          data?.error?.message || "Invalid credentials. Please try again.",
        );
        return;
      }

      const session = data.data || data;
      setSession(session.user, session.accessToken);
      router.push("/app");
    } catch {
      setServerError("Network error. Please try again.");
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
              Welcome
            </span>
            <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
              Log in to Kivo
            </h1>
            <p className="font-sans text-[14px] leading-relaxed text-pewter">
              Pick up where your conversations left off.
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
              id="identifier"
              label="Email or Username"
              value={formData.identifier}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.identifier}
              autoComplete="username"
              required
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <AuthInput
              id="password"
              label="Password"
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.password}
              autoComplete="current-password"
              required
              isPassword
            />
          </motion.div>

          <motion.div variants={itemVariants} className="flex justify-end">
            <a
              href="/forgot-password"
              className="font-sans text-[13px] font-medium text-electric-blue transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink-black"
            >
              Forgot password?
            </a>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="kivo-cta h-auto w-full rounded-pills bg-ember-orange px-6 py-3 text-[15px] font-medium text-white shadow-none transition-[transform,filter,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-ember-orange hover:text-white disabled:opacity-60"
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
                  Logging in…
                </span>
              ) : (
                "Log In"
              )}
            </Button>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="text-center font-sans text-[14px] text-pewter"
          >
            Don&apos;t have an account?{" "}
            <a
              href="/signup"
              className="font-medium text-electric-blue transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink-black"
            >
              Sign up
            </a>
          </motion.p>
        </motion.form>
      </AuthCard>
    </GuestGate>
  );
}
