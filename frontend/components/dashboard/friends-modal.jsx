"use client";

import {
  Check,
  Inbox,
  Loader2,
  MessageCircle,
  Search,
  SearchX,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  getCachedFriends,
  getCachedFriendRequests,
  setCachedFriends,
  setCachedFriendRequests,
} from "@/lib/cache";
import { useIsDesktop } from "@/lib/use-breakpoint";
import { motion, useReducedMotion } from "motion/react";

const btnPrimary =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-40";
const btnSecondary =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--hover)] disabled:pointer-events-none disabled:opacity-40";
const btnGhost =
  "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40";
const tagPill =
  "shrink-0 rounded-full border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-muted)]";

const TABS = [
  { id: "requests", label: "Requests" },
  { id: "friends", label: "Friends" },
  { id: "add", label: "Add" },
];

function PersonRow({ person, subtitle, children }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
      <Avatar
        name={person.name}
        avatarStyle={person.avatarStyle}
        url={person.avatarUrl}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
          {person.name}
        </p>
        <p className="truncate text-xs text-[var(--text-muted)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-[var(--hover)] text-[var(--text-muted)]">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </span>
      <p className="text-[13px] text-[var(--text-muted)]">{title}</p>
      {hint && (
        <p className="text-[12px] text-[var(--text-muted)]/70">{hint}</p>
      )}
    </div>
  );
}

