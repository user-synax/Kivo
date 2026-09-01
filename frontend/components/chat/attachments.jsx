"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";

// ─── Format helpers ───────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType) {
  if (mimeType?.includes("pdf")) return "📄";
  if (mimeType?.includes("word") || mimeType?.includes("document")) return "📝";
  if (mimeType?.includes("excel") || mimeType?.includes("sheet")) return "📊";
  if (mimeType?.includes("powerpoint") || mimeType?.includes("presentation")) return "📑";
  if (mimeType?.includes("text")) return "📃";
  return "📁";
}

// ─── Image Grid (thumbnails in chat) ──────────────────────────────

function ImageGrid({ images, onImageClick }) {
  const count = images.length;
  if (count === 0) return null;

  if (count === 1) {
    return (
      <button
        type="button"
        onClick={() => onImageClick(0)}
        className="block w-full overflow-hidden rounded-lg border border-[var(--border)]"
      >
        <img
          src={images[0].url}
          alt={images[0].fileName}
          className="max-h-[360px] w-full rounded-lg object-contain"
          loading="lazy"
        />
      </button>
    );
  }

  if (count === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg border border-[var(--border)]">
        {images.map((img, i) => (
          <button
            key={img.fileId}
            type="button"
            onClick={() => onImageClick(i)}
            className="block overflow-hidden"
          >
            <img
              src={img.url}
              alt={img.fileName}
              className="aspect-square w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg border border-[var(--border)]">
      {images.map((img, i) => (
        <button
          key={img.fileId}
          type="button"
          onClick={() => onImageClick(i)}
          className={`block overflow-hidden ${i === count - 1 && count % 2 !== 0 ? "col-span-2" : ""}`}
        >
          <img
            src={img.url}
            alt={img.fileName}
            className={`aspect-square w-full object-cover ${i === count - 1 && count % 2 !== 0 ? "max-h-[220px]" : ""}`}
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}

// ─── Lightbox Modal (rendered via Portal, fully outside chat DOM) ─

function LightboxModal({ images, initialIndex, onClose }) {
  const [index, setIndex] = useState(initialIndex);

  const prev = useCallback(() => setIndex((i) => (i > 0 ? i - 1 : images.length - 1)), [images.length]);
  const next = useCallback(() => setIndex((i) => (i < images.length - 1 ? i + 1 : 0)), [images.length]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  const modal = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Download */}
      <a
        href={images[index]?.url}
        download={images[index]?.fileName}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute right-5 top-16 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
      >
        <Download className="h-5 w-5" />
      </a>

      {/* Prev */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-5 top-1/2 z-10 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next */}
      {images.length > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-5 top-1/2 z-10 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image — dead center */}
      <motion.img
        key={index}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        src={images[index]?.url}
        alt={images[index]?.fileName}
        className="pointer-events-auto max-h-[82vh] max-w-[82vw] select-none rounded-md object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Counter pill */}
      {images.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white/80 backdrop-blur-sm">
          {index + 1} / {images.length}
        </div>
      )}

      {/* Filename */}
      <div className="absolute bottom-5 left-5 max-w-[40%] truncate rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/60 backdrop-blur-sm">
        {images[index]?.fileName}
      </div>
    </motion.div>
  );

  return createPortal(modal, document.body);
}

// ─── Document Card (download only) ────────────────────────────────

function DocumentCard({ attachment }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 transition hover:bg-[var(--hover)]"
    >
      <span className="text-2xl">{fileIcon(attachment.mimeType)}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{attachment.fileName}</p>
        <p className="text-[11px] text-[var(--text-muted)]">{formatSize(attachment.size)}</p>
      </div>
      <Download className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
    </a>
  );
}

// ─── Attachment Bubble ────────────────────────────────────────────

export function AttachmentBubble({ attachments }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter((a) => a.kind === "image");
  const others = attachments.filter((a) => a.kind !== "image");

  return (
    <>
      <div className="mt-2 space-y-2">
        {images.length > 0 && (
          <ImageGrid images={images} onImageClick={(i) => setLightboxIndex(i)} />
        )}
        {others.map((att) => (
          <DocumentCard key={att.fileId} attachment={att} />
        ))}
      </div>

      {/* Lightbox — rendered via Portal into document.body, fully outside chat */}
      <AnimatePresence>
        {lightboxIndex !== null && typeof window !== "undefined" && (
          <LightboxModal
            images={images}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Upload Preview (composer) ────────────────────────────────────

export function UploadPreview({ files, onRemove }) {
  if (!files || files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pb-2">
      {files.map((f) => (
        <div
          key={f.id}
          className="relative flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 py-1.5"
        >
          {f.kind === "image" && f.preview ? (
            <img src={f.preview} alt={f.name} className="size-10 rounded object-cover" />
          ) : (
            <span className="flex size-10 items-center justify-center rounded bg-[var(--bg-surface)] text-lg">
              {fileIcon(f.mime)}
            </span>
          )}
          <div className="min-w-0 max-w-[120px]">
            <p className="truncate text-[11px] font-medium text-[var(--text-primary)]">{f.name}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{formatSize(f.size)}</p>
            {f.status === "uploading" && (
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--bg-base)]">
                <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${f.progress || 0}%` }} />
              </div>
            )}
            {f.status === "error" && <p className="mt-0.5 text-[10px] text-red-400">{f.error}</p>}
          </div>
          <button
            type="button"
            onClick={() => onRemove(f.id)}
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
