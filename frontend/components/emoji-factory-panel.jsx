"use client";
import { useEffect, useRef, useState } from "react";
import { Crown, Smile, Trash2, Upload, X } from "lucide-react";
import { apiDelete, apiPostForm } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { useSocket } from "@/components/socket-provider";
import { getPersonalEmojis, invalidateAllEmojiCaches, invalidatePersonalCache } from "@/lib/custom-emoji";
import { useIsDesktop } from "@/lib/use-breakpoint";
import Link from "next/link";

function isPlusUser(user) {
  if (!user || user.plan !== "plus") return false;
  const exp = user.planExpiresAt ? new Date(user.planExpiresAt).getTime() : null;
  if (exp != null && Number.isFinite(exp) && exp < Date.now()) return false;
  return true;
}

export function EmojiFactoryPanel({ onClose }) {
  const currentUser = getSession();
  const userId = currentUser?.id;
  const plus = isPlusUser(currentUser);
  const isDesktop = useIsDesktop();
  const { socket } = useSocket();
  const [emojis, setEmojis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const fetchEmojis = async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getPersonalEmojis(userId);
      setEmojis(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.message || "Could not load emoji");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmojis();
  }, [userId]);

  useEffect(() => {
    if (!socket || !userId) return;
    const onNew = (emoji) => {
      if (emoji?.ownerId === userId) {
        invalidatePersonalCache(userId);
        invalidateAllEmojiCaches();
        fetchEmojis();
      } else if (emoji?.ownerId) {
        // someone else's personal - invalidate global caches so renderer can see it
        invalidateAllEmojiCaches();
      }
    };
    const onDel = (payload) => {
      if (payload?.ownerId === userId) {
        setEmojis((prev) => prev.filter((e) => e.id !== payload.id));
        invalidatePersonalCache(userId);
        invalidateAllEmojiCaches();
      } else if (payload?.ownerId) {
        invalidateAllEmojiCaches();
      }
    };
    socket.on("emoji:new", onNew);
    socket.on("emoji:deleted", onDel);
    return () => {
      socket.off("emoji:new", onNew);
      socket.off("emoji:deleted", onDel);
    };
  }, [socket, userId]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleUpload = async () => {
    const trimmed = name.trim().toLowerCase();
    if (!plus) {
      setError("Kivo Plus required to create emoji");
      return;
    }
    if (!trimmed || trimmed.length < 2 || trimmed.length > 32 || !/^[a-z0-9_]+$/.test(trimmed)) {
      setError("Name must be 2–32 chars: lowercase, numbers and underscores only");
      return;
    }
    if (!file) {
      setError("Choose an image (png, jpeg, webp, gif ≤256 KB)");
      return;
    }
    if (emojis.length >= 50) {
      setError("Personal emoji limit reached (50) — delete one to add more");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("name", trimmed);
      form.append("personal", "true");
      const created = await apiPostForm("/api/v1/emoji", form);
      if (created?.id) {
        setEmojis((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        await invalidatePersonalCache(userId);
        await invalidateAllEmojiCaches();
      } else {
        await fetchEmojis();
      }
      setName("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      const msg = e?.message || "Upload failed";
      if (e?.code === "PLUS_REQUIRED") {
        setError("Kivo Plus required — upgrade to create custom emoji");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (emoji) => {
    if (!confirm(`Delete :${emoji.name}: ?`)) return;
    try {
      await apiDelete(`/api/v1/emoji/${emoji.id}`);
      setEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
      await invalidatePersonalCache(userId);
      await invalidateAllEmojiCaches();
    } catch (e) {
      setError(e?.message || "Could not delete");
    }
  };

  return (
    <div className="flex h-full flex-col bg-[var(--bg-elevated)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">
            <Smile className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Emoji Factory</h2>
            <p className="text-[11px] text-[var(--text-muted)]">Plus-only • {emojis.length}/50 personal</p>
          </div>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="t-scroll flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
        {!plus ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Plus required</h3>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-amber-800 dark:text-amber-200">
              Custom emoji is a Plus perk. Create your own `:name:` emoji and use it everywhere — DMs, groups, and Space channels. Your personal library travels with your account.
            </p>
            <Link href="/plus" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700">
              <Crown className="h-4 w-4" /> Upgrade to Plus
            </Link>
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-white p-3 dark:bg-[var(--bg-surface)]">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Preview (read-only)</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">You can still see global and Space emoji in the picker — you just can’t create personal ones until you’re Plus.</p>
            </div>
          </div>
        ) : null}

        {error && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            {error}
          </p>
        )}

        {plus && (
          <div className="mt-4 flex flex-col gap-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-4 sm:p-5">
            <div>
              <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Create personal emoji</h3>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">≤256 KB • auto-resized to 128px WebP/GIF • usable everywhere via `:name:`</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">Name</label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-[var(--text-muted)]">:</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    maxLength={32}
                    placeholder="my_blob"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  />
                  <span className="text-[13px] text-[var(--text-muted)]">:</span>
                </div>
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">2–32 chars, a–z 0–9 _</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">Image</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2 py-2 text-xs text-[var(--text-primary)] file:mr-2 file:rounded-full file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                />
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">png, jpeg, webp, gif</p>
              </div>
            </div>
            {preview && (
              <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
                <img src={preview} alt="preview" width={48} height={48} className="size-12 rounded-lg border border-[var(--border)] bg-white object-contain p-1" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[var(--text-primary)]">Preview</p>
                  <p className="text-[11px] text-[var(--text-muted)]">22px inline • 28px picker • {file?.size ? `${(file.size/1024).toFixed(1)} KB` : ""} • :{name || "name"}:</p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleUpload}
              disabled={busy || !name.trim() || !file}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto sm:self-start"
            >
              <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Create emoji"}
            </button>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Your personal emojis • {emojis.length}/50</h3>
            {emojis.length > 0 && <span className="text-[11px] text-[var(--text-muted)]">{emojis.length} emojis</span>}
          </div>
          {loading ? (
            <p className="py-8 text-center text-sm text-[var(--text-muted)]">Loading…</p>
          ) : emojis.length === 0 ? (
            <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-6 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[var(--bg-elevated)]">
                <Smile className="h-6 w-6 text-[var(--text-muted)]" />
              </div>
              <p className="text-sm font-medium text-[var(--text-primary)]">{plus ? "No personal emoji yet" : "No personal emoji yet — upgrade to Plus"}</p>
              <p className="max-w-sm text-xs leading-relaxed text-[var(--text-muted)]">{plus ? "Create one above and use :name: anywhere — DMs, groups, Space channels." : "Upgrade to Plus to create your own :name: emoji."}</p>
              <p className="text-[11px] text-[var(--text-muted)]">Tip: type <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[var(--text-primary)]">:name:</span> in any chat or use the picker’s Custom tab.</p>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {emojis.map((e) => (
                <div key={e.id} className="group flex flex-col items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-colors hover:border-[var(--accent)]/30 hover:bg-[var(--bg-elevated)]">
                  <div className="flex size-14 items-center justify-center rounded-xl bg-white p-2 shadow-sm">
                    <img src={e.url} alt={`:${e.name}:`} width={32} height={32} loading="lazy" decoding="async" className="max-h-8 max-w-8 object-contain" />
                  </div>
                  <span className="w-full truncate text-center text-xs font-medium text-[var(--text-primary)]" title={`:${e.name}:`}>:{e.name}:</span>
                  <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">{e.animated ? "animated" : "static"}</span>
                  {plus && (
                    <button
                      type="button"
                      onClick={() => handleDelete(e)}
                      className="mt-1 inline-flex w-full items-center justify-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs font-semibold text-[var(--text-primary)]">How it works</p>
            <ul className="mt-2 grid gap-2 text-xs leading-relaxed text-[var(--text-muted)] sm:grid-cols-2">
              <li className="flex gap-2"><span className="text-[var(--accent)]">•</span><span>Plus-only, tied to your account — visible everywhere.</span></li>
              <li className="flex gap-2"><span className="text-[var(--accent)]">•</span><span>Use <span className="rounded bg-[var(--bg-elevated)] px-1 font-mono text-[var(--text-primary)]">:name:</span> in any chat.</span></li>
              <li className="flex gap-2"><span className="text-[var(--accent)]">•</span><span>Zero network in render, IndexedDB cached.</span></li>
              <li className="flex gap-2"><span className="text-[var(--accent)]">•</span><span>Reactions support <span className="font-mono">custom:&lt;id&gt;</span></span></li>
            </ul>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
export default EmojiFactoryPanel;
