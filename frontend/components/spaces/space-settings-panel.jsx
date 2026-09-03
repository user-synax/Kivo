"use client";
import { Check, Crown, Hash, Megaphone, Plus, Shield, Trash2, UserMinus, X, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { participantName } from "@/lib/chat";
import { BANNER_OPTIONS } from "@/lib/banners";
import { SPACE_CATEGORIES } from "@/lib/space-categories";
import { apiPostForm } from "@/lib/api";
import { SpacePaletteSection } from "./space-palette-section";
import { SpacePrivacySection } from "./space-privacy-section";

export function SpaceSettingsPanel({ space, onClose, onUpdated, onDeleted, onLeft }) {
  const currentUser = getSession();
  const userId = currentUser?.id;
  const isOwner = space?.owner === userId;
  const myRole = space?.myRole;
  const canEdit = ["owner","admin"].includes(myRole);

  const [name, setName] = useState(space?.name || "");
  const [description, setDescription] = useState(space?.description || "");
  const [category, setCategory] = useState(space?.category || "Other");
  const [banner, setBanner] = useState(space?.banner || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [members, setMembers] = useState(space?.members || []);
  const [channels, setChannels] = useState(space?.channels || []);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");
  const [newChannelType, setNewChannelType] = useState("text");
  const [channelBusy, setChannelBusy] = useState(false);
  const [showChannelForm, setShowChannelForm] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    setName(space?.name || "");
    setDescription(space?.description || "");
    setCategory(space?.category || "Other");
    setBanner(space?.banner || "");
    setMembers(space?.members || []);
    setChannels(space?.channels || []);
  }, [space]);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("description", description.trim());
      form.append("category", category);
      form.append("banner", banner || "");
      // avatar handled separately via file input if needed
      const updated = await apiPostForm(`/api/v1/spaces/${space.id}`, form);
      onUpdated?.(updated);
    } catch (err) {
      try {
        const updated = await apiPatch(`/api/v1/spaces/${space.id}`, { name: name.trim(), description: description.trim(), category, banner: banner || null });
        onUpdated?.(updated);
      } catch (e2) { setError(e2?.message || err?.message || "Could not save"); }
    } finally { setBusy(false); }
  };

  const changeRole = async (targetId, role) => {
    try { const updated = await apiPatch(`/api/v1/spaces/${space.id}/members/${targetId}/role`, { role }); onUpdated?.(updated); } catch (e) { setError(e?.message); }
  };
  const removeMember = async (targetId) => {
    try { const updated = await apiDelete(`/api/v1/spaces/${space.id}/members/${targetId}`); onUpdated?.(updated); } catch (e) { setError(e?.message); }
  };
  const handleDelete = async () => {
    if (!confirm(`Delete space "${space.name}"? This cannot be undone.`)) return;
    try { await apiDelete(`/api/v1/spaces/${space.id}`); onDeleted?.(space.id); onClose?.(); } catch (e) { setError(e?.message); }
  };

  const handleLeave = async () => {
    if (!confirm(`Leave space "${space.name}"? You can rejoin via Discover.`)) return;
    setBusy(true); setError(null);
    try {
      await apiDelete(`/api/v1/spaces/${space.id}/members/${userId}`);
      onLeft?.(space.id);
      onClose?.();
    } catch (e) { setError(e?.message || "Could not leave space"); }
    finally { setBusy(false); }
  };

  const handleCreateChannel = async () => {
    const trimmed = newChannelName.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) { setError("Channel name must be at least 2 characters (lowercase, numbers, hyphens)"); return; }
    if (!/^[a-z0-9-]+$/.test(trimmed)) { setError("Channel name: lowercase, numbers and hyphens only"); return; }
    setChannelBusy(true); setError(null);
    try {
      const res = await apiPost(`/api/v1/spaces/${space.id}/channels`, { name: trimmed, description: newChannelDesc.trim(), type: newChannelType });
      // res is { channel, conversationId, space }
      if (res?.space) onUpdated?.(res.space);
      else {
        // fallback: refetch space
        const refreshed = await apiGet(`/api/v1/spaces/${space.id}`);
        onUpdated?.(refreshed);
      }
      setNewChannelName(""); setNewChannelDesc(""); setShowChannelForm(false);
    } catch (e) { setError(e?.message || "Could not create channel"); }
    finally { setChannelBusy(false); }
  };

  if (!space) return null;
  return (
    <aside className="t-scroll flex h-full w-full flex-col overflow-y-auto bg-[var(--bg-elevated)]" aria-label="Space settings">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">Space settings</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex flex-col gap-5 px-5 py-5">
        <div className="relative h-20 w-full overflow-hidden rounded-xl border border-[var(--border)]">
          {banner ? <img src={banner} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-[var(--accent)]/30 to-[#6a4cf5]/30" />}
        </div>
        {canEdit ? (
          <>
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">Name</span>
              <input value={name} maxLength={50} onChange={(e)=>setName(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none" />
            </div>
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">Description</span>
              <textarea value={description} maxLength={500} onChange={(e)=>setDescription(e.target.value)} placeholder="What is this space about?" className="w-full min-h-[72px] resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none" />
            </div>
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">Category</span>
              <select value={category} onChange={(e)=>setCategory(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none">
                {SPACE_CATEGORIES.map((c)=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <span className="mb-1.5 block text-[12px] font-medium text-[var(--text-muted)]">Banner</span>
              <div className="grid grid-cols-4 gap-2">
                <button type="button" onClick={()=>setBanner("")} className={`h-12 rounded-lg border text-[11px] ${!banner ? "border-[var(--accent)] bg-[var(--hover)]" : "border-[var(--border)]"}`}>None</button>
                {BANNER_OPTIONS.slice(0,7).map((o)=> <button key={o.id} type="button" onClick={()=>setBanner(o.url)} className={`h-12 overflow-hidden rounded-lg border ${banner===o.url ? "border-[var(--accent)] ring-2 ring-[var(--accent)]" : "border-[var(--border)]"}`}><img src={o.url} alt="" className="h-full w-full object-cover" /></button>)}
              </div>
            </div>
            <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 self-start rounded-full bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-[var(--on-accent)] disabled:opacity-40"><Check className="h-4 w-4" /> Save</button>
          </>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">{space.name}</p>
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">{space.description}</p>
            <span className="mt-2 inline-block rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">{space.category}</span>
          </div>
        )}

        {error && <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[12px] text-[var(--text-muted)]">{error}</p>}

        <SpacePaletteSection space={space} onUpdated={onUpdated} canEdit={canEdit} />

        <SpacePrivacySection space={space} onUpdated={onUpdated} canEdit={canEdit} />

        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Members · {members.length}</p>
        </div>
        <div className="flex flex-col gap-2">
          {members.map((m) => {
            const isSelf = m.userId === userId;
            const canManage = canEdit && !isSelf && m.role !== "owner";
            const displayName = m.displayName || m.username || m.email || `User ${m.userId.slice(0,6)}`;
            return (
              <div key={m.userId} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
                <Avatar name={displayName} avatarStyle={m.avatarStyle} url={m.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--text-primary)]">{displayName} {isSelf && "(You)"}</p>
                  <div className="flex items-center gap-1.5">
                    {m.username && <span className="truncate text-[11px] text-[var(--text-muted)]">@{m.username}</span>}
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">{m.role === "owner" && <Crown className="h-3 w-3" />} {m.role}</span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <select value={m.role} onChange={(e)=>changeRole(m.userId, e.target.value)} className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2 py-1 text-[11px] text-[var(--text-primary)]">
                      <option value="member">member</option>
                      <option value="moderator">moderator</option>
                      <option value="admin">admin</option>
                    </select>
                    <button type="button" onClick={()=>removeMember(m.userId)} className="flex size-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"><UserMinus className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Channels — create intended channel inside this space */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Channels · {channels.length}</p>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowChannelForm((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)]"
              >
                <Plus className="h-3 w-3" /> {showChannelForm ? "Cancel" : "New channel"}
              </button>
            )}
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {channels.map((ch) => {
              const Icon = ch.type === "announcement" ? Megaphone : Hash;
              return (
                <div key={ch.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
                  <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">#{ch.name}</p>
                    {ch.description && <p className="truncate text-[11px] text-[var(--text-muted)]">{ch.description}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-muted)] border border-[var(--border)]">{ch.type}</span>
                </div>
              );
            })}
          </div>
          {canEdit && showChannelForm && (
            <div className="mt-3 animate-[t-panel-in_0.2s_ease] space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-3 sm:p-3">
              <div>
                <span className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">Channel name</span>
                <input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  maxLength={30}
                  placeholder="e.g. dev-help"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <span className="mt-1 block text-[11px] text-[var(--text-muted)]">Lowercase, numbers and hyphens only</span>
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">Description (optional)</span>
                <input
                  value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  maxLength={280}
                  placeholder="What is this channel about?"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-medium text-[var(--text-muted)]">Type</span>
                <select value={newChannelType} onChange={(e) => setNewChannelType(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none">
                  <option value="text">Text — anyone can post</option>
                  <option value="announcement">Announcement — admins only</option>
                </select>
              </div>
              <button
                type="button"
                onClick={handleCreateChannel}
                disabled={channelBusy || !newChannelName.trim()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-40 sm:w-auto"
              >
                {channelBusy ? "Creating…" : "Create channel"}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border)]">
          <button type="button" onClick={handleLeave} disabled={busy} className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:opacity-40">
            Leave Space
          </button>
          {isOwner && <button type="button" onClick={handleDelete} className="rounded-lg border border-red-200 px-4 py-2.5 text-[13px] font-medium text-red-600 hover:bg-red-50"><Trash2 className="mr-1 inline h-4 w-4" /> Delete Space</button>}
        </div>
      </div>
    </aside>
  );
}
export default SpaceSettingsPanel;
