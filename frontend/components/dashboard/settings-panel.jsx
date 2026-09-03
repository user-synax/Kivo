"use client";

import {
  Bell,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Palette,
  Play,
  ShieldBan,
  Trash2,
  Undo2,
  UserCheck,
  Volume2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Switch } from "@/components/ui/switch";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { getSession, getToken, setSession } from "@/lib/auth";
import {
  getSoundPrefs,
  previewCue,
  setSoundPrefs,
  setSoundsEnabled,
} from "@/lib/sound";
import { ACCENT_PRESETS, TINT_PRESETS } from "@/lib/theme";
import { Avatar } from "./avatar";
import { TwoFactorSection } from "./two-factor-section";

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)]">
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
              {description}
            </p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}

// Small round color swatch used by the studio rows (presets + neutral).
// Exported so the per-Space palette editor reuses the same visual language.
export function ColorDot({ color, selected, label, onClick }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={`flex size-7 shrink-0 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 ${
        selected
          ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-surface)]"
          : "ring-1 ring-[var(--border)]"
      }`}
      style={
        color ? { background: color } : { background: "var(--bg-elevated)" }
      }
    >
      {!color && (
        <span className="size-2 rounded-full bg-[var(--text-muted)]" />
      )}
    </button>
  );
}

// Native color input styled as a circular swatch — the "anything goes" option
// at the end of each preset row.
export function ColorInput({ value, label, onChange, badge = false }) {
  return (
    <label
      title={label}
      aria-label={label}
      className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-[var(--border)] transition-transform duration-150 hover:scale-110"
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
      <span className="size-full rounded-full" style={{ background: value }} />
      {badge && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-[var(--bg-surface)]/80 px-1 text-[9px] font-bold leading-4 text-[var(--text-muted)]">
            +
          </span>
        </span>
      )}
    </label>
  );
}

function ThemeStudio() {
  const { theme, custom, preview, previewColors, applyCustom } = useTheme();
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [error, setError] = useState(null);

  // The draft currently applied (live) vs. what is persisted on the account.
  const active = preview ?? custom;
  const baseline = custom;
  const draft = {
    accent: active?.accent || null,
    tint: active?.tint || null,
  };
  const baseAccent = theme.colors.accent;

  const touch = (partial) => previewColors({ ...draft, ...partial });

  const hasChanges =
    (draft.accent?.toLowerCase() || null) !==
      (baseline?.accent?.toLowerCase() || null) ||
    (draft.tint?.toLowerCase() || null) !==
      (baseline?.tint?.toLowerCase() || null);

  const handleSave = async () => {
    if (!hasChanges) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiPatch("/api/v1/users/me", {
        appearance: { accent: draft.accent, tint: draft.tint },
      });
      applyCustom(updated.appearance);
      setSession(updated, getToken());
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1600);
    } catch (err) {
      setError(err?.message || "Could not save your colors");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiPatch("/api/v1/users/me", {
        appearance: { accent: null, tint: null },
      });
      applyCustom(null);
      setSession(updated, getToken());
    } catch (err) {
      setError(err?.message || "Could not reset your colors");
    } finally {
      setBusy(false);
    }
  };

  const accentSelected = (hex) =>
    Boolean(draft.accent) && draft.accent.toLowerCase() === hex.toLowerCase();
  const tintSelected = (hex) =>
    Boolean(draft.tint) && draft.tint.toLowerCase() === hex.toLowerCase();

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-[12px] font-semibold text-[var(--text-primary)]">
            Theme studio
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
            Recolor the active theme with your own accent &amp; canvas tone.
            Changes apply live and are saved to your account.
          </p>
        </div>
        {baseline && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">
            <Check className="h-3 w-3" />
            Custom colors on
          </span>
        )}
      </div>

      {/* Accent */}
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-medium text-[var(--text-primary)]">
          Accent
        </p>
        <p className="text-[10px] text-[var(--text-muted)]">
          links · buttons · badges · unread dots
        </p>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <ColorDot
          color={baseAccent}
          label="Use the theme's default accent"
          selected={!draft.accent}
          onClick={() => touch({ accent: null })}
        />
        {ACCENT_PRESETS.map((hex) => (
          <ColorDot
            key={hex}
            color={hex}
            label={`Accent ${hex}`}
            selected={accentSelected(hex)}
            onClick={() => touch({ accent: hex })}
          />
        ))}
        <ColorInput
          value={draft.accent || baseAccent}
          label="Pick a custom accent color"
          badge={!draft.accent}
          onChange={(hex) => touch({ accent: hex })}
        />
      </div>

      {/* Canvas tint */}
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-medium text-[var(--text-primary)]">
          Canvas tone
        </p>
        <p className="text-[10px] text-[var(--text-muted)]">
          washes surfaces · keeps contrast
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {TINT_PRESETS.map((p) =>
          p.hex ? (
            <ColorDot
              key={p.hex}
              color={p.hex}
              label={`Canvas tint ${p.label}`}
              selected={tintSelected(p.hex)}
              onClick={() => touch({ tint: p.hex })}
            />
          ) : (
            <ColorDot
              key="neutral"
              color={null}
              label="Neutral canvas (keep the theme's own colors)"
              selected={!draft.tint}
              onClick={() => touch({ tint: null })}
            />
          ),
        )}
        <ColorInput
          value={draft.tint || "#f43f5e"}
          label="Pick a custom canvas tint"
          badge={!draft.tint}
          onChange={(hex) => touch({ tint: hex })}
        />
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasChanges ? (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Save to my account
            </button>
            {preview && (
              <button
                type="button"
                onClick={() => previewColors(null)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
              >
                <Undo2 className="h-3.5 w-3.5" />
                Discard
              </button>
            )}
          </>
        ) : baseline ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--destructive)] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Remove my colors
          </button>
        ) : null}
        {savedFlash && (
          <span className="text-[11px] font-medium text-[var(--text-muted)]">
            Saved ✓
          </span>
        )}
        {error && (
          <span className="text-[11px] text-[var(--destructive)]">{error}</span>
        )}
      </div>
    </div>
  );
}

