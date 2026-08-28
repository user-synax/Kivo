"use client";

// Chat panel. Renders the selected conversation's header + a placeholder message
// area. With no selection it shows an empty state instead of a blank panel.
// `onBack` is provided only on mobile (stack navigation) to return to the list.

function initials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-[var(--bg-base)] px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text-muted)]">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 5h16v11H9l-4 4V5z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Select a conversation to start chatting
      </p>
    </div>
  );
}

export function ChatPanel({ conversation, onBack }) {
  if (!conversation) {
    return <EmptyState />;
  }

  const { name, type, lastMessage } = conversation;

  return (
    <div className="flex h-full flex-col bg-[var(--bg-base)]">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] px-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)]">
          {initials(name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
            {name}
          </p>
          <p className="truncate text-[12px] text-[var(--text-muted)]">
            {type === "group" ? "Group" : "Direct message"}
          </p>
        </div>
      </div>

      {/* Placeholder message area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex justify-start">
            <div className="max-w-[75%] rounded-2xl rounded-tl-md border border-[var(--border)] bg-[var(--bubble-received)] px-4 py-2.5 text-sm text-[var(--text-primary)]">
              {lastMessage}
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[75%] rounded-2xl rounded-tr-md bg-[var(--bubble-sent)] px-4 py-2.5 text-sm text-[var(--text-primary)]">
              Got it — thanks for the update!
            </div>
          </div>
        </div>
      </div>

      {/* Composer placeholder (non-functional shell) */}
      <div className="shrink-0 border-t border-[var(--border)] p-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2">
          <input
            type="text"
            disabled
            placeholder="Type a message…"
            aria-label="Message"
            className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <span className="shrink-0 text-[12px] text-[var(--text-muted)]">
            Send
          </span>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
