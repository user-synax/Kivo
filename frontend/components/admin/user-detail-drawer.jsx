"use client";

import {
  Ban,
  Calendar,
  CheckCircle,
  Clock,
  CornerDownRight,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

async function adminFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Request failed (${res.status})`);
  }
  return json.data;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BannerChip({ action, reason, performedAt }) {
  const isBan = action === "ban_user";
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg border bg-[var(--bg-elevated)] p-3">
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
          isBan ? "text-[#ff5577]" : "text-[#22c55e]"
        }`}
      >
        {isBan ? (
          <Ban className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-[#fff]">
          {isBan ? "Banned" : "Unbanned"}
        </p>
        {reason ? (
          <p className="mt-0.5 truncate text-[12px] text-[#999]">{reason}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-[#666]">
          {fmtDateTime(performedAt)}
        </p>
      </div>
    </div>
  );
}

export function UserDetailDrawer({ userId, open, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !userId) {
      setDetail(null);
      setError("");
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    adminFetch(`/api/admin/users/${userId}`)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const esc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop — a real button so click AND keyboard both dismiss */}
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-[#000]/60 backdrop-blur-sm"
        aria-label="Close user details"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className="relative ml-auto flex w-[420px] max-w-full flex-col border-l border-[#262626] bg-[#141414] shadow-2xl"
        style={{ maxHeight: "100dvh" }}
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#262626] px-4 py-3">
          <h2 className="font-display text-base font-semibold tracking-tight text-white">
            User details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-[#999] hover:bg-[#1c1c1c] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex size-5 items-center justify-center rounded-full border-[2px] border-[#262626] border-t-[#4ba9e1] animate-spin" />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-[#ff5577]/30 bg-[#ff5577]/10 px-3 py-2.5 text-[13px] text-[#ff5577]">
              {error}
            </div>
          )}

          {detail && !loading && (
            <div className="flex flex-col gap-5">
              {/* Identity block */}
              <section className="rounded-xl border border-[#262626] bg-[#1c1c1c] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#262626] text-[15px] font-medium text-white">
                    {(detail.displayName ||
                      detail.username ||
                      "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-white">
                      {detail.displayName || detail.username || "—"}
                    </p>
                    <p className="truncate text-[13px] text-[#999]">
                      {detail.username ? `@${detail.username}` : detail.email}
                    </p>
                    <p className="mt-1 text-[12px] text-[#666]">
                      {detail.email}
                    </p>
                  </div>
                </div>

                {detail.bio ? (
                  <p className="mt-3 truncate text-[13px] text-[#999]">
                    {detail.bio}
                  </p>
                ) : null}

                {detail.status ? (
                  <p className="mt-1.5 truncate text-[13px] text-[#666]">
                    <CornerDownRight
                      className="inline size-3.5 shrink-0 vertical-align-baseline text-[#666]"
                      style={{ verticalAlign: "middle" }}
                    />{" "}
                    {detail.status}
                  </p>
                ) : null}
              </section>

              {/* Status chips */}
              <div className="flex flex-wrap gap-2">
                <StatusChip
                  icon={
                    detail.isBanned ? (
                      <Ban className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )
                  }
                  label={detail.isBanned ? "Banned" : "Active"}
                  color={detail.isBanned ? "#ff5577" : "#22c55e"}
                />
                <StatusChip
                  icon={
                    detail.plan === "plus" ? (
                      <Shield className="h-3.5 w-3.5" />
                    ) : null
                  }
                  label={detail.plan === "plus" ? "Kivo Plus" : "Free"}
                  color={detail.plan === "plus" ? "#a78bfa" : "#999"}
                />
                <StatusChip
                  icon={
                    detail.twoFactorEnabled ? (
                      <Shield className="h-3.5 w-3.5" />
                    ) : null
                  }
                  label={detail.twoFactorEnabled ? "2FA on" : "2FA off"}
                  color={detail.twoFactorEnabled ? "#22c55e" : "#999"}
                />
              </div>

              {/* Counts */}
              <section className="rounded-xl border border-[#262626] bg-[#1c1c1c] p-4">
                <h3 className="mb-3 font-sans text-[13px] font-semibold uppercase tracking-wider text-[#999]">
                  Activity
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <CountCard label="DMs" value={detail.conversationCount} />
                  <CountCard label="Groups" value={detail.groupCount} />
                  <CountCard label="Spaces" value={detail.spaceCount} />
                </div>
              </section>

              {/* Join date */}
              <section className="rounded-xl border border-[#262626] bg-[#1c1c1c] p-4">
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 shrink-0 h-4 w-4 text-[#999]" />
                  <div>
                    <p className="text-[13px] font-medium text-white">Joined</p>
                    <p className="text-[12px] text-[#666]">
                      {fmtDate(detail.createdAt)}
                    </p>
                  </div>
                </div>
              </section>

              {/* Ban history */}
              {detail.banHistory.length > 0 && (
                <section className="rounded-xl border border-[#262626] bg-[#1c1c1c] p-4">
                  <h3 className="mb-3 flex items-center gap-2 font-sans text-[13px] font-semibold uppercase tracking-wider text-[#999]">
                    <Clock className="h-3.5 w-3.5" />
                    Ban history
                    <span className="ml-auto text-[11px] text-[#666]">
                      {detail.banHistory.length}
                    </span>
                  </h3>
                  <div className="flex flex-col gap-2">
                    {detail.banHistory.map((entry) => (
                      <BannerChip
                        key={`${entry.action}-${entry.performedAt}-${Math.random()}`}
                        action={entry.action}
                        reason={entry.reason}
                        performedAt={entry.performedAt}
                      />
                    ))}
                  </div>
                </section>
              )}

              {!detail.isBanned && detail.banHistory.length === 0 && (
                <section className="rounded-xl border border-[#262626] bg-[#1c1c1c] p-4">
                  <p className="text-[13px] text-[#666]">
                    No ban actions recorded for this account.
                  </p>
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function StatusChip({ icon, label, color }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-[#262626]/60 px-2.5 py-1 text-[12px] font-medium"
      style={{ color }}
    >
      {icon}
      {label}
    </span>
  );
}

function CountCard({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-[#262626]/40 p-3">
      <span className="text-2xl font-semibold text-white">{value ?? "—"}</span>
      <span className="text-[11px] text-[#666]">{label}</span>
    </div>
  );
}
