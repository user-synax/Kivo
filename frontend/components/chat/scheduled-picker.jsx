"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, X } from "lucide-react";

function pad(n) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toTimeInputValue(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, day] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  if ([y, m, day, h, min].some((v) => Number.isNaN(v))) return null;
  return new Date(y, m - 1, day, h, min, 0, 0);
}

export function ScheduledPicker({ open, onClose, onConfirm, busy = false }) {
  const now = useMemo(() => new Date(), [open]);
  const minDate = useMemo(() => new Date(Date.now() + 60 * 1000), [open]);
  const maxDate = useMemo(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), [open]);

  const [dateStr, setDateStr] = useState("");
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    if (!open) return;
    const def = new Date(Date.now() + 60 * 60 * 1000);
    // clamp def between min and max
    if (def < minDate) def.setTime(minDate.getTime());
    if (def > maxDate) def.setTime(maxDate.getTime());
    setDateStr(toDateInputValue(def));
    setTimeStr(toTimeInputValue(def));
  }, [open, minDate, maxDate]);

  if (!open) return null;

  const selected = fromDateTime(dateStr, timeStr);
  const minIsoDate = toDateInputValue(minDate);
  const maxIsoDate = toDateInputValue(maxDate);

  let error = null;
  if (!selected) {
    error = "Pick a date and time";
  } else if (selected.getTime() < minDate.getTime()) {
    error = "Must be at least 1 minute in the future";
  } else if (selected.getTime() > maxDate.getTime()) {
    error = "Max 30 days ahead";
  }

  const canConfirm = Boolean(selected) && !error && !busy;

  const selectedLabel = selected
    ? selected.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Schedule message"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <Clock className="h-4 w-4" /> Schedule message
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full hover:bg-[var(--hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">
            Choose when to send. Minimum 1 minute from now, maximum 30 days.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
                <Calendar className="h-3 w-3" /> Date
              </span>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                min={minIsoDate}
                max={maxIsoDate}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1 text-xs font-medium text-[var(--text-muted)]">
                <Clock className="h-3 w-3" /> Time
              </span>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>
          </div>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">Selected time</p>
            <p className="mt-0.5 text-sm font-medium text-[var(--text-primary)]">{selectedLabel}</p>
            {error && <p className="mt-1 text-xs text-[var(--destructive)]">{error}</p>}
            {!error && selected && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {selected.toISOString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-1.5 text-sm hover:bg-[var(--hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (!selected || error) return;
              onConfirm(selected.toISOString());
            }}
            className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Scheduling..." : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ScheduledPicker;
