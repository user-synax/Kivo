"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiGet } from "@/lib/api";
import { clearSession, getSession, getToken, setSession } from "@/lib/auth";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    apiGet("/api/v1/users/me")
      .then((me) => {
        if (!active) return;
        setUser(me);
        setSession(me, getToken());
      })
      .catch(() => {
        if (active) setUser(getSession());
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    const token = getToken();
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      });
    } catch {
      // best-effort; clear local session regardless
    }
    clearSession();
    router.replace("/login");
  }

  const rows = user
    ? [
        { label: "Display name", value: user.displayName || "—" },
        { label: "Username", value: user.username || "—" },
        { label: "Email", value: user.email },
        { label: "Status", value: user.status || "—" },
        { label: "Role", value: user.role },
      ]
    : [];

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[var(--bg-base)]">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:text-[var(--text-primary)]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M15 5l-7 7 7 7"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to chat
        </Link>

        <h1 className="mt-6 font-goga text-[28px] font-medium tracking-tight text-[var(--text-primary)]">
          Profile
        </h1>

        {user?.banner ? (
          <div className="mt-6 h-28 w-full overflow-hidden rounded-xl border border-[var(--border)]">
            <img
              src={user.banner}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="mt-6 flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          <Avatar
            name={user?.displayName || user?.email || "?"}
            avatarStyle={user?.avatarStyle}
            url={user?.avatarUrl}
            size="lg"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-medium text-[var(--text-primary)]">
              {user?.displayName || "—"}
            </p>
            <p className="truncate text-[13px] text-[var(--text-muted)]">
              {user?.status || user?.email}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6">
          {user?.bio ? (
            <p className="mb-4 text-sm text-[var(--text-primary)]">{user.bio}</p>
          ) : null}
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-3 last:border-b-0"
            >
              <span className="text-[13px] text-[var(--text-muted)]">
                {row.label}
              </span>
              <span className="truncate text-sm font-medium text-[var(--text-primary)]">
                {row.value}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)]"
        >
          Log out
        </button>
      </div>
    </div>
  );
}
