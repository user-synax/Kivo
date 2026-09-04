// Central SEO constants. SITE_URL is used for metadataBase, canonical URLs,
// robots.txt and sitemap.xml. Override per environment with
// NEXT_PUBLIC_SITE_URL when the app is not served from kivo.usersynax.dev.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://kivo.usersynax.dev";

export const SITE_NAME = "Kivo";

export const SITE_TAGLINE = "Chat your way";

export const SITE_DEFAULT_TITLE = `${SITE_NAME} — ${SITE_TAGLINE}`;

export const SITE_DESCRIPTION =
  "Free realtime chat app for private DMs, group chats, and Discord-style community Spaces — with themes, push notifications, and an offline-ready PWA. Chat your way.";

// Default share card served from /public/og-image.png (1200×630).
// Returns a FRESH object on every call: Next.js compares metadata by
// reference across statically-prerendered segments, so a single shared const
// makes per-page og:image tags silently vanish (observed on /docs, /terms…).
export function defaultOgImage() {
  return {
    url: "/og-image.png",
    width: 1200,
    height: 630,
    alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
  };
}

export const AUTHOR = {
  name: "Ayush",
  // Solo developer & founder of Kivo.
  url: "https://github.com/user-synax",
};
