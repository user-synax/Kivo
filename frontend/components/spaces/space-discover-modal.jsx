"use client";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { SPACE_CATEGORIES } from "@/lib/space-categories";
import { SpaceCard } from "./space-card";
import { useIsDesktop } from "@/lib/use-breakpoint";
import { motion, useReducedMotion } from "motion/react";

export function SpaceDiscoverModal({ open, onClose, onJoined }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [joiningId, setJoiningId] = useState(null);
  const isDesktop = useIsDesktop();
  const reduce = useReducedMotion();
  const EASE = [0.22, 1, 0.36, 1];

  const fetchSpaces = async (q, cat) => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (cat && cat !== "All") params.set("category", cat);
      const data = await apiGet(`/api/v1/spaces/discover?${params.toString()}`);
      setSpaces(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Could not load spaces");
      setSpaces([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!open) return;
    fetchSpaces(query, category);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchSpaces(query, category), 300);
    return () => clearTimeout(t);
  }, [query, category]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleJoin = async (spaceId) => {
    setJoiningId(spaceId);
    setError(null);
    try {
      const space = await apiPost(`/api/v1/spaces/${spaceId}/join`, {});
      onJoined?.(space);
      onClose();
    } catch (e) {
      setError(e?.message || "Could not join space");
    } finally { setJoiningId(null); }
  };

  const inner = (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 focus-within:border-[var(--accent)]">
          <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search public spaces…"
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
        </label>
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[{id:"All",label:"All",icon:"✨"}, ...SPACE_CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${category===c.id ? "bg-[var(--accent)] border-[var(--accent)] text-[var(--on-accent)]" : "border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"}`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}
      {loading ? (
        <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">Loading…</p>
      ) : spaces.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-[var(--text-muted)]">No public spaces found{query ? ` for “${query}”` : ""}.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {spaces.map((s) => (
            <SpaceCard
              key={s.id}
              space={s}
              onClick={() => handleJoin(s.id)}
              onJoin={() => handleJoin(s.id)}
              actionLabel={joiningId===s.id ? "Joining…" : "Join"}
            />
          ))}
        </div>
      )}
    </>
  );

  if (!isDesktop) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <motion.div role="dialog" aria-modal="true" aria-label="Discover spaces" initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }} className="relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]">
          <div className="mx-auto mt-3 h-1.5 w-9 shrink-0 rounded-full bg-[var(--border)]" aria-hidden="true" />
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Discover Spaces</h2>
              <p className="text-[12px] text-[var(--text-muted)]">Find and join public spaces</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-[max(env(safe-area-inset-bottom),1rem)]">{inner}</div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label="Discover spaces" className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Discover Spaces</h2>
            <p className="text-[12px] text-[var(--text-muted)]">Find and join public spaces</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">{inner}</div>
      </div>
    </div>
  );
}
export default SpaceDiscoverModal;
