// Social link helpers shared by the profile page and edit modal. Each entry
// maps a stored profile field to a public URL. X/GitHub/Instagram store bare
// handles (like the existing githubUsername field); YouTube and the personal
// website store full http(s) URLs (validated server-side).

// Per-platform field key -> { id, label, icon-handle, hint, placeholder,
// valueBuilder }. Handles are trimmed of an accidental leading @ before the
// URL is built so pasting "@elonmusk" still works.
function cleanHandle(value) {
  return String(value || "")
    .replace(/^@/, "")
    .trim();
}

const PLATFORMS = [
  {
    id: "githubUsername",
    label: "GitHub",
    glyph: "github",
    hint: "Username — shows your contribution graph.",
    placeholder: "username",
    build: (v) =>
      v ? `https://github.com/${encodeURIComponent(cleanHandle(v))}` : null,
    title: (v) => (v ? `GitHub · @${cleanHandle(v)}` : "GitHub"),
  },
  {
    id: "xUsername",
    label: "X (Twitter)",
    glyph: "x",
    hint: "Username (no @).",
    placeholder: "username",
    build: (v) =>
      v ? `https://x.com/${encodeURIComponent(cleanHandle(v))}` : null,
    title: (v) => (v ? `X · @${cleanHandle(v)}` : "X"),
  },
  {
    id: "instagramUsername",
    label: "Instagram",
    glyph: "instagram",
    hint: "Username (no @).",
    placeholder: "username",
    build: (v) =>
      v ? `https://instagram.com/${encodeURIComponent(cleanHandle(v))}` : null,
    title: (v) => (v ? `Instagram · @${cleanHandle(v)}` : "Instagram"),
  },
  {
    id: "youtubeUrl",
    label: "YouTube",
    glyph: "youtube",
    hint: "Full channel link (https://youtube.com/@…).",
    placeholder: "https://youtube.com/@channel",
    build: (v) => (v ? v.trim() : null),
    title: () => "YouTube",
  },
  {
    id: "websiteUrl",
    label: "Website",
    glyph: "globe",
    hint: "Full link (https://…).",
    placeholder: "https://example.com",
    build: (v) => (v ? v.trim() : null),
    title: () => "Website",
  },
];

// Profile -> ordered list of { id, label, glyph, url, title } for the fields
// the user actually filled in. Tolerates null/undefined (profile pages render
// before the fetch resolves), returning an empty list in that case.
export function socialLinksFor(profile = {}) {
  const p = profile || {};
  const out = [];
  for (const def of PLATFORMS) {
    const raw = p[def.id];
    if (!raw) continue;
    const url = def.build(raw);
    if (url) {
      out.push({
        id: def.id,
        label: def.label,
        glyph: def.glyph,
        url,
        title: def.title(raw),
      });
    }
  }
  return out;
}

// Convenience: has the user configured any social link (excluding the GitHub
// contribution-graph field)? Used to hide the whole section when empty.
export function hasSocialLinks(profile = {}) {
  return Boolean(
    profile.xUsername ||
      profile.instagramUsername ||
      profile.youtubeUrl ||
      profile.websiteUrl,
  );
}

// The GitHub field is special (drives the contribution graph), so the edit
// modal keeps its own input next to it. This exposes the ordered list for the
// remaining social fields + GitHub together, for rendering inputs.
export function socialFieldDefs() {
  return PLATFORMS;
}

// Brand glyphs as tiny inline SVGs (lucide dropped brand icons). stroke-based
// shapes match lucide's look so they sit naturally next to lucide icons.
const GLYPHS = {
  github: (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-[15px] w-[15px]"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.69 1.25 3.34.95.1-.74.4-1.25.72-1.53-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.35.77 1.05.77 2.12v3.14c0 .3.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  ),
  x: (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-[15px] w-[15px]"
    >
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z" />
    </svg>
  ),
  instagram: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[15px] w-[15px]"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  ),
  youtube: (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-[15px] w-[15px]"
    >
      <path d="M23.5 7.2a3 3 0 0 0-2.1-2.13C19.5 4.55 12 4.55 12 4.55s-7.5 0-9.4.52A3 3 0 0 0 .5 7.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.13c1.9.52 9.4.52 9.4.52s7.5 0 9.4-.52a3 3 0 0 0 2.1-2.13A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-4.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
    </svg>
  ),
  globe: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[15px] w-[15px]"
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M2.5 12h19M12 2.5c2.7 2.4 4.1 5.7 4.1 9.5s-1.4 7.1-4.1 9.5c-2.7-2.4-4.1-5.7-4.1-9.5S9.3 4.9 12 2.5Z" />
    </svg>
  ),
};

export function SocialGlyph({ glyph, className = "" }) {
  const node = GLYPHS[glyph];
  if (!node) return null;
  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      {node}
    </span>
  );
}
