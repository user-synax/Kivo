"use client";

import { useEffect, useState } from "react";

// Format "active X ago" — matches spec: min / hour / day progression.
export function formatLastActive(lastActiveAt) {
  if (!lastActiveAt) return "Offline";
  const d = new Date(lastActiveAt);
  if (Number.isNaN(d.getTime())) return "Offline";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "active just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "active just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `active ${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `active ${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `active ${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `active ${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(days / 365);
  return `active ${years} year${years === 1 ? "" : "s"} ago`;
}

// Hook that ticks every `intervalMs` so the label ages live without reload.
export function useLiveLastActive(lastActiveAt, online, intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (online) return;
    if (!lastActiveAt) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [lastActiveAt, online, intervalMs]);

  // `now` is a dependency so format recomputes on tick
  void now;
  if (online) return "Online";
  return formatLastActive(lastActiveAt);
}
