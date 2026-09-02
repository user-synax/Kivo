"use client";

import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { GuestGate } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

function validate(fields) {
  const errors = {};

  if (!fields.displayName.trim()) {
    errors.displayName = "Display name is required.";
  }
  if (!fields.username.trim()) {
    errors.username = "Username is required.";
  }
  if (!fields.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    errors.email = "Please enter a valid email address.";
  }
  if (!fields.password) {
    errors.password = "Password is required.";
  } else if (fields.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }
  if (!fields.confirmPassword) {
    errors.confirmPassword = "Please confirm your password.";
  } else if (fields.password !== fields.confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export default function SignUpPage() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [formData, setFormData] = useState({
    displayName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
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
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: formData.displayName.trim(),
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(
          data?.error?.message || "Something went wrong. Please try again.",
        );
        return;
      }

      // Registration no longer issues a session — redirect to OTP verification
      // with the new user id; /verify-otp issues the session on success.
      router.push(`/verify-otp?uid=${data.data.userId}`);
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
              Get started
            </span>
            <h1 className="font-goga text-[28px] font-medium leading-tight tracking-tight text-ink-black">
              Create your account
            </h1>
            <p className="font-sans text-[14px] leading-relaxed text-pewter">
              Join Kivo and start chatting.
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
              id="displayName"
              label="Display Name"
              value={formData.displayName}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.displayName}
              autoComplete="name"
              required
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <AuthInput
              id="username"
              label="Username"
              value={formData.username}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.username}
              autoComplete="username"
              required
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <AuthInput
              id="email"
              label="Email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={errors.email}
              autoComplete="email"
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
              className="kivo-cta mt-1 h-auto w-full rounded-pills px-6 py-3 text-[15px] font-medium shadow-[0_10px_28px_-10px_rgba(0,0,0,0.6)] transition-[transform,filter] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110 active:scale-[0.98] disabled:opacity-60 focus-visible:ring-accent-blue/30"
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
                  Creating account…
                </span>
              ) : (
                "Sign Up"
              )}
            </Button>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="text-center font-sans text-[14px] text-pewter"
          >
            Already have an account?{" "}
            <a
              href="/login"
              className="font-medium text-electric-blue transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink-black"
            >
              Log in
            </a>
          </motion.p>
        </motion.form>
      </AuthCard>
    </GuestGate>
  );
}
