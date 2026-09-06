import { LegalPage } from "@/components/legal/legal-page";
import { defaultOgImage } from "@/lib/seo";

export const metadata = {
  title: "Cookies — Kivo",
  description:
    "What cookies and local storage Kivo uses, why they exist, and how to manage them.",
  openGraph: {
    type: "website",
    url: "/cookie",
    siteName: "Kivo",
    title: "Cookies — Kivo",
    description:
      "What cookies and local storage Kivo uses, why they exist, and how to manage them.",
    locale: "en_US",
    images: [defaultOgImage()],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cookies — Kivo",
    description:
      "What cookies and local storage Kivo uses, why they exist, and how to manage them.",
    images: [defaultOgImage().url],
  },
};

const SECTIONS = [
  {
    id: "overview",
    title: "Overview",
    paragraphs: [
      "Kivo uses a small number of cookies and browser storage mechanisms to keep you signed in and remember your preferences. There are no advertising pixels, no analytics trackers, and no third-party cookies — Kivo only uses what is necessary for the app to work.",
    ],
  },
  {
    id: "essential-cookies",
    title: "Essential cookies",
    paragraphs: [
      "Kivo uses a single httpOnly cookie to manage your session. This cookie stores a refresh token that lets the app mint new access tokens without requiring you to sign in again every 15 minutes. It is set by Kivo's own server, marked httpOnly and secure, and is never accessible to JavaScript.",
    ],
    bullets: [
      "Purpose: keep you signed in across page reloads and tabs.",
      "Duration: lasts until you sign out, log out everywhere, reset your password, or an admin bans your account.",
      "Cannot be disabled: without this cookie the app cannot maintain a session and you would need to sign in on every page load.",
    ],
  },
  {
    id: "local-storage",
    title: "Local storage",
    paragraphs: [
      "Kivo stores a few preferences directly in your browser's localStorage. These never leave your device and are not sent to the server — they are purely for convenience.",
    ],
    bullets: [
      "Theme preference: your chosen accent color and canvas tone so the app looks the same on return.",
      "Sound toggle: whether notification sounds are on or off.",
      "Last open chat: the conversation you had open so the app can reopen it on startup.",
    ],
  },
  {
    id: "indexeddb",
    title: "IndexedDB cache",
    paragraphs: [
      "Kivo maintains an IndexedDB database in your browser that caches recent conversations and messages. This lets the app load instantly on return without waiting for the server, and provides basic offline resilience — you can read recent messages even before the connection is fully re-established.",
      "This cache is per-account and is cleared when you sign out. Clearing site data from your browser also removes it.",
    ],
  },
  {
    id: "no-tracking",
    title: "No tracking or third-party cookies",
    paragraphs: [
      "Kivo does not use Google Analytics, Facebook Pixel, or any other analytics or advertising service. There are no third-party cookies, no fingerprinting scripts, and no cross-site tracking of any kind. The only network requests your browser makes are to Kivo's own API and storage servers.",
    ],
  },
  {
    id: "managing-cookies",
    title: "Managing your cookies",
    paragraphs: [
      "Since Kivo uses only one essential cookie and local browser storage, managing them is straightforward:",
    ],
    bullets: [
      "Sign out: clears your session cookie and the per-account IndexedDB cache. Local storage preferences (theme, sounds) remain until you clear site data manually.",
      "Clear site data: removes everything — the session cookie, localStorage, and IndexedDB — and signs you out. You will need to sign in again.",
      "Browser settings: you can block cookies in your browser, but blocking the session cookie will prevent you from staying signed in.",
    ],
  },
  {
    id: "changes",
    title: "Changes to this page",
    paragraphs: [
      "If Kivo introduces new cookies or storage mechanisms (for example, if calls or threads require additional local state), this page will be updated and the Last updated date will change. For the broader picture of what data Kivo collects and why, see the Privacy page.",
    ],
  },
];

export default function CookiePage() {
  return (
    <LegalPage
      eyebrow="Cookies"
      title="Cookie policy"
      updated="September 2026"
      intro="Kivo keeps cookies to a minimum — one session cookie, a handful of local preferences, and an offline message cache. No trackers, no ads, no surprises."
      sections={SECTIONS}
    />
  );
}
