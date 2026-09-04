"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";
import { domainOf } from "@/lib/links";
import { cn } from "@/lib/utils";

// Module-level cache so the same URL previewed in many bubbles (or
// re-rendered on socket events) only hits the API once per page load.
const previewCache = new Map();

function getCached(url) {
  return previewCache.get(url) || null;
}

function setCached(url, value) {
  if (previewCache.size > 200) {
    const oldest = previewCache.keys().next().value;
    if (oldest) previewCache.delete(oldest);
  }
  previewCache.set(url, value);
}

// Rich link preview card with the page's og-image, title, and description.
// Renders nothing while loading succeeds with no usable preview (matches
// WhatsApp/Telegram: plain links stay plain when unfurling fails).
export function LinkPreview({ url, className }) {
  const [preview, setPreview] = useState(() => getCached(url) || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    const cached = getCached(url);
    if (cached) {
      setPreview(cached);
      return;
    }
    let active = true;
    setFailed(false);
    apiGet(`/api/v1/link-preview?url=${encodeURIComponent(url)}`)
      .then((data) => {
        if (!active) return;
        if (data && (data.title || data.description || data.image)) {
          setCached(url, data);
          setPreview(data);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [url]);

  if (!url || failed || !preview) return null;

  const domain = preview.domain || domainOf(preview.url || url);
  const title = preview.title || domain || url;
  const image = preview.image || null;

  return (
    <a
      href={preview.url || url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "mt-2 block max-w-full overflow-hidden rounded-xl border border-[var(--border)] bg-black/5 text-left no-underline transition-colors hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10",
        className,
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Broken og-image shouldn't kill the card — drop to text-only.
            e.currentTarget.style.display = "none";
          }}
          className="aspect-[1.91/1] w-full bg-[var(--bg-elevated)] object-cover"
        />
      ) : null}
      <span className="block border-l-2 border-[var(--accent)] px-2.5 py-2">
        {preview.siteName || domain ? (
          <span className="block truncate text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {preview.siteName || domain}
          </span>
        ) : null}
        <span className="block break-words text-[13px] font-semibold leading-snug text-[var(--text-primary)] [overflow-wrap:anywhere]">
          {title}
        </span>
        {preview.description ? (
          <span className="mt-0.5 line-clamp-2 block break-words text-[12px] leading-snug text-[var(--text-muted)] [overflow-wrap:anywhere]">
            {preview.description}
          </span>
        ) : null}
        {domain ? (
          <span className="mt-1 block truncate text-[11px] text-[var(--accent)]">
            {domain}
          </span>
        ) : null}
      </span>
    </a>
  );
}

export default LinkPreview;
