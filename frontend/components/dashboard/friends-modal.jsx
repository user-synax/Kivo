"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

function initials(name) {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Avatar({ name }) {
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)]">
      {initials(name)}
    </div>
  );
}

const TABS = [
  { id: "requests", label: "Requests" },
  { id: "friends", label: "Friends" },
  { id: "add", label: "Add friend" },
];

export function FriendsModal({ open, onClose, onStartChat }) {
  const [tab, setTab] = useState("requests");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const timer = useRef(null);

  // Mount + visibility state so the modal can animate both in and out.
  const [render, setRender] = useState(open);
  const [show, setShow] = useState(false);
  const closeMs = 150;

  const barRef = useRef(null);
  const pillRef = useRef(null);
  const firstTab = useRef(true);

  // Drive mount/unmount around the open flag so we get an exit animation.
  useEffect(() => {
    if (open) {
      setRender(true);
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setShow(true)),
      );
      return () => cancelAnimationFrame(id);
    }
    if (render) {
      setShow(false);
      const id = setTimeout(() => setRender(false), closeMs);
      return () => clearTimeout(id);
    }
  }, [open, render]);

  // Slide the active-pill to the current tab (snap on first paint, tween after).
  const movePill = (animate) => {
    const bar = barRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;
    const tabs = [...bar.querySelectorAll(".t-tab")];
    const activeEl =
      tabs.find((t) => t.getAttribute("aria-selected") === "true") || tabs[0];
    if (!activeEl) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform = `translateX(${activeEl.offsetLeft}px)`;
      pill.style.width = `${activeEl.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = prev;
    } else {
      pill.style.transform = `translateX(${activeEl.offsetLeft}px)`;
      pill.style.width = `${activeEl.offsetWidth}px`;
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: movePill only reads refs and is stable across renders.
  useEffect(() => {
    if (!render) return;
    const id = requestAnimationFrame(() => {
      movePill(!firstTab.current);
      firstTab.current = false;
    });
    const onResize = () => movePill(false);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [render, tab]);

  const loadFriends = () =>
    apiGet("/api/v1/friends")
      .then((d) => setFriends(d || []))
      .catch(() => setFriends([]));
  const loadRequests = () =>
    apiGet("/api/v1/friends/requests")
      .then((d) => setRequests(d || []))
      .catch(() => setRequests([]));

  useEffect(() => {
    if (!open) return;
    apiGet("/api/v1/friends")
      .then((d) => setFriends(d || []))
      .catch(() => setFriends([]));
    apiGet("/api/v1/friends/requests")
      .then((d) => setRequests(d || []))
      .catch(() => setRequests([]));
  }, [open]);

  // Debounced search for the "Add friend" tab.
  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length === 0) {
      setResults([]);
      return;
    }
    setLoadingSearch(true);
    timer.current = setTimeout(() => {
      apiGet(`/api/v1/users/search?q=${encodeURIComponent(q)}`)
        .then((d) => setResults(d || []))
        .catch(() => setResults([]))
        .finally(() => setLoadingSearch(false));
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, open]);

  const fullName = (u) => u.displayName || u.username || u.email;

  const sendRequest = async (identifier) => {
    setBusyId(identifier);
    try {
      await apiPost("/api/v1/friends/request", { identifier });
      if (query.trim()) {
        const d = await apiGet(
          `/api/v1/users/search?q=${encodeURIComponent(query.trim())}`,
        );
        setResults(d || []);
      }
      loadRequests();
    } catch (err) {
      window.alert(err?.message || "Could not send request");
    } finally {
      setBusyId(null);
    }
  };

  const accept = async (id) => {
    setBusyId(id);
    try {
      await apiPost(`/api/v1/friends/requests/${id}/accept`, {});
      await loadRequests();
      await loadFriends();
    } finally {
      setBusyId(null);
    }
  };

  const decline = async (id) => {
    setBusyId(id);
    try {
      await apiPost(`/api/v1/friends/requests/${id}/decline`, {});
      await loadRequests();
    } finally {
      setBusyId(null);
    }
  };

  const startChat = (friendId) => {
    onStartChat(friendId);
  };

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`t-modal-backdrop absolute inset-0 bg-black/50 ${
          show ? "is-open" : ""
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Friends"
        className={`t-modal relative z-10 flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl ${
          show ? "is-open" : "is-closing"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-medium text-[var(--text-primary)]">
            Friends
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex justify-center border-b border-[var(--border)] px-3 py-2.5">
          <div ref={barRef} className="t-tabs" role="tablist">
            <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className="t-tab"
              >
                {t.label}
                {t.id === "requests" && requests.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-[var(--unread-badge)] px-1.5 text-[11px] font-medium text-[var(--on-accent)]">
                    {requests.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {tab === "requests" && (
            <div className="flex flex-col gap-2">
              {requests.length === 0 && (
                <p className="px-1 py-6 text-center text-[13px] text-[var(--text-muted)]">
                  No pending requests
                </p>
              )}
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5"
                >
                  <Avatar name={fullName(r.from)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {fullName(r.from)}
                    </p>
                    <p className="truncate text-[12px] text-[var(--text-muted)]">
                      {r.from.username ? `@${r.from.username}` : r.from.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => accept(r.id)}
                    className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-[var(--on-accent)] transition-opacity disabled:opacity-40"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => decline(r.id)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
                  >
                    Decline
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "friends" && (
            <div className="flex flex-col gap-2">
              {friends.length === 0 && (
                <p className="px-1 py-6 text-center text-[13px] text-[var(--text-muted)]">
                  No friends yet — add someone from the “Add friend” tab
                </p>
              )}
              {friends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5"
                >
                  <Avatar name={fullName(f)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {fullName(f)}
                    </p>
                    <p className="truncate text-[12px] text-[var(--text-muted)]">
                      {f.username ? `@${f.username}` : f.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startChat(f.id)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)]"
                  >
                    Message
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "add" && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="relative">
                  <svg
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="11"
                      cy="11"
                      r="7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M20 20l-3.2-3.2"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by username or email…"
                    aria-label="Search users"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
                <p className="mt-1.5 px-1 text-[12px] text-[var(--text-muted)]">
                  Find people by their username or email address.
                </p>
              </div>

              <div className="min-h-24">
                {loadingSearch && (
                  <p className="px-1 py-4 text-center text-[12px] text-[var(--text-muted)]">
                    Searching…
                  </p>
                )}
                {!loadingSearch && query.trim() && results.length === 0 && (
                  <div className="flex flex-col items-center gap-2 px-1 py-8 text-center">
                    <p className="text-[13px] text-[var(--text-muted)]">
                      No users found
                    </p>
                    <p className="text-[12px] text-[var(--text-muted)]/70">
                      Try a different name, @username, or email.
                    </p>
                  </div>
                )}
                {!query.trim() && !loadingSearch && (
                  <p className="px-1 py-8 text-center text-[13px] text-[var(--text-muted)]">
                    Start typing to find people to add.
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  {results.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5"
                    >
                      <Avatar name={fullName(u)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                          {fullName(u)}
                        </p>
                        <p className="truncate text-[12px] text-[var(--text-muted)]">
                          {u.username ? `@${u.username}` : u.email}
                        </p>
                      </div>
                      {u.relationship === "friends" ? (
                        <button
                          type="button"
                          onClick={() => startChat(u.id)}
                          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)]"
                        >
                          Message
                        </button>
                      ) : u.relationship === "outgoing" ? (
                        <span className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-muted)]">
                          Requested
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => sendRequest(u.username || u.email)}
                          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[12px] font-medium text-[var(--on-accent)] transition-opacity disabled:opacity-40"
                        >
                          Add friend
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FriendsModal;
