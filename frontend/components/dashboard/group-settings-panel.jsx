"use client";

import { Check, Crown, Shield, UserMinus, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/dashboard/avatar";
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { participantName } from "@/lib/chat";

// Reuse the button hierarchy from the friends modal for visual consistency.
const btnPrimary =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)] transition-opacity duration-150 hover:opacity-90 disabled:pointer-events-none disabled:opacity-40";
const btnSecondary =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--hover)] disabled:pointer-events-none disabled:opacity-40";
const btnGhost =
  "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[12px] font-medium text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--text-primary)] disabled:pointer-events-none disabled:opacity-40";

function MemberRow({
  member,
  isAdmin,
  isSelf,
  canManage,
  onPromote,
  onDemote,
  onRemove,
  busy,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5">
      <Avatar
        name={participantName(member)}
        avatarStyle={member.avatarStyle}
        url={member.avatarUrl}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {participantName(member)}
            {isSelf ? " (You)" : ""}
          </p>
          {isAdmin && (
            <span className="flex items-center gap-0.5 rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
              <Crown className="h-3 w-3" />
              Admin
            </span>
          )}
        </div>
      </div>
      {canManage && !isSelf && (
        <div className="flex shrink-0 items-center gap-1.5 max-sm:w-full max-sm:justify-end max-sm:gap-2">
          {isAdmin ? (
            <button
              type="button"
              disabled={busy}
              onClick={onDemote}
              className={btnGhost}
            >
              Remove admin
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={onPromote}
              className={btnSecondary}
            >
              <Shield className="h-3.5 w-3.5" strokeWidth={1.8} />
              Make admin
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className={btnGhost}
          >
            <UserMinus className="h-3.5 w-3.5" strokeWidth={1.8} />
            Remove
          </button>
        </div>
      )}
      {canManage && isSelf && isAdmin && (
        <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
          Admin
        </span>
      )}
    </div>
  );
}

export function GroupSettingsPanel({
  conversation,
  onClose,
  onConversationUpdate,
  onLeft,
}) {
  const currentUser = getSession();
  const userId = currentUser?.id;
  const isAdmin = conversation?.isAdmin;

  const [rename, setRename] = useState(conversation?.name || "");
  const [members, setMembers] = useState(conversation?.participants || []);
  const [adminIds, setAdminIds] = useState(new Set(conversation?.admins || []));
  const [friends, setFriends] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  // Keep local member/admin state in sync with the conversation prop (which the
  // parent refreshes from API responses and realtime events).
  useEffect(() => {
    setMembers(conversation?.participants || []);
    setAdminIds(new Set(conversation?.admins || []));
    setRename(conversation?.name || "");
  }, [conversation]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    apiGet("/api/v1/friends")
      .then((d) => setFriends(d || []))
      .catch(() => setFriends([]));
    return undefined;
  }, [isAdmin]);

  const memberSet = new Set(members.map((m) => m.id));
  const candidateFriends = friends.filter((f) => !memberSet.has(f.id));

  const applyUpdate = (updated) => {
    if (!updated) return;
    setMembers(updated.participants || members);
    setAdminIds(new Set(updated.admins || []));
    if (updated.name) setRename(updated.name);
    onConversationUpdate?.(updated);
  };

  const saveName = async () => {
    const name = rename.trim();
    if (!name || name === conversation?.name) return;
    setBusyId("name");
    try {
      const updated = await apiPatch(
        `/api/v1/conversations/${conversation.id}`,
        { name },
      );
      applyUpdate(updated);
    } catch (err) {
      setError(err?.message || "Could not rename group");
      setRename(conversation?.name || "");
    } finally {
      setBusyId(null);
    }
  };

  const changeAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError("Image must be under 4MB.");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const updated = await apiUpload(
        `/api/v1/conversations/${conversation.id}`,
        form,
      );
      applyUpdate(updated);
    } catch (err) {
      setError(err?.message || "Could not upload photo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addMember = async (friendId) => {
    setBusyId(friendId);
    try {
      const updated = await apiPost(
        `/api/v1/conversations/${conversation.id}/members`,
        {
          memberIds: [friendId],
        },
      );
      applyUpdate(updated);
    } catch (err) {
      setError(err?.message || "Could not add member");
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (targetId) => {
    setBusyId(targetId);
    try {
      const updated = await apiDelete(
        `/api/v1/conversations/${conversation.id}/members/${targetId}`,
      );
      if (targetId === userId) {
        onLeft?.();
        return;
      }
      applyUpdate(updated);
    } catch (err) {
      setError(err?.message || "Could not remove member");
    } finally {
      setBusyId(null);
    }
  };

  const promote = async (targetId) => {
    setBusyId(targetId);
    try {
      const updated = await apiPost(
        `/api/v1/conversations/${conversation.id}/admins/${targetId}`,
      );
      applyUpdate(updated);
    } catch (err) {
      setError(err?.message || "Could not promote member");
    } finally {
      setBusyId(null);
    }
  };

  const demote = async (targetId) => {
    setBusyId(targetId);
    try {
      const updated = await apiDelete(
        `/api/v1/conversations/${conversation.id}/admins/${targetId}`,
      );
      applyUpdate(updated);
    } catch (err) {
      setError(err?.message || "Could not demote member");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <aside
      className="t-scroll flex h-full w-full flex-col overflow-y-auto bg-[var(--bg-elevated)]"
      aria-label="Group settings"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
          Group settings
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-9 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        {/* Identity */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Avatar
            name={conversation?.name || "Group"}
            avatarStyle={null}
            url={conversation?.avatarUrl}
            size="lg"
          />
          {isAdmin ? (
            <div className="flex w-full items-center gap-2">
              <input
                value={rename}
                maxLength={50}
                onChange={(e) => setRename(e.target.value)}
                aria-label="Group name"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
              <button
                type="button"
                disabled={busyId === "name" || !rename.trim()}
                onClick={saveName}
                className={btnPrimary}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.2} />
                Save
              </button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {conversation?.name || "Group"}
            </p>
          )}
          {isAdmin && (
            <div className="flex flex-col items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={changeAvatar}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--hover)] disabled:opacity-50"
              >
                {uploading
                  ? "Uploading…"
                  : conversation?.avatarUrl
                    ? "Change photo"
                    : "Upload photo"}
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 text-[12px] text-[var(--text-muted)]">
            {error}
          </p>
        )}

        {/* Members */}
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Members · {members.length}
          </p>
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isAdmin={adminIds.has(m.id)}
                isSelf={m.id === userId}
                canManage={isAdmin}
                busy={busyId === m.id}
                onPromote={() => promote(m.id)}
                onDemote={() => demote(m.id)}
                onRemove={() => removeMember(m.id)}
              />
            ))}
          </div>
        </div>

        {/* Add members (admins only) */}
        {isAdmin && candidateFriends.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              Add friends
            </p>
            <div className="flex flex-col gap-2">
              {candidateFriends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2.5"
                >
                  <Avatar
                    name={participantName(f)}
                    avatarStyle={f.avatarStyle}
                    url={f.avatarUrl}
                    size="sm"
                  />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
                    {participantName(f)}
                  </p>
                  <button
                    type="button"
                    disabled={busyId === f.id}
                    onClick={() => addMember(f.id)}
                    className={btnSecondary}
                  >
                    <UserPlus className="h-3.5 w-3.5" strokeWidth={1.8} />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leave group */}
        <button
          type="button"
          disabled={busyId === userId}
          onClick={() => removeMember(userId)}
          className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-[13px] font-medium text-[var(--text-muted)] transition-colors duration-200 hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        >
          Leave group
        </button>
      </div>
    </aside>
  );
}

export default GroupSettingsPanel;
