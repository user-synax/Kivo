"use client";
import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiPostForm } from "@/lib/api";
import { BANNER_OPTIONS } from "@/lib/banners";
import { SPACE_CATEGORIES } from "@/lib/space-categories";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none";

export function SpaceCreateModal({ open, onClose, onCreated }) {
  const [render, setRender] = useState(open);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [banner, setBanner] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setRender(true);
      const id = requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
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
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!render) return null;

  const handleAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError("Image must be under 4MB."); return; }
    setError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!name.trim()) { setError("Please name your space."); return; }
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("description", description.trim());
      form.append("category", category);
      if (banner) form.append("banner", banner);
      if (avatarFile) form.append("avatar", avatarFile);
      const space = await apiPostForm("/api/v1/spaces", form);
      onCreated?.(space);
      setName(""); setDescription(""); setBanner(""); setAvatarFile(null); setAvatarPreview(null);
      onClose();
    } catch (err) {
      setError(err?.message || "Could not create space");
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <button type="button" aria-label="Close" onClick={onClose} className={`t-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm ${show ? "is-open" : ""}`} />
      <div role="dialog" aria-modal="true" aria-label="Create space" className={`t-modal relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ${show ? "is-open" : "is-closing"}`}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">New Space</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div className="flex items-center gap-3.5">
            <Avatar name={name || "Space"} url={avatarPreview} size="lg" />
            <div className="min-w-0 flex-1">
              <input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="Space name" className={inputCls} />
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatar} className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]">{avatarPreview ? "Change icon" : "Add icon"}</button>
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">Description</span>
            <textarea value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} placeholder="What is this space about?" className={`${inputCls} min-h-[72px] resize-none`} />
          </div>
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {SPACE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>
          <div>
            <span className="mb-2 block text-[12px] font-medium text-[var(--text-muted)]">Banner</span>
            <div className="relative h-20 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
              {banner ? <img src={banner} alt="" aria-hidden="true" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-[var(--accent-blue)]/40 to-[#6a4cf5]/40" />}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <button type="button" onClick={() => setBanner("")} aria-pressed={!banner} className={`flex h-12 items-center justify-center rounded-lg border text-[11px] font-medium ${!banner ? "border-[var(--accent)] bg-[var(--hover)] text-[var(--text-primary)]" : "border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)]"}`}>None</button>
              {BANNER_OPTIONS.slice(0,7).map((opt) => {
                const active = banner === opt.url;
                return <button key={opt.id} type="button" onClick={() => setBanner(opt.url)} aria-pressed={active} className={`relative h-12 overflow-hidden rounded-lg border ${active ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"}`}><img src={opt.url} alt="" aria-hidden="true" className="h-full w-full object-cover" /></button>;
              })}
            </div>
          </div>
          {error && <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[12px] text-[var(--text-muted)]">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-primary)] hover:bg-[var(--hover)]">Cancel</button>
          <button type="button" onClick={submit} disabled={busy || !name.trim()} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-5 py-2.5 text-[13px] font-semibold text-[var(--on-accent)] hover:opacity-90 disabled:opacity-40"><Check className="h-4 w-4" /> {busy ? "Creating…" : "Create Space"}</button>
        </div>
      </div>
    </div>
  );
}
export default SpaceCreateModal;
