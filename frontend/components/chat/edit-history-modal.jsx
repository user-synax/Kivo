"use client";
import { History, X } from "lucide-react";
export function EditHistoryModal({ open, history, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" /> Edit history
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit history"
            className="rounded-full p-1 hover:bg-[var(--hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {!history || history.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No edit history</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {history.map((h, i) => (
              <div
                key={i}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3"
              >
                <p className="text-sm">{h.content}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {new Date(h.editedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
