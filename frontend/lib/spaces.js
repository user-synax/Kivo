export const SPACE_ROLES = ["owner", "admin", "moderator", "member"];

export function roleRank(role) {
  return { owner: 4, admin: 3, moderator: 2, member: 1 }[role] || 0;
}

export function canManageSpace(role) {
  return ["owner", "admin"].includes(role);
}

export function canManageMembers(actorRole, targetRole) {
  return roleRank(actorRole) > roleRank(targetRole);
}

export function canCreateChannel(role) {
  return ["owner", "admin"].includes(role);
}

export function buildInviteLink(code) {
  if (typeof window === "undefined") return `/invite/${code}`;
  return `${window.location.origin}/invite/${code}`;
}

export function roleBadge(role) {
  const map = {
    owner: { label: "Owner", className: "bg-amber-500 text-white" },
    admin: { label: "Admin", className: "bg-[var(--accent)] text-[var(--on-accent)]" },
    moderator: { label: "Mod", className: "bg-emerald-500 text-white" },
    member: { label: "Member", className: "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border)]" },
  };
  return map[role] || map.member;
}
