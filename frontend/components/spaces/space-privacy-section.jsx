"use client";

import { Check, Copy, Globe, Link2, Loader2, Lock, Shield } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

// Space discoverability + invite links. Owners/admins choose whether the Space
// is public (Discover + direct join) or private (hidden from Discover, joinable
// only through a rotating invite code with a 7-day expiry). Members see a
// read-only summary; the manage controls only render for owner/admin.
export function SpacePrivacySection({ space, onUpdated, canEdit }) {
  const visibility = space?.visibility || "public";
  const [busy, setBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [loadingInvite, setLoadingInvite] = useState(false);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadInvite = useCallback(async () => {
    if (!canEdit) return;
    setLoadingInvite(true);
    try {
      const data = await apiGet(`/api/v1/spaces/${space.id}/invite`);
      setInvite(data);
    } catch {
      // Invite status is non-critical; the manage actions surface real errors.
    } finally {
      setLoadingInvite(false);
    }
  }, [canEdit, space.id]);

  useEffect(() => {
    setCopied(false);
    loadInvite();
  }, [loadInvite]);

  const changeVisibility = async (value) => {
    if (!canEdit || value === visibility) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiPatch(`/api/v1/spaces/${space.id}`, {
        visibility: value,
      });
      onUpdated?.(updated);
      if (value === "private") loadInvite();
    } catch (e) {
      setError(e?.message || "Could not change visibility");
    } finally {
      setBusy(false);
    }
  };

  const manageInvite = async (action) => {
    setInviteBusy(true);
    setError(null);
    try {
      const data =
        action === "revoke"
          ? await apiDelete(`/api/v1/spaces/${space.id}/invite`)
          : await apiPost(`/api/v1/spaces/${space.id}/invite`);
      setInvite(data);
      setCopied(false);
    } catch (e) {
      setError(e?.message || "Could not update invite link");
    } finally {
      setInviteBusy(false);
    }
  };

  const copyLink = async (text) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand("copy");
        ta.remove();
      } catch {
        ok = false;
      }
    }
    setCopied(ok);
    if (ok) {
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  const inviteUrl =
    invite?.code && typeof window !== "undefined"
      ? `${window.location.origin}/app?join=${invite.code}`
      : "";
  const expiresLabel = invite?.expiresAt
    ? new Date(invite.expiresAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "";

  const options = [
    {
      value: "public",
      icon: Globe,
      label: "Public",
      hint: "Shows up in Discover — anyone can join.",
    },
    {
      value: "private",
      icon: Lock,
      label: "Private",
      hint: "Hidden from Discover — join only via an invite link.",
    },
  ];

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)]">
          <Shield className="h-4 w-4" strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">
            Privacy &amp; invites
          </h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-muted)]">
            {canEdit
              ? "Choose who can find this Space and how people join."
              : "Who can find this Space and how people join."}
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {options.map((opt) => {
              const Icon = opt.icon;
              const selected = visibility === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={!canEdit || busy || selected}
                  onClick={() => changeVisibility(opt.value)}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-default ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[var(--bg-base)] hover:bg-[var(--hover)] disabled:opacity-60"
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      selected ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-[var(--text-primary)]">
                      {opt.label}
                      {selected && (
                        <span className="ml-2 text-[11px] font-normal text-[var(--accent)]">
                          Active
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-[var(--text-muted)]">
                      {opt.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {canEdit && visibility === "private" && (
            <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)]">
                <Link2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                Invite link
              </p>
              {loadingInvite ? (
                <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--text-muted)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking invite…
                </div>
              ) : invite?.enabled && invite.code ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-[11px] text-[var(--text-primary)]">
                      {inviteUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyLink(inviteUrl)}
                      aria-label="Copy invite link"
                      title="Copy invite link"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                  {copied && (
                    <p className="mt-1 text-[11px] text-[var(--accent)]">
                      Link copied to clipboard
                    </p>
                  )}
                  <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                    {expiresLabel
                      ? `Anyone with this link can join until ${expiresLabel}. `
                      : ""}
                    Links expire after 7 days.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={inviteBusy}
                      onClick={() => manageInvite("create")}
                      className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)] disabled:opacity-40"
                    >
                      {inviteBusy ? "Working…" : "New link"}
                    </button>
                    <button
                      type="button"
                      disabled={inviteBusy}
                      onClick={() => manageInvite("revoke")}
                      className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
                    >
                      Turn off
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
                    No active invite. Create a link to let people join this
                    Space.
                  </p>
                  <button
                    type="button"
                    disabled={inviteBusy}
                    onClick={() => manageInvite("create")}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[11px] font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {inviteBusy ? "Creating…" : "Create invite link"}
                  </button>
                </>
              )}
            </div>
          )}

          {!canEdit && visibility === "private" && (
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              Invite-only Space — new members need an invite link from an
              admin.
            </p>
          )}

          {error && (
            <p className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[12px] text-[var(--destructive)]">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
