export function pollIsExpired(poll) {
  if (!poll || !poll.expiresAt) return false;
  if (poll.isClosed) return true;
  return new Date(poll.expiresAt).getTime() < Date.now();
}

export function pollIsActive(poll) {
  return poll && !poll.isClosed && !pollIsExpired(poll);
}

export function pollTimeLeft(expiresAt) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

export function pollTotalVotes(poll) {
  return (
    poll?.totalVotes ??
    (poll?.options || []).reduce((s, o) => s + (o.count || 0), 0)
  );
}

export function pollPercent(option, total) {
  if (!total) return 0;
  return Math.round(((option.count || 0) / total) * 100);
}
