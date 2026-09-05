"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Generic destructive confirm dialog. Desktop: centered modal. Mobile:
// bottom sheet. Used for irreversible actions (delete conversation, ...).
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  busy = false,
  error = null,
  onConfirm,
  onClose,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={() => {
          if (!busy) onClose?.();
        }}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-t-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl sm:rounded-2xl">
        <div className="flex flex-col items-center gap-2 px-6 pb-2 pt-6 text-center">
          <span
            className="grid size-11 place-items-center rounded-full bg-[var(--destructive)]/10 text-[var(--destructive)]"
            aria-hidden="true"
          >
            <AlertTriangle className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          {description && (
            <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
              {description}
            </p>
          )}
        </div>
        {error && (
          <p className="px-6 pt-2 text-center text-[12px] text-[var(--destructive)]">
            {error}
          </p>
        )}
        <div className="flex gap-2 px-4 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={cn(
              "flex-1 rounded-full border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)]",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--destructive)] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90",
              "disabled:pointer-events-none disabled:opacity-60",
            )}
          >
            {busy && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
