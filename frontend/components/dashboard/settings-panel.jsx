"use client";

import { Bell, Eye, EyeOff, Palette, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Switch } from "@/components/ui/switch";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { apiGet, apiPatch } from "@/lib/api";
import { getSession, setSession, getToken } from "@/lib/auth";

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)]">
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">{description}</p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}

function ThemeSection() {
  const { themeId, themes, setThemeId } = useTheme();
  return (
    <SectionCard icon={Palette} title="Appearance" description="Choose your theme.">
      <div className="space-y-1">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setThemeId(t.id)}
            role="radio"
            aria-checked={t.id === themeId}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-[var(--hover)] ${
              t.id === themeId ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
            }`}
          >
            <span className="size-4 shrink-0 rounded-full ring-1 ring-[var(--border)]" style={{ background: t.swatch }} />
            <span className="flex-1 truncate">{t.label}</span>
            {t.id === themeId && <span className="size-2 shrink-0 rounded-full bg-[var(--accent)]" />}
          </button>
        ))}
      </div>
    </SectionCard>
  );
}

function SecuritySection() {
  return (
    <SectionCard
      icon={Shield}
      title="Security"
      description="Manage two-factor authentication and session security."
    >
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Two-factor authentication
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-muted)]">
          Add an extra layer of protection to your account. When enabled, you will be asked for a verification code when signing in.
        </p>
        <button
          type="button"
          disabled
          className="mt-3 inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-muted)] opacity-60"
          title="Coming soon"
        >
          Enable 2FA — coming soon
        </button>
      </div>
    </SectionCard>
  );
}

const PREF_DEFS = [
  { key: "directMessages", label: "Direct Messages" },
  { key: "groupMessages", label: "Group Messages" },
  { key: "mentions", label: "Mentions", hint: "Overrides muted categories when you are @mentioned" },
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
      const updated = await apiPatch("/api/v1/notifications/preferences", { [key]: nextVal });
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
      <SectionCard icon={Bell} title="Notification preferences" description="Choose which notifications you receive.">
        <div className="space-y-3">
          {PREF_DEFS.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
              <span className="text-[13px] text-[var(--text-muted)]">{d.label}</span>
              <span className="h-6 w-10 animate-pulse rounded-full bg-[var(--border)]" />
            </div>
          ))}
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard icon={Bell} title="Notification preferences" description="Choose which notifications you receive. Mentions always override a muted category when you are @mentioned.">
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
                  <span className="ml-2 text-[11px] font-normal text-[var(--text-muted)]">{checked ? "ON" : "OFF"}</span>
                </p>
                {d.hint && <p className="mt-0.5 text-[11px] leading-tight text-[var(--text-muted)]">{d.hint}</p>}
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
        {error && <p className="px-1 text-[12px] text-[var(--destructive)]">{error}</p>}
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
      const updated = await apiPatch("/api/v1/users/me", { showBadge: nextVal });
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
          <span className="text-[13px] font-medium text-[var(--text-primary)]">Show badge</span>
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

export function SettingsPanel() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          <BadgeSection />
          <ThemeSection />
          <SecuritySection />
          <NotificationsSection />
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
