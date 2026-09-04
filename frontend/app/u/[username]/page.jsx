import { notFound } from "next/navigation";
import { defaultOgImage, SITE_NAME } from "@/lib/seo";
import { PublicProfileView } from "./public-profile-view";

// The Next.js rewrites in next.config.mjs proxy /api/v1 to the Express backend;
// this server component fetches that same backend directly so public profile
// pages are server-rendered for crawlers and logged-out visitors. Same env var
// next.config.mjs reads, so it follows the project's existing configuration.
const BACKEND_BASE = process.env.BACKEND_URL || "http://localhost:4000";

// Public-safe decode of the route segment ("@"-style usernames are plain
// [a-zA-Z0-9_]; anything that fails to decode is simply not a valid profile).
function safeUsername(raw) {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    return /^[a-zA-Z0-9_]{1,64}$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

async function fetchPublicProfile(username) {
  try {
    const res = await fetch(
      `${BACKEND_BASE}/api/v1/users/${encodeURIComponent(username)}/profile`,
      { headers: { Accept: "application/json" }, next: { revalidate: 60 } },
    );
    if (res.status === 404) return { status: "missing", profile: null };
    if (!res.ok) return { status: "unavailable", profile: null };
    const json = await res.json();
    if (!json?.data) return { status: "unavailable", profile: null };
    return { status: "ok", profile: json.data };
  } catch {
    // Backend unreachable at render time — fall back to the client-side fetch
    // inside PublicProfileView instead of mislabeling the profile as missing.
    return { status: "unavailable", profile: null };
  }
}

function plain(s) {
  return (s || "").toString().replace(/\s+/g, " ").trim();
}

function truncate(s, max) {
  const t = plain(s);
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

export async function generateMetadata({ params }) {
  const { username: raw } = await params;
  const username = safeUsername(raw);
  if (!username) {
    return { title: "Profile not found — Kivo", robots: { index: false } };
  }

  const { status, profile } = await fetchPublicProfile(username);

  if (status === "missing") {
    return { title: "Profile not found — Kivo", robots: { index: false } };
  }

  // Backend hiccup at render time: emit username-based metadata (indexable —
  // the profile may exist and the client retries below) rather than noindexing
  // a transient outage.
  const displayName = profile?.displayName || username;
  const title = `${truncate(displayName, 26)} (@${username}) — ${SITE_NAME}`;
  const avatarUrl = profile?.avatarUrl?.startsWith("http")
    ? profile.avatarUrl
    : null;
  const bio = plain(profile?.bio);
  const description = bio
    ? truncate(bio, 150)
    : `Join ${displayName} (@${username}) on Kivo — a realtime chat app for DMs, group chats, and community Spaces.`;

  const ogImage = avatarUrl
    ? [
        {
          url: avatarUrl,
          width: 512,
          height: 512,
          alt: `${displayName} on Kivo`,
        },
      ]
    : [defaultOgImage()];
  const twitterImage = avatarUrl || defaultOgImage().url;

  return {
    title,
    description,
    alternates: { canonical: `/u/${username}` },
    robots: { index: true, follow: true },
    openGraph: {
      type: "profile",
      url: `/u/${username}`,
      siteName: SITE_NAME,
      title,
      description,
      locale: "en_US",
      images: ogImage,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [twitterImage],
    },
  };
}

export default async function PublicProfilePage({ params }) {
  const { username: raw } = await params;
  const username = safeUsername(raw);
  if (!username) notFound();

  const { status, profile } = await fetchPublicProfile(username);
  if (status === "missing") notFound();

  return (
    <PublicProfileView
      username={username}
      serverProfile={status === "ok" ? profile : null}
    />
  );
}
