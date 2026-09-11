"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, SearchX, MapPin } from "lucide-react";
import { ProfilePreviewCard } from "@/components/dashboard/profile-preview-card";
import { SendRequestModal } from "@/components/dashboard/send-request-modal";
import { NearbyTab } from "@/components/dashboard/nearby-tab";
import { apiGet, apiPost } from "@/lib/api";

function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-[var(--hover)] text-[var(--text-muted)]">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </span>
      <p className="text-[13px] text-[var(--text-muted)]">{title}</p>
      {hint && <p className="text-[12px] text-[var(--text-muted)]/70 max-w-[280px]">{hint}</p>}
    </div>
  );
}

export function FindPanel({ onStartChat }) {
  const [subTab, setSubTab] = useState("find"); // find | nearby
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [sendModalUser, setSendModalUser] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (subTab !== "find") return;
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
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, subTab]);

  const handleSendWithMessage = async (welcomeMessage, withMessage) => {
    const u = sendModalUser;
    if (!u) return;
    const identifier = u.username || u.email;
    setBusyId(u.id);
    try {
      await apiPost("/api/v1/friends/request", {
        identifier,
        welcomeMessage: withMessage ? welcomeMessage : undefined,
      });
      setSendModalUser(null);
      // refresh results to show Requested
      if (query.trim()) {
        const d = await apiGet(`/api/v1/users/search?q=${encodeURIComponent(query.trim())}`);
        setResults(d || []);
      }
    } catch (err) {
      window.alert(err?.message || "Could not send request");
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const startChat = (friendId) => onStartChat?.(friendId);

  return (
    <div className="flex h-full w-full flex-col">
      {/* Sub-tabs: Find | Nearby */}
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5">
        <div className="inline-flex w-full items-center gap-1 rounded-full bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={() => setSubTab("find")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${subTab === "find" ? "bg-[var(--accent)] text-[var(--on-accent)] shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
          >
            <Search className="h-3.5 w-3.5" /> Find
          </button>
          <button
            type="button"
            onClick={() => setSubTab("nearby")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${subTab === "nearby" ? "bg-[var(--accent)] text-[var(--on-accent)] shadow" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}
          >
            <MapPin className="h-3.5 w-3.5" /> Nearby
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {subTab === "find" ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="flex items-center gap-2 rounded-[var(--radius-inputs)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5 shadow-[inset_0_1px_1px_var(--glass-highlight)] transition-colors focus-within:border-[var(--accent)]">
                <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" strokeWidth={1.8} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by username or email…"
                  aria-label="Search users"
                  className="w-full min-w-0 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
              </label>
              <p className="mt-1.5 px-1 text-[12px] text-[var(--text-muted)]">Find people by username or email — preview their profile in a square card.</p>
            </div>
            <div className="min-h-24" aria-live="polite">
              {loadingSearch && (
                <div className="flex items-center justify-center gap-2 px-1 py-8 text-[12px] text-[var(--text-muted)]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> Searching…
                </div>
              )}
              {!loadingSearch && query.trim() && results.length === 0 && <EmptyState icon={SearchX} title="No users found" hint="Try a different name, @username, or email." />}
              {!query.trim() && !loadingSearch && <EmptyState icon={Search} title="Start typing to find people" hint="Enter a username or email to see a rich preview card. Choose Send Request → with or without a welcome message." />}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {results.map((u) => (
                  <ProfilePreviewCard
                    key={u.id}
                    user={u}
                    relationship={u.relationship}
                    busy={busyId === u.id}
                    onAdd={(usr) => setSendModalUser(usr)}
                    onMessage={(usr) => startChat(usr.id)}
                    onViewProfile={(usr) => { if (usr.username) window.open(`/u/${usr.username}`, "_blank"); }}
                  />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <NearbyTab onStartChat={startChat} onViewProfile={(u) => u.username && window.open(`/u/${u.username}`, "_blank")} />
        )}
      </div>

      <SendRequestModal
        open={!!sendModalUser}
        user={sendModalUser}
        onClose={() => setSendModalUser(null)}
        onSend={handleSendWithMessage}
      />
    </div>
  );
}

export default FindPanel;