export function FriendsModal({ open, onClose, onStartChat }) {
  const [tab, setTab] = useState("requests");
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const timer = useRef(null);

  const [render, setRender] = useState(open);
  const [show, setShow] = useState(false);
  const closeMs = 150;

  const barRef = useRef(null);
  const pillRef = useRef(null);
  const firstTab = useRef(true);

  const isDesktop = useIsDesktop();
  const reduce = useReducedMotion();
  const EASE = [0.22, 1, 0.36, 1];

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
      .then((d) => {
        const list = d || [];
        setFriends(list);
        const uid = getSession()?.id;
        if (uid) setCachedFriends(uid, list).catch(() => {});
      })
      .catch(() => setFriends([]));
  const loadRequests = () =>
    apiGet("/api/v1/friends/requests")
      .then((d) => {
        const list = d || [];
        setRequests(list);
        const uid = getSession()?.id;
        if (uid) setCachedFriendRequests(uid, list).catch(() => {});
      })
      .catch(() => setRequests([]));

  useEffect(() => {
    if (!open) return;
    const uid = getSession()?.id;
    if (uid) {
      getCachedFriends(uid)
        .then((cached) => {
          if (Array.isArray(cached) && cached.length) setFriends(cached);
        })
        .catch(() => {});
      getCachedFriendRequests(uid)
        .then((cached) => {
          if (Array.isArray(cached)) setRequests(cached);
        })
        .catch(() => {});
    }
    loadFriends();
    loadRequests();
  }, [open]);

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
  const handle = (u) => (u.username ? `@${u.username}` : u.email);

  const sendRequest = async (identifier, id) => {
    setBusyId(id);
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

  const startChat = (friendId) => onStartChat(friendId);

  const removeFriend = async (friendId) => {
    if (!friendId) return;
    const friend = friends.find((f) => f.id === friendId);
    const name = friend ? (friend.displayName || friend.username || friend.email) : "this friend";
    if (!window.confirm(`Remove ${name} from friends?`)) return;
    setBusyId(friendId);
    try {
      await apiDelete(`/api/v1/friends/${friendId}`);
      setFriends((prev) => {
        const next = prev.filter((f) => f.id !== friendId);
        const uid = getSession()?.id;
        if (uid) setCachedFriends(uid, next).catch(() => {});
        return next;
      });
    } catch (err) {
      window.alert(err?.message || "Could not remove friend");
    } finally {
      setBusyId(null);
    }
  };

  if (!render) return null;

  const tabsNode = (
    <div ref={barRef} role="tablist" className="t-tabs relative inline-flex w-full items-center gap-1 rounded-full bg-[var(--bg-surface)] p-1">
      <span
        ref={pillRef}
        aria-hidden="true"
        className="t-tabs-pill absolute inset-y-1 left-1 rounded-full bg-[var(--accent)] shadow-[0_4px_12px_-4px_var(--accent)] transition-[transform,width] duration-200 ease-out"
      />
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          onClick={() => setTab(t.id)}
          className={`t-tab relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 ${tab === t.id ? "text-[var(--on-accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
        >
          {t.label}
          {t.id === "requests" && requests.length > 0 && (
            <span className={`flex min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-semibold ${tab === "requests" ? "bg-white/25 text-[var(--on-accent)]" : "bg-[var(--unread-badge)] text-[var(--on-accent)]"}`}>{requests.length}</span>
          )}
        </button>
      ))}
    </div>
  );

  const bodyNode = (
    <div className="flex-1 overflow-y-auto px-3 py-3">
      {tab === "requests" && (
        <div className="flex flex-col gap-2">
          {requests.length === 0 && <EmptyState icon={Inbox} title="No pending requests" />}
          {requests.map((r) => (
            <PersonRow key={r.id} person={{ ...r.from, name: fullName(r.from) }} subtitle={handle(r.from)}>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" disabled={busyId === r.id} onClick={() => accept(r.id)} className={btnPrimary}>
                  {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Check className="h-3.5 w-3.5" strokeWidth={2.2} />}
                  Accept
                </button>
                <button type="button" disabled={busyId === r.id} onClick={() => decline(r.id)} className={btnGhost}>Decline</button>
              </div>
            </PersonRow>
          ))}
        </div>
      )}
      {tab === "friends" && (
        <div className="flex flex-col gap-2">
          {friends.length === 0 && <EmptyState icon={Users} title="No friends yet" hint="Add someone from the “Add friend” tab." />}
          {friends.map((f) => (
            <PersonRow key={f.id} person={{ ...f, name: fullName(f) }} subtitle={handle(f)}>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => startChat(f.id)} className={btnSecondary}>
                  <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} /> Message
                </button>
                <button
                  type="button"
                  disabled={busyId === f.id}
                  onClick={() => removeFriend(f.id)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--destructive)]/10 hover:text-[var(--destructive)] hover:border-[var(--destructive)]/30 disabled:opacity-40"
                  aria-label={`Remove ${fullName(f)}`}
                >
                  {busyId === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <UserMinus className="h-3.5 w-3.5" strokeWidth={1.8} />}
                  Remove
                </button>
              </div>
            </PersonRow>
          ))}
        </div>
      )}
      {tab === "add" && (
        <div className="flex flex-col gap-3">
          <div>
            <label className="flex items-center gap-2 rounded-[var(--radius-inputs)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 shadow-[inset_0_1px_1px_var(--glass-highlight)] transition-colors duration-150 focus-within:border-[var(--accent)]">
              <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={1.8} aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username or email…"
                aria-label="Search users"
                className="w-full min-w-0 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
            </label>
            <p className="mt-1.5 px-1 text-[12px] text-[var(--text-muted)]">Find people by their username or email address.</p>
          </div>
          <div className="min-h-24" aria-live="polite">
            {loadingSearch && (
              <div className="flex items-center justify-center gap-2 px-1 py-8 text-[12px] text-[var(--text-muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> Searching…
              </div>
            )}
            {!loadingSearch && query.trim() && results.length === 0 && <EmptyState icon={SearchX} title="No users found" hint="Try a different name, @username, or email." />}
            {!query.trim() && !loadingSearch && <EmptyState icon={Search} title="Start typing to find people to add." />}
            <div className="flex flex-col gap-2">
              {results.map((u) => (
                <PersonRow key={u.id} person={{ ...u, name: fullName(u) }} subtitle={handle(u)}>
                  {u.relationship === "friends" ? (
                    <button type="button" onClick={() => startChat(u.id)} className={btnSecondary}>
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} /> Message
                    </button>
                  ) : u.relationship === "outgoing" ? (
                    <span className={tagPill}>Requested</span>
                  ) : (
                    <button type="button" disabled={busyId === u.id} onClick={() => sendRequest(u.username || u.email, u.id)} className={btnPrimary}>
                      {busyId === u.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />} Add
                    </button>
                  )}
                </PersonRow>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (!isDesktop) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Friends"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={reduce ? { duration: 0 } : { duration: 0.28, ease: EASE }}
          className="relative z-10 flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] pb-[max(env(safe-area-inset-bottom),1rem)]"
        >
          <div className="mx-auto mt-3 h-1.5 w-9 shrink-0 rounded-full bg-[var(--border)]" aria-hidden="true" />
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
            <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Friends</h2>
            <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="border-b border-[var(--border)] px-3 py-2.5">{tabsNode}</div>
          {bodyNode}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <button type="button" aria-label="Close" onClick={onClose} className={`t-modal-backdrop absolute inset-0 bg-black/50 backdrop-blur-sm ${show ? "is-open" : ""}`} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Friends"
        className={`t-modal relative z-10 flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] ${show ? "is-open" : "is-closing"}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-8 py-3.5">
          <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Friends</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="border-b border-[var(--border)] px-3 py-2.5">{tabsNode}</div>
        {bodyNode}
      </div>
    </div>
  );
}

export default FriendsModal;
