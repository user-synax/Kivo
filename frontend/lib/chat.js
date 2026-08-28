// Small pure helpers shared by the dashboard/sidebar/chat-panel for deriving
// display values from backend conversation/message shapes.

// The "other" participant of a DM, given the current user id. Works whether
// `participants` are populated objects or bare id strings.
export function otherParticipant(conversation, userId) {
  const parts = conversation?.participants || [];
  if (parts.length === 0) return null;
  const other =
    parts.find((p) => {
      const id = p?.id || p?._id || p;
      return id?.toString?.() !== userId;
    }) || parts[0];
  return other;
}

export function participantId(p) {
  return (p?.id || p?._id || p)?.toString?.();
}

export function participantName(p) {
  if (!p) return "Unknown";
  return p.displayName || p.username || p.email || "Unknown";
}

export function participantAvatarName(p) {
  const name = participantName(p);
  return name === "Unknown" ? "?" : name;
}

// Compact timestamp for the conversation list and message meta.
export function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(
    [],
    sameYear
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" },
  );
}
