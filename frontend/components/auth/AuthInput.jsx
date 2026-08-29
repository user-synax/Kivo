"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const EASE_SMOOTH_OUT = [0.22, 1, 0.36, 1];

export function AuthInput({
  id,
  label,
  type = "text",
  error,
  value,
  onChange,
  onBlur,
  autoComplete,
  required,
  isPassword,
  placeholder,
}) {
  const [visible, setVisible] = useState(false);
  const reduce = useReducedMotion();
  const inputType = isPassword ? (visible ? "text" : "password") : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="font-sans text-[14px] font-medium text-ink-black"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={inputType}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          autoComplete={autoComplete}
          required={required}
          placeholder={placeholder}
          className={[
            "w-full rounded-inputs border border-hairline bg-surface-2 px-3.5 py-3 font-sans text-[15px] text-ink",
            "placeholder:text-pewter",
            "outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            "focus:border-eclipse-violet/50 focus:ring-2 focus:ring-eclipse-violet/20",
            error
              ? "border-red-400/60 focus:border-red-400/70 focus:ring-red-400/20"
              : "border-stone/60",
            isPassword ? "pr-11" : "",
          ].join(" ")}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-pewter transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-ink-black"
            tabIndex={-1}
            aria-label={visible ? "Hide password" : "Show password"}
          >
            {visible ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
      {error && (
        <motion.p
          initial={reduce ? false : { opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE_SMOOTH_OUT }}
          className="font-sans text-[13px] leading-snug text-red-400"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}

export default AuthInput;
