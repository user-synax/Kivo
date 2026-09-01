"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminGate } from "@/components/admin/admin-gate";
import {
  BarChart3,
  Ban,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  Loader2,
  LogOut,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from "lucide-react";

// ── API helper ──────────────────────────────────────────────────────────────

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

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#262626] bg-[#141414] p-5">
      <div
        className="flex size-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: accent + "18" }}
      >
        <Icon className="h-5 w-5" style={{ color: accent }} strokeWidth={1.8} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-white">{value ?? "—"}</p>
        <p className="text-[13px] text-[#999]">{label}</p>
      </div>
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-[13px] text-[#999]">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex size-8 items-center justify-center rounded-lg border border-[#262626] text-[#999] hover:bg-[#1c1c1c] disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex size-8 items-center justify-center rounded-lg border border-[#262626] text-[#999] hover:bg-[#1c1c1c] disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/api/admin/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-[#999]" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Total Users" value={stats?.totalUsers} icon={Users} accent="#4ba9e1" />
      <StatCard label="Banned Users" value={stats?.bannedUsers} icon={Ban} accent="#ff5577" />
      <StatCard label="Groups" value={stats?.totalGroups} icon={FileText} accent="#22c55e" />
      <StatCard label="Spaces" value={stats?.totalSpaces} icon={Database} accent="#d44df0" />
      <StatCard label="Messages" value={stats?.totalMessages} icon={BarChart3} accent="#ff7a3d" />
    </div>
  );
}

