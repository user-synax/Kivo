import { LegalPage } from "@/components/legal/legal-page";

export const metadata = {
  title: "Terms — Kivo",
  description:
    "The rules for using Kivo: accounts, acceptable use, content, Spaces moderation, availability, and liability.",
};

const SECTIONS = [
  {
    id: "what-kivo-is",
    title: "What Kivo is",
    paragraphs: [
      "Kivo is a realtime communication app: WhatsApp-like private DMs and groups plus Discord-like Spaces with channels — with customization layered on top. These terms cover the app, the marketing site, and the Docs.",
      "Kivo is a student full-stack project run without a service-level agreement. It is built for real use, but features can change, pause, or break while they are being developed.",
    ],
  },
  {
    id: "accounts",
    title: "Accounts",
    paragraphs: [
      "You need an account to chat. Sign up with a display name, a unique username (3–30 characters: letters, numbers, underscores), a unique email, and a password of at least 8 characters. You land in the app immediately — there is no waiting step.",
    ],
    bullets: [
      "You are responsible for keeping your password secret and for everything done under your account. Use a unique password and turn on two-factor in Settings.",
      "One person per account. Usernames and display names must not impersonate others or be offensive — they can be changed in your profile.",
      "Log in with your email or username. If you forget your password, the emailed reset link expires in 1 hour and signs you out everywhere.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    paragraphs: [
      "Kivo trusts you with powerful tools — DMs, groups, public Spaces, attachments, mentions. In return, do not use Kivo to harm people, break the law, or degrade the service for everyone else.",
    ],
    bullets: [
      "No harassment, hate, threats, sexual exploitation of minors, or non-consensual intimate content — zero tolerance.",
      "No spam, scams, phishing, malware, or bulk unsolicited messages and friend requests.",
      "No uploading content you do not have the right to share, and no attachments outside the allowed types (images and documents, 30 MB each).",
      "No probing, scraping, or bypassing access controls, rate limits, invite codes, or moderation — including creating throwaway accounts to evade a ban or block.",
    ],
  },
  {
    id: "content",
    title: "Your content",
    paragraphs: [
      "You own what you send: your messages, attachments, and profile content remain yours. By using Kivo you give it the narrow license it needs to operate — hosting, copying, and delivering your content to the participants you share it with, plus generating previews and notifications.",
      "You can edit or soft-delete your own messages. Space owners, admins, and Kivo administrators may remove content or members that violate these terms, and banned accounts lose access immediately, including over active sockets.",
    ],
  },
  {
    id: "spaces-moderation",
    title: "Spaces & moderation",
    paragraphs: [
      "Spaces are community containers with embedded channels (text and announcement) and rank-based roles: owner, admin, moderator, member. Owners and admins set the Space's name, visibility, palette, channels, members, and invite links.",
      "Public Spaces are discoverable and joinable by any signed-in user. Private Spaces are hidden from discovery and joinable only through a rotating 7-day invite code managed by the Space's admins. Kivo administrators can additionally remove groups or Spaces and force-logout accounts to stop abuse; every such action is audit-logged.",
    ],
  },
  {
    id: "availability",
    title: "Availability & changes",
    paragraphs: [
      "Kivo aims to be fast and realtime, but it comes with no uptime promise. Single-instance realtime state, in-memory rate limiting, and IndexedDB caches mean brief disconnects, reconnect gap-fills, and queued offline sends are normal parts of the design — not guarantees of perfect delivery.",
      "Features on the roadmap (threads, calls, pins) are plans, not commitments, and shipped behavior is documented in the Docs rather than promised here.",
    ],
  },
  {
    id: "termination",
    title: "Suspension & termination",
    paragraphs: [
      "You can stop using Kivo at any time by logging out; removing the app or clearing site data ends your local session. Kivo may warn, suspend, or ban accounts that violate these terms, remove offending content or Spaces, and revoke sessions without prior notice where abuse is ongoing.",
      "If you believe a moderation action was a mistake, create a new account only to appeal — not to evade — or use whatever contact channel the app currently lists.",
    ],
  },
  {
    id: "disclaimers",
    title: "Disclaimers & liability",
    paragraphs: [
      "Kivo is provided as-is, without warranties of any kind — merchantability, fitness for a purpose, non-infringement, or uninterrupted availability. To the maximum extent allowed by law, Kivo is not liable for indirect, incidental, or consequential damages, including lost messages, lost data, or downtime.",
      "Where liability cannot be excluded, it is limited to the amount you paid for Kivo — which, for a free student project, is zero.",
    ],
  },
  {
    id: "changes-to-terms",
    title: "Changes to these terms",
    paragraphs: [
      "These terms will evolve as Kivo does. Material changes will bump the Last updated date above; continued use after a change means you accept it. If a change is unacceptable, stop using Kivo and log out — your cached local data can be cleared from the browser.",
    ],
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of use"
      updated="September 2026"
      intro="The short, plain version of the rules: be a decent human, respect other people's chats, and understand Kivo is a student project without uptime promises."
      sections={SECTIONS}
    />
  );
}
