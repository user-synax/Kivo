"use client";

import { Shield, Palette, Bell } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

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

function NotificationsPlaceholder() {
  return (
    <SectionCard icon={Bell} title="Notifications" description="Control how you receive updates.">
      <p className="text-[12px] text-[var(--text-muted)]">Notification preferences will appear here.</p>
    </SectionCard>
  );
}

export function SettingsPanel() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-3">
          <ThemeSection />
          <SecuritySection />
          <NotificationsPlaceholder />
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
