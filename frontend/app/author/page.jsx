import { AuthorPage } from "@/components/author/author-page";
import { defaultOgImage } from "@/lib/seo";

export const metadata = {
  title: "Author — Kivo",
  description:
    "Meet Ayush, the self-taught full-stack web and Android developer building Kivo — real-world products with love, open source at heart.",
  openGraph: {
    type: "profile",
    url: "/author",
    siteName: "Kivo",
    title: "Author — Kivo",
    description:
      "Meet Ayush, the self-taught full-stack developer building Kivo — open source at heart.",
    locale: "en_US",
    images: [defaultOgImage()],
  },
  twitter: {
    card: "summary_large_image",
    title: "Author — Kivo",
    description:
      "Meet Ayush, the self-taught full-stack developer building Kivo — open source at heart.",
    images: [defaultOgImage().url],
  },
};

// ── Edit your details here ─────────────────────────────────────────────
// Everything on /author renders from this object. Fill in any social URL to
// show its card, leave it as "" to hide it. No other file needs editing.
export const AUTHOR = {
  name: "Ayush",
  handle: "user-synax",
  role: "Self-taught full-stack web & Android developer",
  tagline: "Building real-world products with love · Love open source",
  bio: [
    "I'm Ayush — a self-taught developer building for the web and Android. Kivo is my full-stack learning journey turned into something real people can actually use every day: DMs, groups, and community Spaces with deep customization.",
    "I care about fast, polished, honest software — realtime everything, thoughtful motion, and privacy by default. Kivo is open source, built in the open, one feature at a time.",
  ],
  // Avatar: initials are rendered with a gradient. Drop a photo in
  // /public/author.jpg and set photo: "/author.jpg" to use it instead.
  photo: "https://avatars.githubusercontent.com/u/193066302?v=4",
  initials: "A",
  location: "Building from anywhere",
  // Your Kivo username for the in-app profile link (/u/username).
  kivoUsername: "ayush",
  email: "user-synax@proton.me",
  repo: "https://github.com/user-synax/Kivo",
  socials: {
    github: "https://github.com/user-synax",
    x: "https://x.com/User_Synax",
    instagram: "https://instagram.com/user.__.ayush",
    youtube: "",
    website: "https://synax.me",
    linkedin: "https://www.linkedin.com/in/user-synax",
  },
  stack: [
    "Next.js",
    "React",
    "Express",
    "Expo",
    "MongoDB",
    "Socket.IO",
    "Android",
    "Tailwind",
    "+10 More",
  ],
};

export default function Page() {
  return <AuthorPage author={AUTHOR} />;
}
