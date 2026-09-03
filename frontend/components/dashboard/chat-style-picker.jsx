"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BUBBLE_STYLE_OPTIONS,
  WALLPAPER_OPTIONS,
  wallpaperCss,
} from "@/lib/chat-style";

// Wallpaper option swatch: a tiny chat-pane preview painted with the pattern
// (or the plain surface for "none"). Patterns use the theme's tokens, so the
// swatch reflects the active theme / Space palette colors automatically.
function WallpaperSwatch({ id }) {
  const css = wallpaperCss(id);
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-base)]"
      style={css}
    >
      {id === "none" ? (
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--bg-elevated)]" />
      ) : null}
    </div>
  );
}

export function WallpaperPicker({ value, onChange, allowInherit = false }) {
  const options = allowInherit
    ? [{ id: null, label: "Member's own", hint: "follow each member's choice" }, ...WALLPAPER_OPTIONS]
    : WALLPAPER_OPTIONS;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map((opt) => {
        const selected = value === opt.id;
        const isInherit = allowInherit && opt.id === null;
        return (
          <button
            key={String(opt.id)}
            type="button"
            aria-pressed={selected}
            aria-label={opt.label}
            onClick={() => onChange(opt.id)}
            className={cn(
              "group relative flex flex-col gap-1.5 rounded-lg border p-1.5 text-left transition-colors duration-150",
              selected
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--hover)]",
            )}
          >
            {selected && (
              <span className="absolute right-1 top-1 z-10 flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
            {isInherit ? (
              <div
                aria-hidden="true"
                className="flex h-9 w-full items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-base)]"
              >
                <span className="text-[10px] font-medium text-[var(--text-muted)]">
                  Auto
                </span>
              </div>
            ) : (
              <WallpaperSwatch id={opt.id} />
            )}
            <span className="block px-0.5 pb-0.5">
              <span className="block text-[11px] font-semibold leading-tight text-[var(--text-primary)]">
                {opt.label}
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight text-[var(--text-muted)]">
                {opt.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Mini sent + received bubbles previewing the three styles.
function BubbleStyleSwatch({ id }) {
  const bubbleCls =
    "px-2 py-1 text-[8px] font-semibold leading-none";
  return (
    <div
      aria-hidden="true"
      className="flex h-9 w-full flex-col justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-base)] px-2"
    >
      <span
        className={cn(bubbleCls, "self-start max-w-[70%]")}
        style={{
          borderRadius: id === "squared" ? 3 : 8,
          background: "var(--bubble-received)",
          color: "var(--text-primary)",
        }}
      >
        Hey
      </span>
      <span
        className={cn(bubbleCls, "self-end max-w-[70%]")}
        style={
          id === "outline"
            ? {
                borderRadius: 8,
                background: "transparent",
                border: "1.5px solid var(--accent)",
                color: "var(--accent)",
              }
            : {
                borderRadius: id === "squared" ? 3 : 8,
                background: "var(--bubble-sent)",
                color: "var(--bubble-sent-fg)",
              }
        }
      >
        Hi!
      </span>
    </div>
  );
}

export function BubbleStylePicker({ value, onChange, allowInherit = false }) {
  const options = allowInherit
    ? [{ id: null, label: "Member's own", hint: "follow each member's choice" }, ...BUBBLE_STYLE_OPTIONS]
    : BUBBLE_STYLE_OPTIONS;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((opt) => {
        const selected = value === opt.id;
        const isInherit = allowInherit && opt.id === null;
        return (
          <button
            key={String(opt.id)}
            type="button"
            aria-pressed={selected}
            aria-label={opt.label}
            onClick={() => onChange(opt.id)}
            className={cn(
              "group relative flex flex-col gap-1.5 rounded-lg border p-1.5 text-left transition-colors duration-150",
              selected
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--hover)]",
            )}
          >
            {selected && (
              <span className="absolute right-1 top-1 z-10 flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)]">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
            {isInherit ? (
              <div
                aria-hidden="true"
                className="flex h-9 w-full items-center justify-center rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-base)]"
              >
                <span className="text-[10px] font-medium text-[var(--text-muted)]">
                  Auto
                </span>
              </div>
            ) : (
              <BubbleStyleSwatch id={opt.id} />
            )}
            <span className="block px-0.5 pb-0.5">
              <span className="block text-[11px] font-semibold leading-tight text-[var(--text-primary)]">
                {opt.label}
              </span>
              <span className="mt-0.5 block text-[10px] leading-tight text-[var(--text-muted)]">
                {opt.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