function ThemeSection() {
  const { themeId, themes, setThemeId } = useTheme();
  return (
    <SectionCard
      icon={Palette}
      title="Appearance"
      description="Pick a base theme, then make it yours with the studio below."
    >
      <div className="space-y-1">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setThemeId(t.id)}
            role="radio"
            aria-checked={t.id === themeId}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-[var(--hover)] ${
              t.id === themeId
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-muted)]"
            }`}
          >
            <span
              className="size-4 shrink-0 rounded-full ring-1 ring-[var(--border)]"
              style={{ background: t.swatch }}
            />
            <span className="flex-1 truncate">{t.label}</span>
            {t.id === themeId && (
              <span className="size-2 shrink-0 rounded-full bg-[var(--accent)]" />
            )}
          </button>
        ))}
      </div>
      <ThemeStudio />
    </SectionCard>
  );
}

const PREF_DEFS = [
  { key: "directMessages", label: "Direct Messages" },
  { key: "groupMessages", label: "Group Messages" },
  {
    key: "mentions",
    label: "Mentions",
    hint: "Overrides muted categories when you are @mentioned",
  },
  { key: "friendRequests", label: "Friend Requests" },
  { key: "spaceMessages", label: "Space Messages" },
  { key: "announcements", label: "Announcements" },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiGet("/api/v1/notifications/preferences")
      .then((data) => {
        if (!active) return;
        setPrefs(data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || "Failed to load preferences");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = async (key, nextVal) => {
    if (!prefs) return;
    const prev = prefs[key];
    setPrefs((p) => ({ ...p, [key]: nextVal }));
    setSavingKey(key);
    setError(null);
    try {
      const updated = await apiPatch("/api/v1/notifications/preferences", {
        [key]: nextVal,
      });
      setPrefs(updated);
    } catch (err) {
      setPrefs((p) => ({ ...p, [key]: prev }));
      setError(err?.message || "Failed to save");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <SectionCard
        icon={Bell}
        title="Notification preferences"
        description="Choose which notifications you receive."
      >
        <div className="space-y-3">
          {PREF_DEFS.map((d) => (
            <div
              key={d.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5"
            >
              <span className="text-[13px] text-[var(--text-muted)]">
                {d.label}
              </span>
              <span className="h-6 w-10 animate-pulse rounded-full bg-[var(--border)]" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon={Bell}
      title="Notification preferences"
      description="Choose which notifications you receive. Mentions always override a muted category when you are @mentioned."
    >
      <div className="space-y-2">
        {PREF_DEFS.map((d) => {
          const checked = Boolean(prefs?.[d.key]);
          const isSaving = savingKey === d.key;
          return (
            <div
              key={d.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-tight text-[var(--text-primary)]">
                  {d.label}
                  <span className="ml-2 text-[11px] font-normal text-[var(--text-muted)]">
                    {checked ? "ON" : "OFF"}
                  </span>
                </p>
                {d.hint && (
                  <p className="mt-0.5 text-[11px] leading-tight text-[var(--text-muted)]">
                    {d.hint}
                  </p>
                )}
              </div>
              <Switch
                checked={checked}
                ariaLabel={`${d.label} notifications`}
                disabled={isSaving}
                onCheckedChange={(v) => handleToggle(d.key, v)}
              />
            </div>
          );
        })}
        {error && (
          <p className="px-1 text-[12px] text-[var(--destructive)]">{error}</p>
        )}
      </div>
    </SectionCard>
  );
}

const SOUND_CATEGORY_DEFS = [
  {
    key: "directMessages",
    label: "Direct Messages",
    hint: "New DM when you're not reading it",
  },
  {
    key: "mentions",
    label: "Mentions",
    hint: "When you're @mentioned in a group or space",
  },
  {
    key: "groupMessages",
    label: "Group Messages",
    hint: "Only while the tab is in the background",
  },
  {
    key: "spaceMessages",
    label: "Space Messages",
    hint: "Only while the tab is in the background",
  },
  {
    key: "friendRequests",
    label: "Friend Requests",
    hint: "Incoming requests and acceptances",
  },
];

function SoundsSection() {
  const [prefs, setPrefs] = useState(() => getSoundPrefs());

  const handleToggle = (key, nextVal) => {
    setPrefs(setSoundPrefs({ [key]: nextVal }));
  };

  return (
    <SectionCard
      icon={Volume2}
      title="Sounds"
      description="Play a short chime when a message or request arrives. These switches are the audio layer only — Notification preferences control the in-app list and browser push."
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 transition-colors">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium leading-tight text-[var(--text-primary)]">
              Notification sounds
              <span className="ml-2 text-[11px] font-normal text-[var(--text-muted)]">
                {prefs.enabled ? "ON" : "OFF"}
              </span>
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-[var(--text-muted)]">
              Master switch for every cue below
            </p>
          </div>
          <Switch
            checked={prefs.enabled}
            ariaLabel="Notification sounds"
            onCheckedChange={(v) =>
              setPrefs(v ? setSoundsEnabled(true) : setSoundsEnabled(false))
            }
          />
        </div>
        <div
          className={`space-y-2 transition-opacity ${
            prefs.enabled ? "" : "pointer-events-none opacity-40"
          }`}
        >
          {SOUND_CATEGORY_DEFS.map((d) => {
            const checked = Boolean(prefs[d.key]);
            return (
              <div
                key={d.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium leading-tight text-[var(--text-primary)]">
                    {d.label}
                    <span className="ml-2 text-[11px] font-normal text-[var(--text-muted)]">
                      {checked ? "ON" : "OFF"}
                    </span>
                  </p>
                  {d.hint && (
                    <p className="mt-0.5 text-[11px] leading-tight text-[var(--text-muted)]">
                      {d.hint}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => previewCue(d.key)}
                    aria-label={`Play ${d.label} sound`}
                    title="Play a preview"
                    className="flex size-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <Switch
                    checked={checked}
                    ariaLabel={`${d.label} sound`}
                    onCheckedChange={(v) => handleToggle(d.key, v)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

function BadgeSection() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const me = getSession();
    setUser(me);
    setLoading(false);
  }, []);

  const handleToggle = async (nextVal) => {
    if (!user) return;
    const prev = user.showBadge;
    setUser((u) => ({ ...u, showBadge: nextVal }));
    setSaving(true);
    try {
      const updated = await apiPatch("/api/v1/users/me", {
        showBadge: nextVal,
      });
      setUser(updated);
      setSession(updated, getToken());
    } catch {
      setUser((u) => ({ ...u, showBadge: prev }));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user?.verified) return null;

  return (
    <SectionCard
      icon={user.showBadge ? Eye : EyeOff}
      title="Verification badge"
      description="Control whether the verified badge is shown on your public profile."
    >
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <VerifiedBadge size="sm" decorative />
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            Show badge
          </span>
        </div>
        <Switch
          checked={user.showBadge !== false}
          ariaLabel="Toggle verification badge"
          disabled={saving}
          onCheckedChange={handleToggle}
        />
      </div>
    </SectionCard>
  );
}

// Blocked-users management: who you've blocked, with one-tap unblock. Lives in
// Settings because that's the one place in /app you can reach regardless of
// whether the blocked person still has a conversation open with you.
function BlockedUsersSection() {
  const [blocked, setBlocked] = useState(null); // null = loading
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    apiGet("/api/v1/users/blocked")
      .then((data) => {
        if (active) setBlocked(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (active) {
          setBlocked([]);
          setError(err?.message || "Could not load blocked users");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleUnblock = async (user) => {
    if (!user?.id || busyId) return;
    setBusyId(user.id);
    setError(null);
    try {
      await apiPost(`/api/v1/users/${user.id}/unblock`, {});
      // The server also emits conversation:updated to any open DM, so a
      // chat panel with this person re-enables itself on its own.
      setBlocked((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(err?.message || "Could not unblock user");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SectionCard
      icon={ShieldBan}
      title="Blocked users"
      description="Blocked people can't DM you, see your presence, or message you in shared spaces. Unblock to reconnect."
    >
      {blocked === null ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="flex h-14 animate-pulse items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3"
            />
          ))}
        </div>
      ) : blocked.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-5 text-center">
          <p className="text-[12px] text-[var(--text-muted)]">
            Nobody is blocked right now. When you block someone they'll appear
            here so you can manage it later.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {blocked.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5"
            >
              <Avatar
                name={u.displayName || u.username || "?"}
                avatarStyle={u.avatarStyle}
                url={u.avatarUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                  {u.displayName || u.username}
                </p>
                {u.username && (
                  <p className="truncate text-[11px] text-[var(--text-muted)]">
                    @{u.username}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleUnblock(u)}
                disabled={busyId === u.id}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
              >
                {busyId === u.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserCheck className="h-3.5 w-3.5" />
                )}
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
      {error && (
        <p className="mt-2 text-[12px] text-[var(--destructive)]">{error}</p>
      )}
    </SectionCard>
  );
}

export function SettingsPanel() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          <BadgeSection />
          <ThemeSection />
          <TwoFactorSection />
          <BlockedUsersSection />
          <NotificationsSection />
          <SoundsSection />
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
