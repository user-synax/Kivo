"use client";
import { Crown, Plus, Trash, X } from "lucide-react";
import { useEffect, useState } from "react";
import { isPlusUser } from "@/lib/plus";

export function PollCreateModal({ open, onClose, onCreate, busy, me }) {
  const plus = isPlusUser(me);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [expiry, setExpiry] = useState("24h");

  useEffect(() => {
    if (open) {
      setQuestion("");
      setOptions(["", ""]);
      setAllowMultiple(false);
      setAnonymous(false);
      setExpiry("24h");
    }
  }, [open]);

  if (!open) return null;

  const addOpt = () => {
    const limit = plus ? 8 : 5;
    if (options.length >= limit) return;
    setOptions([...options, ""]);
  };
  const updateOpt = (i, v) => {
    const copy = [...options];
    copy[i] = v;
    setOptions(copy);
  };
  const removeOpt = (i) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  };
  const cleaned = options.map((o) => o.trim()).filter(Boolean);
  const hasDup =
    new Set(cleaned.map((o) => o.toLowerCase())).size !== cleaned.length;
  const canSubmit =
    question.trim().length > 0 &&
    question.trim().length <= 140 &&
    cleaned.length >= 2 &&
    !hasDup;

  const handleCreate = () => {
    let expiresAt = null;
    const now = Date.now();
    if (expiry === "1h")
      expiresAt = new Date(now + 60 * 60 * 1000).toISOString();
    if (expiry === "24h")
      expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    if (expiry === "3d")
      expiresAt = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();
    if (expiry === "7d")
      expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    onCreate({
      question: question.trim(),
      options: cleaned,
      allowMultiple,
      anonymous,
      expiresAt,
    });
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop dismiss
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: modal container stopPropagation */}
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create poll"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Create poll
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full hover:bg-[var(--hover)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Question · {question.length}/140
              </span>
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={140}
                placeholder="Ask a question"
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
              />
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                Options · {options.length}/{plus ? 8 : 5} {!plus && "(Plus: 8)"}
              </span>
              {options.map((opt, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: options reorder is add/remove only, index stable for edit
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={opt}
                    onChange={(e) => updateOpt(i, e.target.value)}
                    maxLength={60}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-sm outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeOpt(i)}
                    disabled={options.length <= 2}
                    className="flex size-8 items-center justify-center rounded-full hover:bg-[var(--hover)] disabled:opacity-30"
                    aria-label="Remove option"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {hasDup && (
                <p className="text-xs text-red-500">
                  Duplicate options not allowed
                </p>
              )}
              <button
                type="button"
                onClick={addOpt}
                disabled={options.length >= (plus ? 8 : 5)}
                className="flex items-center gap-1 self-start text-xs font-medium text-[var(--accent)] hover:underline disabled:opacity-40"
              >
                <Plus className="h-3 w-3" /> Add option
              </button>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3">
              <label className="flex items-center justify-between text-sm text-[var(--text-primary)]">
                <span className="flex items-center gap-1.5">
                  Allow multiple choices{" "}
                  {!plus && <Crown className="h-3 w-3 text-amber-500" />}
                </span>
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(e) => setAllowMultiple(e.target.checked)}
                  disabled={!plus}
                  className="accent-[var(--accent)]"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-[var(--text-primary)]">
                <span className="flex items-center gap-1.5">
                  Anonymous votes{" "}
                  {!plus && <Crown className="h-3 w-3 text-amber-500" />}
                </span>
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  disabled={!plus}
                  className="accent-[var(--accent)]"
                />
              </label>
              <label className="flex items-center justify-between text-sm text-[var(--text-primary)]">
                <span>Expires</span>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-sm outline-none"
                >
                  <option value="1h">1 hour</option>
                  <option value="24h">24 hours</option>
                  <option value="3d">3 days</option>
                  <option value="7d" disabled={!plus}>
                    7 days {!plus ? "(Plus)" : ""}
                  </option>
                  <option value="never">Never</option>
                </select>
              </label>
            </div>
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
            onClick={handleCreate}
            disabled={!canSubmit || busy}
            className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Creating..." : "Create poll"}
          </button>
        </div>
      </div>
    </div>
  );
}
