"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, X, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries";

const EASE = [0.22, 1, 0.36, 1];

/* ── Flag image via flagcdn.com — no next/image domain config needed ────── */
function Flag({ code }) {
  if (!code) return null;
  return (
    <img
      src={`https://flagcdn.com/w160/${code.toLowerCase()}.png`}
      alt={code}
      className="h-5 w-5 shrink-0 rounded-full object-cover"
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

/* ── CountryPicker ─────────────────────────────────────────────────────────
   Trigger button + modal dialog with search-filtered country list.
   value: { name: string, code: string } | null
   onChange: (country: { name: string, code: string } | null) => void
   ──────────────────────────────────────────────────────────────────────── */
export function CountryPicker({ value, onChange, title = "Select your country" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return COUNTRIES;
    const q = search.toLowerCase();
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [search]);

  const handleSelect = (country) => {
    onChange(country);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors duration-200",
          "border-[var(--border)] bg-[var(--bg-base)]",
          "hover:bg-[var(--hover)]",
          "focus:border-[var(--accent)] focus:outline-none",
        )}
      >
        {value?.code ? (
          <>
            <Flag code={value.code} />
            <span className="text-[var(--text-primary)]">{value.name}</span>
          </>
        ) : (
          <span className="text-[var(--text-muted)]">No country selected</span>
        )}
        <ChevronDown className="ml-auto h-3.5 w-3.5 text-[var(--text-muted)]" />
      </button>

      {/* ── Dialog ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop — matches t-modal-backdrop pattern */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              onClick={() => {
                setIsOpen(false);
                setSearch("");
              }}
              className="fixed inset-0 z-[998] bg-black/60 backdrop-blur-[2px]"
              aria-hidden="true"
            />

            {/* Dialog container — centered, pointer-events passthrough */}
            <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
                transition={{ duration: 0.25, ease: EASE }}
                className={cn(
                  "pointer-events-auto flex h-fit max-h-[520px] w-full max-w-[400px] flex-col overflow-hidden",
                  "rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)]",
                  "shadow-[var(--shadow-lg)] sm:h-[520px]",
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <h2 className="text-[14px] font-medium text-[var(--text-primary)]">
                    {title}
                  </h2>
                  <button
                    type="button"
                    title="Close"
                    onClick={() => {
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Search */}
                <div className="px-5 pb-3">
                  <div className="relative flex items-center">
                    <Search
                      size={15}
                      className="absolute left-3 text-[var(--text-muted)]"
                    />
                    <input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search countries..."
                      className={cn(
                        "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] py-2.5 pr-10 pl-9",
                        "text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                        "transition-colors duration-200 focus:border-[var(--accent)] focus:outline-none",
                      )}
                    />
                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Country list */}
                <div className="t-scroll flex-1 overflow-y-auto pb-2">
                  {filtered.length === 0 ? (
                    <div className="flex h-[150px] items-center justify-center text-[13px] text-[var(--text-muted)]">
                      No countries found
                    </div>
                  ) : (
                    filtered.map((country) => {
                      const selected = value?.code === country.code;
                      return (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => handleSelect(country)}
                          className={cn(
                            "group flex w-full items-center justify-between px-5 py-2.5 transition-colors duration-150",
                            selected
                              ? "bg-[var(--hover)]"
                              : "hover:bg-[var(--hover)]/50",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Flag code={country.code} />
                            <span
                              className={cn(
                                "text-[13px] transition-colors duration-150",
                                selected
                                  ? "font-medium text-[var(--text-primary)]"
                                  : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]",
                              )}
                            >
                              {country.name}
                            </span>
                          </div>
                          {selected && (
                            <Check className="h-4 w-4 text-[var(--text-primary)]" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default CountryPicker;
