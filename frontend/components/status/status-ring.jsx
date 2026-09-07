"use client";
import { Avatar } from "@/components/dashboard/avatar";

export function StatusRing({ name, url, avatarStyle, isPlus, hasUnseen, isMine, size="md" }) {
  const ringClass = hasUnseen
    ? "ring-2 ring-[#25D366] ring-offset-2 ring-offset-[var(--bg-elevated)]"
    : hasUnseen === false
    ? "ring-2 ring-[var(--border)] ring-offset-2 ring-offset-[var(--bg-elevated)]"
    : "ring-2 ring-transparent ring-offset-2 ring-offset-[var(--bg-elevated)]";
  return (
    <div className={`relative shrink-0 rounded-full ${ringClass} ${isMine ? "p-0.5" : "p-0.5"}`}>
      <Avatar name={name} url={url} avatarStyle={avatarStyle} isPlus={isPlus} size={size} />
      {isMine && (
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#25D366] text-white text-[12px] font-bold ring-2 ring-[var(--bg-elevated)]">+</span>
      )}
    </div>
  );
}
