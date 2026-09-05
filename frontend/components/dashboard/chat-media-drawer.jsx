"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageCircle,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RichEmptyState } from "@/components/ui/empty-state";
import { apiGet } from "@/lib/api";
import { formatTime } from "@/lib/chat";
import { domainOf, extractUrls } from "@/lib/links";
import { cn } from "@/lib/utils";

// Bound the backfill walk so huge histories don't page forever.
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

const TABS = [
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "files", label: "Files", icon: FileText },
  { id: "links", label: "Links", icon: Link2 },
];

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileGlyph(mimeType, kind) {
  if (kind === "audio" || mimeType?.startsWith("audio/")) return "🎙️";
  if (mimeType?.includes("pdf")) return "📄";
  if (mimeType?.includes("word") || mimeType?.includes("document")) return "📝";
  if (mimeType?.includes("excel") || mimeType?.includes("sheet")) return "📊";
  if (mimeType?.includes("powerpoint") || mimeType?.includes("presentation"))
    return "📑";
  if (mimeType?.includes("text")) return "📃";
  return "📁";
}

function isImageAttachment(a) {
  return a?.kind === "image" || a?.mimeType?.startsWith("image/");
}

// Shared media drawer: every image, file, and link ever sent in this
// conversation, newest first. Paginates history on open (same cursor API as
// the timeline), then derives the three feeds client-side — no new endpoints.
export function ChatMediaDrawer({
  conversation,
  onClose,
  onJumpToMessage,
  isMobile = false,
}) {
  const convId = conversation?.id || null;
  const [tab, setTab] = useState("media");
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState([]);
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(null);

  const membersById = useMemo(() => {
    const map = {};
    for (const p of conversation?.participants || []) {
      const id = p?.id || p?._id || p;
      if (id) map[id.toString()] = p;
    }
    return map;
  }, [conversation]);

  const senderName = (senderId) => {
    const s = membersById[senderId];
    return s ? s.displayName || s.username || "Someone" : "Unknown";
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMedia([]);
    setFiles([]);
    setLinks([]);
    setViewerIndex(null);

    (async () => {
      const foundMedia = [];
      const foundFiles = [];
      const foundLinks = [];
      const seenUrls = new Set();
      let cursor = null;
      try {
        for (let page = 0; page < MAX_PAGES; page += 1) {
          const qs = cursor
            ? `?limit=${PAGE_LIMIT}&cursor=${encodeURIComponent(cursor)}`
            : `?limit=${PAGE_LIMIT}`;
          // eslint-disable-next-line no-await-in-loop -- sequential cursor walk
          const data = await apiGet(
            `/api/v1/conversations/${convId}/messages${qs}`,
          );
          if (cancelled) return;
          const msgs = Array.isArray(data?.messages) ? data.messages : [];
          for (const m of msgs) {
            if (!m || m.isDeleted) continue;
            for (const a of m.attachments || []) {
              if (!a?.url) continue;
              const entry = {
                fileId: a.fileId || `${m.id}-${a.url}`,
                url: a.url,
                fileName: a.fileName || "Attachment",
                mimeType: a.mimeType || "",
                kind: a.kind || "document",
                size: a.size,
                messageId: m.id,
                senderId: m.senderId,
                createdAt: m.createdAt,
              };
              if (isImageAttachment(a)) foundMedia.push(entry);
              else foundFiles.push(entry);
            }
            for (const url of extractUrls(m.content || "")) {
              if (seenUrls.has(url)) continue;
              seenUrls.add(url);
              foundLinks.push({
                url,
                domain: domainOf(url) || url,
                messageId: m.id,
                senderId: m.senderId,
                createdAt: m.createdAt,
              });
            }
          }
          cursor = data?.nextCursor || null;
          if (!cursor) break;
        }
      } catch {
        // Partial results still render; empty states cover total failure.
      }
      if (cancelled) return;
      const byNewest = (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      setMedia(foundMedia.sort(byNewest));
      setFiles(foundFiles.sort(byNewest));
      setLinks(foundLinks.sort(byNewest));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [convId]);

  // Escape closes the viewer first, then the drawer.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (viewerIndex !== null) setViewerIndex(null);
      else onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewerIndex, onClose]);

  const counts = {
    media: media.length,
    files: files.length,
    links: links.length,
  };
  const viewing = viewerIndex !== null ? media[viewerIndex] : null;

  const jump = (messageId) => {
    if (!messageId) return;
    onClose?.();
    // Let the drawer unmount before scrolling so the target isn't covered.
    requestAnimationFrame(() => onJumpToMessage?.(messageId));
  };

  return (
    <section
      aria-label="Shared media"
      className="absolute inset-0 z-40 flex flex-col bg-[var(--bg-surface)] sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[380px] sm:border-l sm:border-[var(--border)]"
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-base)] px-4">
        <h2 className="truncate font-sans text-[14px] font-semibold text-[var(--text-primary)]">
          Shared media
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close shared media"
          className="kivo-focus flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-[var(--border)] px-3 py-2.5">
        <div
          role="tablist"
          aria-label="Media types"
          className="relative inline-flex w-full items-center gap-1 rounded-full bg-[var(--bg-base)] p-1"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
                  active
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
                {t.label}
                {!loading && counts[t.id] > 0 && (
                  <span
                    className={cn(
                      "flex min-w-4 items-center justify-center rounded-full px-1 text-[11px] font-semibold",
                      active
                        ? "bg-white/25 text-[var(--on-accent)]"
                        : "bg-[var(--bg-elevated)] text-[var(--text-muted)]",
                    )}
                  >
                    {counts[t.id] > 99 ? "99+" : counts[t.id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="t-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--text-muted)]">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="text-[13px]">Gathering shared media…</span>
          </div>
        ) : tab === "media" ? (
          media.length === 0 ? (
            <RichEmptyState
              icon={ImageIcon}
              title="No photos yet"
              hint="Images you share in this chat will show up here."
            />
          ) : (
            <div className="grid grid-cols-3 gap-1 p-2">
              {media.map((item, i) => (
                <button
                  key={item.fileId}
                  type="button"
                  onClick={() => setViewerIndex(i)}
                  aria-label={`Open ${item.fileName}`}
                  className="group relative block aspect-square overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-base)]"
                >
                  <img
                    src={item.url}
                    alt={item.fileName}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          )
        ) : tab === "files" ? (
          files.length === 0 ? (
            <RichEmptyState
              icon={FileText}
              title="No files yet"
              hint="Documents and voice messages shared here will show up here."
            />
          ) : (
            <ul className="flex flex-col gap-1 p-2">
              {files.map((item) => (
                <li key={item.fileId}>
                  <div className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-[var(--hover)]">
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-lg"
                      aria-hidden="true"
                    >
                      {fileGlyph(item.mimeType, item.kind)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(item.url, "_blank", "noopener,noreferrer")
                      }
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">
                        {item.fileName}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--text-muted)]">
                        {[formatSize(item.size), senderName(item.senderId)]
                          .filter(Boolean)
                          .join(" · ")}
                        {item.createdAt && ` · ${formatTime(item.createdAt)}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => jump(item.messageId)}
                      aria-label="Jump to message"
                      title="Jump to message"
                      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]"
                    >
                      <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : links.length === 0 ? (
          <RichEmptyState
            icon={Link2}
            title="No links yet"
            hint="Links shared in this chat will collect here for quick access."
          />
        ) : (
          <ul className="flex flex-col gap-1 p-2">
            {links.map((item) => (
              <li key={`${item.messageId}-${item.url}`}>
                <div className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-[var(--hover)]">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-base)] text-[var(--text-muted)]"
                    aria-hidden="true"
                  >
                    <Link2 className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(item.url, "_blank", "noopener,noreferrer")
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-[13px] font-medium text-[var(--accent)]">
                      {item.domain}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--text-muted)]">
                      {item.url}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--text-muted)]">
                      {senderName(item.senderId)}
                      {item.createdAt && ` · ${formatTime(item.createdAt)}`}
                    </span>
                  </button>
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={() =>
                        window.open(item.url, "_blank", "noopener,noreferrer")
                      }
                      aria-label="Open link"
                      title="Open link"
                      className="flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]"
                    >
                      <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={() => jump(item.messageId)}
                      aria-label="Jump to message"
                      title="Jump to message"
                      className="flex size-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-base)] hover:text-[var(--text-primary)]"
                    >
                      <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* In-drawer image viewer */}
      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={viewing.fileName}
          className="absolute inset-0 z-10 flex flex-col bg-black/90"
        >
          <div className="flex h-14 shrink-0 items-center justify-between px-4">
            <p className="min-w-0 flex-1 truncate text-[13px] text-white/80">
              {viewerIndex + 1} of {media.length} · {viewing.fileName}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <a
                href={viewing.url}
                download={viewing.fileName}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Download image"
                className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Download className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => jump(viewing.messageId)}
                aria-label="Jump to message"
                title="Jump to message"
                className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewerIndex(null)}
                aria-label="Close viewer"
                className="flex size-9 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            {media.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setViewerIndex((i) => (i - 1 + media.length) % media.length)
                }
                aria-label="Previous image"
                className="absolute left-2 z-10 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <img
              key={viewing.fileId}
              src={viewing.url}
              alt={viewing.fileName}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
            {media.length > 1 && (
              <button
                type="button"
                onClick={() => setViewerIndex((i) => (i + 1) % media.length)}
                aria-label="Next image"
                className="absolute right-2 z-10 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
          {isMobile && (
            <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />
          )}
        </div>
      )}
    </section>
  );
}

export default ChatMediaDrawer;
