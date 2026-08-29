"use client";

import { Check, Search, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiGet, apiPostForm } from "@/lib/api";
import { participantName } from "@/lib/chat";

const btnPrimary =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-40";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-[var(--accent)] focus:outline-none";

export function GroupCreateModal({ open, onClose, onCreated }) {
  const [render, setRender] = useState(open);
  const [show, setShow] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setRender(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setShow(true)),
      );
      return () => cancelAnimationFrame(id);
    }
    if (render) {
      setShow(false);
      const id = setTimeout(() => setRender(false), 150);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [open, render]);

  useEffect(() => {
    if (!open) return;
    apiGet("/api/v1/friends")
      .then((d) => setFriends(d || []))
      .catch(() => setFriends([]));
    return undefined;
  }, [open]);

  // Escape to close.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!render) return null;

  const filtered = friends.filter((f) =>
    participantName(f).toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selectedFriends = friends.filter((f) => selected.has(f.id));

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be under 4MB.");
      return;
    }
    setError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please name your group.");
      return;
    }
    if (selected.size < 2) {
      setError("Select at least 2 friends.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("name", trimmed);
      form.append("participantIds", JSON.stringify([...selected]));
      if (avatarFile) form.append("avatar", avatarFile);
      const conv = await apiPostForm("/api/v1/conversations/group", form);
      onCreated?.(conv);
    } catch (err) {
      setError(err?.message || "Could not create group");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`t-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm ${show ? "is-open" : ""}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create group"
        className={`t-modal relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ${
          show ? "is-open" : "is-closing"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            New group
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* Name + avatar */}
          <div className="flex items-center gap-3.5">
            <Avatar
              name={name || "Group"}
              avatarStyle={null}
              url={avatarPreview}
              size="lg"
            />
            <div className="min-w-0 flex-1">
              <input
                value={name}
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                aria-label="Group name"
                className={inputCls}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleAvatar}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 text-[12px] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                {avatarPreview ? "Change photo" : "Add photo"}
              </button>
            </div>
          </div>

          {/* Selected members */}
          {selectedFriends.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedFriends.map((f) => (
                <span
                  key={f.id}
                  className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] py-1 pl-1.5 pr-2 text-[12px] text-[var(--text-primary)]"
                >
                  <Avatar
                    name={participantName(f)}
                    avatarStyle={f.avatarStyle}
                    url={f.avatarUrl}
                    size="sm"
                  />
                  {participantName(f)}
                  <button
                    type="button"
                    onClick={() => toggle(f.id)}
                    aria-label={`Remove ${participantName(f)}`}
                    className="ml-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Friend search */}
          <div className="mt-5">
            <label className="flex items-center gap-2 rounded-[var(--radius-inputs)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 transition-colors duration-200 focus-within:border-[var(--accent)]">
              <Search
                className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Select friends…"
                aria-label="Search friends"
                className="w-full min-w-0 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
            </label>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {filtered.length === 0 && (
              <p className="px-1 py-6 text-center text-[13px] text-[var(--text-muted)]">
                No friends match "{query.trim()}".
              </p>
            )}
            {filtered.map((f) => {
              const picked = selected.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => toggle(f.id)}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[var(--hover)]"
                >
                  <Avatar
                    name={participantName(f)}
                    avatarStyle={f.avatarStyle}
                    url={f.avatarUrl}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                    {participantName(f)}
                  </span>
                  <span
                    className={`flex size-6 items-center justify-center rounded-full border ${
                      picked
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                        : "border-[var(--border)] text-transparent"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4">
          <p className="text-[12px] text-[var(--text-muted)]">
            {selected.size} selected
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={busy || selected.size < 2 || !name.trim()}
            className={btnPrimary}
          >
            <Users className="h-3.5 w-3.5" strokeWidth={2} />
            Create group
          </button>
        </div>
      </div>
    </div>
  );
}

export default GroupCreateModal;