// ── Users Tab ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [bannedFilter, setBannedFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(null);
  const debounceRef = useRef(null);

  const load = useCallback(
    (p = page, q = search, banned = bannedFilter) => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (q) params.set("q", q);
      if (banned) params.set("banned", banned);
      adminFetch(`/api/admin/users?${params}`)
        .then((data) => {
          setUsers(data.users || []);
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 1);
          setPage(data.page || 1);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [page, search, bannedFilter],
  );

  useEffect(() => { load(1, "", ""); }, []);

  const handleSearch = (val) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(1, val, bannedFilter), 300);
  };

  const handleBan = async (userId) => {
    const reason = window.prompt("Ban reason (optional):");
    if (reason === null) return;
    setActionBusy(userId);
    try {
      await adminFetch(`/api/admin/users/${userId}/ban`, {
        method: "POST",
        body: JSON.stringify({ reason: reason || undefined }),
      });
      load(page, search, bannedFilter);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionBusy(null);
    }
  };

  const handleUnban = async (userId) => {
    setActionBusy(userId);
    try {
      await adminFetch(`/api/admin/users/${userId}/unban`, { method: "POST" });
      load(page, search, bannedFilter);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-[#262626] bg-[#141414] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#666] focus:border-[#4ba9e1] focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          value={bannedFilter}
          onChange={(e) => {
            setBannedFilter(e.target.value);
            load(1, search, e.target.value);
          }}
          className="rounded-xl border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white focus:border-[#4ba9e1] focus:outline-none"
        >
          <option value="">All users</option>
          <option value="false">Active</option>
          <option value="true">Banned</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[#999]" />
        </div>
      ) : users.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-[#666]">No users found</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#262626]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#262626] bg-[#141414]">
                <th className="px-4 py-3 font-medium text-[#999]">User</th>
                <th className="hidden px-4 py-3 font-medium text-[#999] md:table-cell">Email</th>
                <th className="hidden px-4 py-3 font-medium text-[#999] sm:table-cell">Joined</th>
                <th className="px-4 py-3 font-medium text-[#999]">Status</th>
                <th className="px-4 py-3 font-medium text-[#999]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[#262626]/50 last:border-0 hover:bg-[#1c1c1c]/50"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1c1c1c] text-[12px] font-medium text-white">
                        {(u.displayName || u.username || "?")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {u.displayName || u.username || "—"}
                        </p>
                        <p className="truncate text-[12px] text-[#666]">
                          {u.username ? `@${u.username}` : u.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-[#999] md:table-cell">{u.email}</td>
                  <td className="hidden px-4 py-3 text-[13px] text-[#999] sm:table-cell">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {u.isBanned ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ff5577]/15 px-2.5 py-0.5 text-[12px] font-medium text-[#ff5577]">
                        <Ban className="h-3 w-3" /> Banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#22c55e]/15 px-2.5 py-0.5 text-[12px] font-medium text-[#22c55e]">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {actionBusy === u.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#999]" />
                    ) : u.isBanned ? (
                      <button
                        type="button"
                        onClick={() => handleUnban(u.id)}
                        className="rounded-lg bg-[#22c55e]/15 px-3 py-1.5 text-[12px] font-medium text-[#22c55e] hover:bg-[#22c55e]/25"
                      >
                        Unban
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBan(u.id)}
                        className="rounded-lg bg-[#ff5577]/15 px-3 py-1.5 text-[12px] font-medium text-[#ff5577] hover:bg-[#ff5577]/25"
                      >
                        Ban
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={(p) => load(p, search, bannedFilter)} />
    </div>
  );
}

// ── Groups Tab ──────────────────────────────────────────────────────────────

function GroupsTab() {
  const [groups, setGroups] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(null);

  const load = useCallback((p = page) => {
    setLoading(true);
    adminFetch(`/api/admin/groups?page=${p}&limit=20`)
      .then((data) => {
        setGroups(data.groups || []);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(1); }, []);

  const handleDelete = async (groupId, name) => {
    if (!window.confirm(`Delete group "${name}"? This cannot be undone.`)) return;
    setActionBusy(groupId);
    try {
      await adminFetch(`/api/admin/groups/${groupId}`, { method: "DELETE" });
      load(page);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[#999]" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-[#666]">No groups found</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#262626]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#262626] bg-[#141414]">
                <th className="px-4 py-3 font-medium text-[#999]">Name</th>
                <th className="px-4 py-3 font-medium text-[#999]">Members</th>
                <th className="hidden px-4 py-3 font-medium text-[#999] md:table-cell">Admins</th>
                <th className="hidden px-4 py-3 font-medium text-[#999] sm:table-cell">Created</th>
                <th className="px-4 py-3 font-medium text-[#999]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr
                  key={g.id}
                  className="border-b border-[#262626]/50 last:border-0 hover:bg-[#1c1c1c]/50"
                >
                  <td className="max-w-[160px] truncate px-4 py-3 font-medium text-white sm:max-w-none">{g.name}</td>
                  <td className="px-4 py-3 text-[#999]">{g.memberCount}</td>
                  <td className="hidden px-4 py-3 text-[12px] text-[#666] md:table-cell">
                    {(g.admins || []).map((a) => a.displayName || a.username).join(", ") || "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-[13px] text-[#999] sm:table-cell">
                    {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {actionBusy === g.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#999]" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(g.id, g.name)}
                        className="rounded-lg bg-[#ff5577]/15 px-3 py-1.5 text-[12px] font-medium text-[#ff5577] hover:bg-[#ff5577]/25"
                      >
                        <Trash2 className="mr-1 inline h-3 w-3" />
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={load} />
    </div>
  );
}

// ── Spaces Tab ──────────────────────────────────────────────────────────────

function SpacesTab() {
  const [spaces, setSpaces] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(null);

  const load = useCallback((p = page) => {
    setLoading(true);
    adminFetch(`/api/admin/spaces?page=${p}&limit=20`)
      .then((data) => {
        setSpaces(data.spaces || []);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(1); }, []);

  const handleDelete = async (spaceId, name) => {
    if (!window.confirm(`Delete space "${name}"? This cannot be undone.`)) return;
    setActionBusy(spaceId);
    try {
      await adminFetch(`/api/admin/spaces/${spaceId}`, { method: "DELETE" });
      load(page);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[#999]" />
        </div>
      ) : spaces.length === 0 ? (
        <p className="py-12 text-center text-[14px] text-[#666]">No spaces found</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#262626]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#262626] bg-[#141414]">
                <th className="px-4 py-3 font-medium text-[#999]">Name</th>
                <th className="hidden px-4 py-3 font-medium text-[#999] sm:table-cell">Category</th>
                <th className="px-4 py-3 font-medium text-[#999]">Members</th>
                <th className="hidden px-4 py-3 font-medium text-[#999] md:table-cell">Channels</th>
                <th className="hidden px-4 py-3 font-medium text-[#999] lg:table-cell">Owner</th>
                <th className="hidden px-4 py-3 font-medium text-[#999] sm:table-cell">Created</th>
                <th className="px-4 py-3 font-medium text-[#999]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {spaces.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-[#262626]/50 last:border-0 hover:bg-[#1c1c1c]/50"
                >
                  <td className="max-w-[140px] truncate px-4 py-3 font-medium text-white sm:max-w-none">{s.name}</td>
                  <td className="hidden px-4 py-3 text-[13px] text-[#666] sm:table-cell">{s.category}</td>
                  <td className="px-4 py-3 text-[#999]">{s.memberCount}</td>
                  <td className="hidden px-4 py-3 text-[#999] md:table-cell">{s.channelCount}</td>
                  <td className="hidden px-4 py-3 text-[12px] text-[#666] lg:table-cell">
                    {s.owner?.displayName || s.owner?.username || "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-[13px] text-[#999] sm:table-cell">
                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {actionBusy === s.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#999]" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id, s.name)}
                        className="rounded-lg bg-[#ff5577]/15 px-3 py-1.5 text-[12px] font-medium text-[#ff5577] hover:bg-[#ff5577]/25"
                      >
                        <Trash2 className="mr-1 inline h-3 w-3" />
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={load} />
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "users", label: "Users", icon: Users },
  { id: "groups", label: "Groups", icon: FileText },
  { id: "spaces", label: "Spaces", icon: Database },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [tab, setTab] = useState("overview");

  const handleLogout = async () => {
    try {
      await adminFetch("/api/admin/logout", { method: "POST" });
    } catch {}
    router.replace("/admin");
  };

  return (
    <AdminGate>
      <div className="flex min-h-[100dvh] flex-col bg-[#090909]">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between border-b border-[#262626] bg-[#141414] px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-[#4ba9e1]" strokeWidth={1.8} />
            <h1 className="font-display text-lg font-semibold tracking-tight text-white">
              Kivo Admin
            </h1>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-[#999] hover:bg-[#1c1c1c] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </header>

        {/* Mobile: horizontal tab bar */}
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#262626] bg-[#141414] px-3 py-2 sm:hidden">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-[#1c1c1c] text-white"
                    : "text-[#999] hover:bg-[#1c1c1c]/50 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="flex flex-1 overflow-hidden">
          {/* Desktop: sidebar tabs */}
          <nav className="hidden sm:flex w-48 shrink-0 flex-col border-r border-[#262626] bg-[#141414] p-3">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-[#1c1c1c] text-white"
                      : "text-[#999] hover:bg-[#1c1c1c]/50 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  {t.label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {tab === "overview" && <OverviewTab />}
            {tab === "users" && <UsersTab />}
            {tab === "groups" && <GroupsTab />}
            {tab === "spaces" && <SpacesTab />}
          </main>
        </div>
      </div>
    </AdminGate>
  );
}
