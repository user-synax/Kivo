"use client";
import { useEffect, useRef, useState } from "react";
import { Crown, Trash2, Upload, Smile } from "lucide-react";
import { apiDelete, apiGet, apiPostForm } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { useSocket } from "@/components/socket-provider";
import { getCustomEmojis, invalidateEmojiCache } from "@/lib/custom-emoji";
import Link from "next/link";

function isPlusUser(user) {
  if (!user || user.plan !== "plus") return false;
  const exp = user.planExpiresAt ? new Date(user.planExpiresAt).getTime() : null;
  if (exp != null && Number.isFinite(exp) && exp < Date.now()) return false;
  return true;
}

export function SpaceEmojiSection({ space, canEdit }) {
  const { socket } = useSocket();
  const currentUser = getSession();
  const isPlus = isPlusUser(currentUser);
  const canManage = canEdit && isPlus;
  const [emojis, setEmojis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const spaceId = space?.id;

  const fetchEmojis = async () => {
    if (!spaceId) return;
    setLoading(true);
    setError(null);
    try {
      // Use lib's cache-aware fetch; then filter to just this space's (not global) for count? But we show all visible (space + global) ? Spec says per-Space count x/100, so only space-owned count
      // For display we show space-owned + global? Let's show all that picker would show, but count is space-owned.
      const list = await getCustomEmojis(spaceId);
      // getCustomEmojis for spaceId returns merged (global+space) per backend? Our lib's getCustomEmojis for spaceId currently does merged? Actually getCustomEmojis(spaceId) fetches ?spaceId= which backend returns space+global. So list is merged.
      // For admin management we want only space-owned for delete control, but showing global as read-only is confusing. Let's filter to space-owned for management view.
      const spaceOnly = Array.isArray(list) ? list.filter((e) => e.spaceId === spaceId) : [];
      setEmojis(spaceOnly);
    } catch (e) {
      setError(e?.message || "Could not load emoji");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmojis();
  }, [spaceId]);

  useEffect(() => {
    if (!socket || !spaceId) return;
    const onNew = (emoji) => {
      if (emoji?.spaceId === spaceId) {
        invalidateEmojiCache(spaceId);
        fetchEmojis();
      }
    };
    const onDel = (payload) => {
      if (payload?.spaceId === spaceId) {
        invalidateEmojiCache(spaceId);
        setEmojis((prev) => prev.filter((e) => e.id !== payload.id));
      }
    };
    socket.on("emoji:new", onNew);
    socket.on("emoji:deleted", onDel);
    return () => {
      socket.off("emoji:new", onNew);
      socket.off("emoji:deleted", onDel);
    };
  }, [socket, spaceId]);

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
    if (!isPlus) {
      setError("Kivo Plus required to create Space emoji");
      return;
    }
    if (!canEdit) {
      setError("Only Space admins can upload");
      return;
    }
    if (!trimmed || trimmed.length < 2 || trimmed.length > 32 || !/^[a-z0-9_]+$/.test(trimmed)) {
      setError("Name must be 2–32 chars: lowercase, numbers and underscores only");
      return;
    }
    if (!file) {
      setError("Choose an image (png, jpeg, webp, gif ≤2 MB)");
      return;
    }
    if (emojis.length >= 100) {
      setError("Space emoji limit reached (100)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("name", trimmed);
      form.append("spaceId", spaceId);
      // Use fetch directly to avoid JSON wrapper; rely on apiPostForm path but we need raw fetch with auth handled.
      // Reuse apiPostForm helper via dynamic import: it does auth retry.
      const created = await apiPostForm("/api/v1/emoji", form);
      // Optimistically add
      if (created?.id) {
        setEmojis((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        await invalidateEmojiCache(spaceId);
      } else {
        await fetchEmojis();
      }
      setName("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(e?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (emoji) => {
    if (!confirm(`Delete :${emoji.name}: ?`)) return;
    try {
      await apiDelete(`/api/v1/emoji/${emoji.id}`);
      setEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
      await invalidateEmojiCache(spaceId);
    } catch (e) {
      setError(e?.message || "Could not delete");
    }
  };

  if (!spaceId) return null;

  const count = emojis.length;
  const limit = 100;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smile className="h-4 w-4 text-[var(--text-muted)]" />
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">Custom emoji</h3>
          <span className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
            {count}/{limit}
          </span>
        </div>
      </div>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
        Upload tiny images (≤2 MB) — they’re auto-resized to 128px WebP and appear as :name: in messages. Space members can use them; admins manage them.
      </p>

      {error && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          {error}
        </p>
      )}

      {!isPlus ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-600" />
            <span className="text-[12px] font-semibold text-amber-900 dark:text-amber-100">Plus required</span>
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">Plus</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">Space emoji is a Plus perk. Upgrade to create and manage `:name:` emoji for this Space.</p>
          <Link href="/plus" className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-700">
            <Crown className="h-3 w-3" /> Upgrade to Plus
          </Link>
        </div>
      ) : canManage ? (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">Name (2–32, a-z 0-9 _)</label>
              <div className="flex items-center gap-1">
                <span className="text-[13px] text-[var(--text-muted)]">:</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  maxLength={32}
                  placeholder="party_parrot"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <span className="text-[13px] text-[var(--text-muted)]">:</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">Image (png/jpeg/webp/gif)</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1.5 text-xs text-[var(--text-primary)] file:mr-2 file:rounded-full file:border-0 file:bg-[var(--accent)] file:px-3 file:py-1 file:text-xs file:font-medium file:text-white"
              />
            </div>
          </div>

          {preview && (
            <div className="flex items-center gap-3">
              <img src={preview} alt="preview" width={32} height={32} className="size-8 rounded border border-[var(--border)] bg-white object-contain" />
              <span className="text-xs text-[var(--text-muted)]">Preview 22px inline • 28px picker • {file?.size ? `${(file.size/1024).toFixed(1)} KB` : ""}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={busy || !name.trim() || !file}
            className="inline-flex items-center gap-1.5 self-start rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--on-accent)] disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Upload emoji"}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">Only Space admins can upload or remove custom emoji.</p>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="py-4 text-center text-xs text-[var(--text-muted)]">Loading…</p>
        ) : emojis.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-6 text-center">
            <Smile className="h-6 w-6 text-[var(--text-muted)]" />
            <p className="text-xs text-[var(--text-muted)]">No custom emoji yet. Upload one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {emojis.map((e) => (
              <div key={e.id} className="flex flex-col items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2">
                <img src={e.url} alt={`:${e.name}:`} width={28} height={28} loading="lazy" decoding="async" className="size-7 object-contain" />
                <span className="max-w-full truncate text-[11px] font-medium text-[var(--text-primary)]">:{e.name}:</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDelete(e)}
                    className="mt-1 inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-red-600"
                    title="Delete emoji"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
export default SpaceEmojiSection;
