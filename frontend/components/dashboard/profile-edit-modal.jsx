"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiPatch, apiUpload, apiDelete } from "@/lib/api";
import { getSession, getToken, setSession } from "@/lib/auth";
import { AVATAR_STYLES } from "@/lib/avatar-styles";

function Field({ label, hint, children }) {
  return (
    <div className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] text-[var(--text-muted)]">
          {hint}
        </span>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] focus:border-[var(--accent)] focus:outline-none";

export function ProfileEditModal({ open, currentUser, onClose, onSaved }) {
  const router = useRouter();
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState("");
  const [avatarStyle, setAvatarStyle] = useState("default");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Avatar / DP upload.
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileRef = useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be under 4MB.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const updated = await apiUpload("/api/v1/users/me/avatar", form);
      // Persist + propagate (drives sidebar/profile/chat avatars everywhere).
      setSession(updated, getToken());
      onSaved?.(updated);
      setPreviewUrl(null);
    } catch (err) {
      setError(err?.message || "Could not upload photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    setError(null);
    setUploading(true);
    try {
      const updated = await apiDelete("/api/v1/users/me/avatar");
      setSession(updated, getToken());
      onSaved?.(updated);
      setPreviewUrl(null);
    } catch (err) {
      setError(err?.message || "Could not remove photo");
    } finally {
      setUploading(false);
    }
  };

  // Mount/unmount with a one-frame delay so the open/close transitions play.
  useEffect(() => {
    if (open) {
      const me = currentUser || getSession();
      setDisplayName(me?.displayName || "");
      setUsername(me?.username || "");
      setBio(me?.bio || "");
      setStatus(me?.status || "");
      setAvatarStyle(me?.avatarStyle || "default");
      setError(null);
      setRender(true);
      const id = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = setTimeout(() => setRender(false), 160);
    return () => clearTimeout(t);
  }, [open, currentUser]);

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

  const close = () => onClose();

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiPatch("/api/v1/users/me", {
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        status: status.trim(),
        avatarStyle,
      });
      // Persist the refreshed user object (drives the sidebar avatar + session).
      setSession(updated, getToken());
      onSaved?.(updated);
      onClose();
    } catch (err) {
      setError(err?.message || "Could not save changes");
    } finally {
      setSaving(false);
    }
  };

  const openFullProfile = () => {
    onClose();
    router.push("/app/profile");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className={`t-modal-backdrop absolute inset-0 bg-black/60 ${
          shown ? "is-open" : ""
        }`}
        onClick={close}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit profile"
        className={`t-modal relative z-10 m-3 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-md)] ${
          shown ? "is-open" : ""
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <Avatar
              name={displayName || currentUser?.displayName || "?"}
              avatarStyle={avatarStyle}
              url={previewUrl || currentUser?.avatarUrl}
              size="sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                {displayName || currentUser?.displayName || "Profile"}
              </p>
              <p className="truncate text-[12px] text-[var(--text-muted)]">
                Edit profile &amp; avatar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-5">
          <Field label="Display name">
            <input
              className={inputCls}
              value={displayName}
              maxLength={50}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </Field>

          <Field label="Username" hint="Letters, numbers and underscores.">
            <input
              className={inputCls}
              value={username}
              maxLength={30}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
            />
          </Field>

          <Field label="Status" hint="A short line shown under your name.">
            <input
              className={inputCls}
              value={status}
              maxLength={60}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="e.g. Available"
            />
          </Field>

          <Field label="Bio">
            <textarea
              className={`${inputCls} min-h-[72px] resize-none`}
              value={bio}
              maxLength={280}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A little about you"
            />
          </Field>

          {/* Display picture upload */}
          <div>
            <span className="mb-2 block text-[12px] font-medium text-[var(--text-muted)]">
              Profile photo
            </span>
            <div className="flex items-center gap-4">
              <Avatar
                name={displayName || currentUser?.displayName || "?"}
                avatarStyle={avatarStyle}
                url={previewUrl || currentUser?.avatarUrl}
                size="lg"
              />
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--text-primary)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] disabled:opacity-50"
                >
                  {uploading
                    ? "Uploading…"
                    : currentUser?.avatarUrl
                      ? "Change photo"
                      : "Upload photo"}
                </button>
                {currentUser?.avatarUrl ? (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={uploading}
                    className="text-[12px] text-[var(--text-muted)] transition-colors duration-200 hover:text-[var(--text-primary)] disabled:opacity-50"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <span className="mt-1.5 block text-[11px] text-[var(--text-muted)]">
              JPG, PNG, WebP or GIF. Stored privately, up to 4MB.
            </span>
          </div>

          {/* Avatar customization */}
          <div>
            <span className="mb-2 block text-[12px] font-medium text-[var(--text-muted)]">
              Avatar style
            </span>
            <div className="grid grid-cols-5 gap-3">
              {AVATAR_STYLES.map((preset) => {
                const active = preset.id === avatarStyle;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAvatarStyle(preset.id)}
                    aria-pressed={active}
                    title={preset.label}
                    className={`group flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      active
                        ? "border-[var(--accent)] bg-[var(--hover)]"
                        : "border-[var(--border)] hover:bg-[var(--hover)]"
                    }`}
                  >
                    <span className="relative">
                      <Avatar
                        name={displayName || currentUser?.displayName || "?"}
                        avatarStyle={preset.id}
                        size="sm"
                      />
                      {active && (
                        <span className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] ring-2 ring-[var(--bg-surface)]">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-8">
          <button
            type="button"
            onClick={openFullProfile}
            className="text-[13px] text-[var(--text-muted)] hover:cursor-pointer transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--text-primary)]"
          >
            View full profile
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-[var(--border)] px-12 hover:cursor-pointer py-2 text-[13px] font-medium text-[var(--text-primary)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-[var(--accent)] px-12 hover:cursor-pointer py-2 text-[13px] font-medium text-[var(--on-accent)] transition-[filter,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:brightness-110 active:brightness-95 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileEditModal;
