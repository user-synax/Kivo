"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar/navbar";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

const LIVE_URL = "https://kivo.usersynax.dev";

const TOC = [
  { id: "what-is-kivo", label: "What is Kivo" },
  { id: "big-picture", label: "The big picture" },
  { id: "message-journey", label: "Journey of a message" },
  { id: "realtime", label: "Realtime (Socket.IO)" },
  { id: "accounts", label: "Accounts & sessions" },
  { id: "notifications", label: "Notifications & push" },
  { id: "offline", label: "Offline & PWA" },
  { id: "themes", label: "Themes & customization" },
  { id: "spaces", label: "Spaces, roles & invites" },
  { id: "files-calls", label: "Files, media & calls" },
  { id: "security", label: "The security model" },
  { id: "decisions", label: "How this, not that" },
  { id: "data-model", label: "Where your data lives" },
  { id: "stack", label: "The tech stack" },
  { id: "repo", label: "Repository map" },
];

export function LearnScreen() {
  const [active, setActive] = useState(TOC[0].id);

  useEffect(() => {
    const ids = TOC.map((t) => t.id);
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (!nodes.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActive(visible[0].target.id);
      },
      { rootMargin: "0px 0px -55% 0px", threshold: [0.15, 0.35, 0.6] },
    );

    for (const el of nodes) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#learn-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-pills focus:bg-ink focus:px-4 focus:py-2 focus:text-inverse-ink"
      >
        Skip to content
      </a>
      <Navbar />

      <div className="mx-auto flex w-full max-w-[1200px] gap-10 px-4 pb-24 pt-32 sm:px-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav
            aria-label="On this page"
            className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2"
          >
            <p className="mb-3 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              On this page
            </p>
            <ul className="flex flex-col gap-0.5 border-l border-hairline">
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={active === item.id ? "location" : undefined}
                    className={`kivo-focus -ml-px block border-l py-2 pl-3 text-[13px] leading-snug transition-colors duration-200 ${
                      active === item.id
                        ? "border-accent-blue font-medium text-ink"
                        : "border-transparent text-ink-muted hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main id="learn-main" className="min-w-0 flex-1">
          <header className="mb-12 max-w-[720px]">
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-pills border border-accent-blue/20 bg-accent-blue/10 px-3.5 py-1 font-sans text-[12px] font-semibold text-accent-blue">
              Under the hood
            </p>
            <h1 className="font-goga text-[40px] font-medium leading-[0.95] tracking-[-0.03em] text-ink sm:text-[52px]">
              How <span className="text-accent-blue">Kivo</span> works
            </h1>
            <p className="mt-5 font-sans text-[16px] leading-[1.6] text-ink-muted sm:text-[17px]">
              Kivo blends WhatsApp-style DMs and groups with Discord-style
              communities — then goes further with themes, offline support, and
              calls. This page explains how everything works, one layer at a
              time, for curious users of any background. Prefer step-by-step
              instructions? See the{" "}
              <a
                href="/docs"
                className="kivo-focus rounded-sm font-medium text-accent-blue underline-offset-2 hover:underline"
              >
                Docs
              </a>
              .
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                render={<a href="/signup" />}
                className="kivo-cta h-auto min-h-11 rounded-pills px-6 py-3 text-[15px] font-medium"
              >
                Create a free account
              </Button>
              <Button
                variant="outline"
                render={<a href={LIVE_URL} />}
                className="h-auto min-h-11 rounded-pills border-ink/20 bg-transparent px-6 py-3 text-[15px] font-medium text-ink shadow-none hover:bg-ink/5 hover:text-ink"
              >
                Try it live
              </Button>
            </div>
          </header>

          <nav
            aria-label="On this page"
            className="mb-10 rounded-cards border border-hairline bg-surface-1 p-4 lg:hidden"
          >
            <p className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              On this page
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {TOC.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="kivo-focus flex min-h-11 items-center rounded-lg px-2 text-[14px] text-ink-muted hover:bg-hover hover:text-ink"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex max-w-[720px] flex-col gap-16">
            <Section id="what-is-kivo" title="What is Kivo">
              <p>
                Kivo is a free, real-time chat app that lives in your browser
                (and installs like a native app). It puts two familiar chat
                styles under one account:
              </p>
              <ul className="mt-4 grid gap-2">
                <Bullet>
                  <strong className="text-ink">DMs &amp; groups</strong> —
                  private 1:1 and small-group conversations, WhatsApp-style
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Spaces &amp; channels</strong> —
                  moderated communities with roles, Discord-style
                </Bullet>
              </ul>
              <p>
                Everything updates live — messages, typing, online status, read
                receipts — without refreshing. On top sits a deep customization
                system: 10 switchable themes, a theme studio, per-Space
                palettes, chat wallpapers, and bubble styles.
              </p>
              <p>
                It is a student full-stack project, built by one person to learn
                real product engineering — but the messaging core is fully
                usable for real everyday conversations.
              </p>
            </Section>

            <Section id="big-picture" title="The big picture">
              <p>
                Every chat app is a relay race between your device and a
                server. Kivo has four players:
              </p>
              <FlowDiagram />
              <ul className="mt-4 grid gap-2">
                <Bullet>
                  The <strong className="text-ink">frontend</strong> is the app
                  itself — the screens, bubbles, and themes running in your
                  browser.
                </Bullet>
                <Bullet>
                  The <strong className="text-ink">backend</strong> is the
                  referee and the memory — it checks who you are, validates
                  everything, applies the rules, and stores the truth.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">MongoDB</strong> is the filing
                  cabinet — the single source of truth. A server restart loses
                  nothing.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Socket.IO</strong> is the party
                  line — one always-open connection that pushes events to
                  everyone instantly, instead of apps asking “anything new?”
                  every second.
                </Bullet>
              </ul>
              <p>
                One rule to remember: <strong className="text-ink">the
                database is the authority; the socket only announces</strong>.
                A message counts as sent only when it is safely stored — the
                live wire just spreads the news.
              </p>
            </Section>

            <Section id="message-journey" title="The journey of a message">
              <p>
                What actually happens when you type “hey!” and press Enter:
              </p>
              <Steps
                items={[
                  "Instant echo — your bubble appears immediately with a sent state. Kivo doesn't wait for the server; it assumes success so the app feels instant. If the send later fails, the bubble gets a retry button.",
                  "The request goes out — the browser POSTs the text (max 4000 characters) with a short-lived token that proves who you are.",
                  "The backend checks everything, in order: Who are you? Is the request well-formed (validated against strict rules — the client is never trusted)? Are you allowed (are you a member of this conversation)? Slow down (rate limits, e.g. 40 messages/minute).",
                  "It's saved — the message is written to the database, stamped with sender, time, mentions, and any attachments.",
                  "The news spreads — the server emits a message event into that conversation's room, and every participant's app receives it in milliseconds.",
                  "Receipts flow back — each recipient's app reports delivered, then read, flipping your ticks from sent → delivered → read.",
                  "Notifications fan out — anyone offline gets a web push notification through their browser's push service, even with Kivo closed.",
                  "The offline exception — if your internet dropped mid-typing, your message waits in a durable outbox in your browser and flies out automatically on reconnect.",
                ]}
              />
              <p>
                That is the whole trick: <strong className="text-ink">instant
                paint, verified truth, instant delivery, quiet catch-up</strong>.
              </p>
            </Section>

            <Section id="realtime" title="Realtime: Socket.IO, rooms & presence">
              <p>
                When you open Kivo, your browser opens one WebSocket connection
                and authenticates it with your token during the handshake. From
                then on, the server can push to you — and you to it.
              </p>
              <h3 className="doc-h3">Rooms</h3>
              <p>
                Your connection is placed into rooms — one per conversation and
                Space you belong to. Rooms are just broadcast groups: an event
                sent to conversation #123 reaches exactly the people in
                conversation #123, and nobody else. Banned users are rejected
                right at the handshake.
              </p>
              <h3 className="doc-h3">Presence &amp; typing</h3>
              <p>
                Online/offline dots are broadcast only to people who share a
                chat or Space with you — the whole internet isn’t told when you
                log in. A ~12-second grace period stops the dot from flickering
                when your connection hiccups. Typing indicators are tiny
                start/stop signals — nothing is stored.
              </p>
              <h3 className="doc-h3">Reconnect gap-fill</h3>
              <p>
                After your connection drops and returns, the app asks “what did
                I miss?” — it refetches the conversation list and pulls only
                messages newer than the newest one it already has. Nothing is
                lost while you were offline, and nothing is re-downloaded.
              </p>
              <h3 className="doc-h3">Read receipts</h3>
              <p>
                Each reader reports “read up to here” with a precise anchor, so
                the ticks on your messages — and the Seen-by card with exact
                times — stay accurate in DMs, groups, and Space channels alike.
              </p>
            </Section>

            <Section id="accounts" title="Accounts & sessions">
              <p>
                Signup is instant — display name, username, email, password.
                No OTP, no waiting; you land in chat immediately. Two things
                keep your account secure after that:
              </p>
              <ul className="mt-4 grid gap-2">
                <Bullet>
                  A <strong className="text-ink">15-minute access token</strong>{" "}
                  proves who you are on every request. Even if one leaks, its
                  window is minutes.
                </Bullet>
                <Bullet>
                  An <strong className="text-ink">httpOnly refresh cookie</strong>{" "}
                  silently renews it. JavaScript can’t read it, and it is backed
                  by a real session row in the database — so “log out
                  everywhere”, password reset, and admin bans revoke access
                  instantly, for real.
                </Bullet>
              </ul>
              <p>
                Optional <strong className="text-ink">two-factor
                authentication</strong> adds an authenticator-app code (plus
                one-time backup codes) as a second login step. You can also
                sign up or log in with <strong className="text-ink">Google or
                GitHub</strong> — existing accounts auto-link by email, and
                linking both providers earns the native Kivo Verified badge
                automatically. Forgot your password? A emailed reset link signs
                you out on every device at once.
              </p>
            </Section>

            <Section id="notifications" title="Notifications & push">
              <p>
                The bell collects DMs, group and Space messages, mentions,
                friend requests, and waves — each a row in the database with
                your per-category preferences applied. Mute a whole category if
                you like; @mentions always get through.
              </p>
              <ul className="mt-4 grid gap-2">
                <Bullet>
                  <strong className="text-ink">Smart suppression</strong> — if
                  the DM is already open on your screen, the server skips the
                  notification for it.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Push when closed</strong> —
                  offline users get native notifications via the browser’s push
                  service; clicking one deep-links into that exact conversation.
                  Dead subscriptions are cleaned up automatically.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Sounds</strong> — synthesized in
                  your browser with the Web Audio API. No sound files ship with
                  the app, and each category has its own toggle.
                </Bullet>
              </ul>
            </Section>

            <Section id="offline" title="Offline & the PWA">
              <p>
                Kivo is installable (Chrome/Edge install icon, Add to Home
                Screen on phones) and degrades gracefully when the network is
                gone:
              </p>
              <ul className="mt-4 grid gap-2">
                <Bullet>
                  A <strong className="text-ink">service worker</strong> caches
                  the app shell, so Kivo opens offline and shows a styled
                  offline page instead of a browser error.
                </Bullet>
                <Bullet>
                  Your conversation lists and the{" "}
                  <strong className="text-ink">latest 50 messages per chat</strong>{" "}
                  live in IndexedDB (a small database built into your browser) —
                  that’s why reopening Kivo paints instantly while fresh data
                  streams in.
                </Bullet>
                <Bullet>
                  Text you send offline rides the{" "}
                  <strong className="text-ink">outbox</strong> — a durable queue
                  that survives reloads and delivers automatically when you’re
                  back. Attachments still need a connection.
                </Bullet>
              </ul>
            </Section>

            <Section id="themes" title="Themes & customization">
              <p>
                Every color in Kivo is a CSS variable token (canvas, surface,
                ink, accent, hairline…). A theme is just one object of values
                that restyles everything — no screen is ever repainted by hand,
                which is why switching is instant and never reloads the page.
              </p>
              <ul className="mt-4 grid gap-2">
                <Bullet>
                  <strong className="text-ink">10 presets</strong> — six dark
                  (Framer is the default near-black + blue) and four light.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Theme studio</strong> — recolor
                  any preset’s accent and canvas tone; saved to your account so
                  your colors follow you across devices. Contrast is preserved
                  automatically.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Per-Space palettes</strong> — a
                  Space’s owners can give it its own look that every member sees
                  while viewing that Space’s channels.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Chat look</strong> — wallpapers
                  (dots, grid, lines, bubbles, wash) and bubble styles, resolved
                  in a priority order: this conversation → its Space → your
                  personal choice.
                </Bullet>
              </ul>
              <p>
                Even public profiles wear their owner’s theme colors for
                visitors.
              </p>
            </Section>

            <Section id="spaces" title="Spaces, roles & invites">
              <p>
                A Space is a community (like a Discord server) containing
                channels — each channel backed by its own conversation with
                independent history and unread counts.
              </p>
              <h3 className="doc-h3">Roles, enforced by rank</h3>
              <p>
                Owner → admin → moderator → member, checked server-side on
                every action. A moderator can’t promote anyone; only the owner
                creates new admins or deletes the Space; the last owner can
                never be demoted or leave the Space stranded.
              </p>
              <h3 className="doc-h3">Public vs private</h3>
              <p>
                Public Spaces appear in Discover — browse by category and join
                in one click. Private Spaces are hidden from Discover entirely
                and admit people only through a single rotating invite link
                that expires after 7 days. Invite codes are never exposed
                through the API — only to the owners and admins who manage
                them.
              </p>
            </Section>

            <Section id="files-calls" title="Files, media & calls">
              <p>
                Attachments go from your browser → backend (validated against
                an allow-list of file types, 30 MB cap, max 10 per message) →
                Appwrite Storage, a dedicated file host. Blobs never live in
                the database. Voice messages are recorded in your browser and
                ride the same upload path; the duration is stamped at record
                time so bubbles show “0:12” before the audio even loads.
              </p>
              <p>
                <strong className="text-ink">Link previews are fetched by the
                server, never your browser</strong> — so no website you paste
                can see your IP. The server reads the page’s metadata, guards
                against request-forgery tricks, and caches each URL for an
                hour.
              </p>
              <p>
                <strong className="text-ink">Calls</strong> run on LiveKit, a
                dedicated real-time media network — chat servers are bad at
                streaming audio and video, so Kivo delegates. There is no call
                state stored on Kivo’s server: rooms are named deterministically
                per conversation, so late joiners and reconnects land in the
                same call. The only server memory is a 30-second “ringing”
                timer that turns into a missed call.
              </p>
            </Section>

            <Section id="security" title="The security model">
              <p>
                Security in Kivo is a set of verifiable implementation details,
                not a marketing claim:
              </p>
              <ul className="mt-4 grid gap-2">
                <Bullet>
                  <strong className="text-ink">Passwords</strong> are hashed
                  with bcrypt (12 rounds) — even the database can’t read them.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Everything is validated</strong>{" "}
                  server-side against strict schemas — bodies, queries, and
                  route parameters. The client is never trusted.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Authorization is
                  resource-based</strong> — membership checks for chats and
                  Spaces, sender checks for edits and deletes, rank checks for
                  moderation.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Rate limiting</strong> on every
                  sensitive route (login, register, sends, uploads, search…)
                  with standard rate-limit headers.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Hardened defaults</strong> —
                  security headers, secure CORS, upload type/size allow-lists,
                  and error responses that never leak stack traces or secrets.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Blocking</strong> is enforced
                  server-side — blocked users can’t DM, wave, or find you, and
                  the friendship is removed.
                </Bullet>
              </ul>
              <p>
                A separate admin panel can ban accounts, delete rogue groups
                and Spaces, and grant the Kivo Plus plan — every action lands
                in an audit log.
              </p>
            </Section>

            <Section id="decisions" title="How this, not that">
              <p>
                The part most projects never explain. Each choice was made{" "}
                <em>against</em> an alternative:
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {DECISIONS.map((d) => (
                  <div
                    key={d.title}
                    className="flex flex-col gap-2 rounded-cards border border-hairline bg-surface-1 p-5"
                  >
                    <h3 className="font-sans text-[14px] font-semibold leading-[1.4] text-ink">
                      {d.title}
                    </h3>
                    <p className="font-sans text-[13px] leading-[1.6] text-ink-muted">
                      {d.why}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            <Section id="data-model" title="Where your data lives">
              <p>
                Nine collections carry the whole product. The interesting
                choice: messages live in their <em>own</em> collection (never as
                an unbounded array inside a conversation), heavily indexed for
                the ways they’re read — by conversation and time, by thread, by
                pinned state, by who saved them, plus a text index for search.
              </p>
              <div className="mt-4 overflow-hidden rounded-cards border border-hairline">
                <table className="w-full text-left font-sans text-[14px]">
                  <thead className="bg-surface-1 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-3">Model</th>
                      <th className="px-4 py-3">What it holds</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-muted">
                    {DATA_MODELS.map(([model, holds]) => (
                      <tr key={model} className="border-t border-hairline">
                        <td className="px-4 py-3 font-medium text-ink">
                          {model}
                        </td>
                        <td className="px-4 py-3">{holds}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Sessions are the neat part: one row per refresh token with an
                expiry date — deleting the row <em>is</em> logging out.
              </p>
            </Section>

            <Section id="stack" title="The tech stack">
              <div className="overflow-hidden rounded-cards border border-hairline">
                <table className="w-full text-left font-sans text-[14px]">
                  <thead className="bg-surface-1 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-3">Piece</th>
                      <th className="px-4 py-3">Technology</th>
                      <th className="px-4 py-3">In plain words</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-muted">
                    {STACK.map(([piece, tech, plain]) => (
                      <tr key={piece} className="border-t border-hairline">
                        <td className="px-4 py-3 text-ink">{piece}</td>
                        <td className="px-4 py-3 font-medium text-ink">
                          {tech}
                        </td>
                        <td className="px-4 py-3">{plain}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Everything is JavaScript by design, runs on the Bun runtime,
                and follows one repo layout: web frontend, backend, and a
                mobile app — no microservices anywhere.
              </p>
            </Section>

            <Section id="repo" title="Repository map">
              <p>
                One Git repository, three applications, and the docs you’re
                reading:
              </p>
              <div className="mt-4 rounded-cards border border-hairline bg-surface-1 p-5">
                <pre className="overflow-x-auto font-mono text-[12.5px] leading-[1.7] text-ink-muted">
                  {`kivo/
├── frontend/    Next.js 16 web app (React 19, Tailwind v4)
│   ├── app/         routes: / landing, /learn, /docs, /app chat…
│   ├── components/  chat shell, bubbles, spaces, calls, ui…
│   └── lib/         api client, themes, cache, socket, drafts…
├── backend/     Express 5 + Socket.IO + Mongoose
│   └── src/         modules/ (auth, messages, spaces…),
│                    models/, middleware/, socket/
├── learn-about-project.md   plain-language project guide
├── README.md                features & setup
├── docs.md                  the full user manual
├── TECH-STACK.md            architecture & decisions
└── PRD.md                   product requirements & API`}
                </pre>
              </div>
              <p>
                Every backend module follows the same four-file shape — routes
                → controller → service → validation — so navigating the code
                is predictable once you’ve seen one module.
              </p>
            </Section>

            <section
              aria-labelledby="learn-cta"
              className="rounded-cards border border-hairline bg-surface-1 p-6 sm:p-8"
            >
              <h2
                id="learn-cta"
                className="font-goga text-[24px] font-medium tracking-tight text-ink"
              >
                Now you know how it works — try it
              </h2>
              <p className="mt-2 font-sans text-[15px] leading-[1.6] text-ink-muted">
                Create an account, send a DM, join a Space, and switch a theme
                while the app is open. Everything you just read will be
                visible in the first five minutes.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  render={<a href="/signup" />}
                  className="kivo-cta h-auto min-h-11 rounded-pills px-6 py-3 text-[15px] font-medium"
                >
                  Create a free account
                </Button>
                <Button
                  variant="outline"
                  render={<a href="/docs" />}
                  className="h-auto min-h-11 rounded-pills border-ink/20 bg-transparent px-6 py-3 text-[15px] font-medium text-ink shadow-none hover:bg-ink/5 hover:text-ink"
                >
                  Read the how-to guide
                </Button>
              </div>
            </section>
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Architecture diagram — CSS-only flow: Browser → Frontend →
   Backend → MongoDB, with the Socket.IO wire looping underneath.
   ─────────────────────────────────────────────────────────── */
const FLOW_NODES = [
  { title: "Your browser", tag: "React 19", desc: "Loads the app once — screens, themes, your session" },
  { title: "Next.js frontend", tag: "App Router", desc: "The Kivo app itself: panels, bubbles, settings" },
  { title: "Express backend", tag: "REST + rules", desc: "Checks identity, validates, applies the rules" },
  { title: "MongoDB", tag: "Atlas", desc: "The filing cabinet — users, messages, Spaces" },
];

function FlowDiagram() {
  return (
    <div className="mt-4 rounded-cards border border-hairline bg-surface-1 p-4 sm:p-5">
      <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        {FLOW_NODES.map((node, i) => (
          <div key={node.title} className="contents">
            {i > 0 && (
              <div
                aria-hidden="true"
                className="flex items-center justify-center text-ink-muted"
              >
                <span className="rotate-90 font-mono text-[14px] sm:rotate-0">→</span>
              </div>
            )}
            <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-hairline bg-canvas p-3">
              <span className="inline-flex w-fit rounded-full border border-accent-blue/20 bg-accent-blue/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-accent-blue">
                {node.tag}
              </span>
              <span className="font-sans text-[13px] font-semibold text-ink">
                {node.title}
              </span>
              <span className="font-sans text-[12px] leading-[1.5] text-ink-muted">
                {node.desc}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-accent-blue/20 bg-accent-blue/5 px-4 py-3">
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-accent-blue" aria-hidden="true" />
        <p className="font-sans text-[12.5px] leading-[1.5] text-ink-muted">
          <strong className="font-semibold text-ink">Socket.IO</strong> — one
          always-open wire from the browser to the backend, pushing every
          message, typing indicator, and receipt instantly. No polling.
        </p>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   Static content for the decisions / tables sections.
   ─────────────────────────────────────────────────────────── */
const DECISIONS = [
  {
    title: "WhatsApp + Discord under one identity",
    why: "People already live in both styles. Kivo’s bet: one login for private circles (DMs, groups) and public communities (Spaces), instead of carrying two apps.",
  },
  {
    title: "The database is the truth; sockets only announce",
    why: "If realtime events were the source of truth, a server restart would erase conversations. The database write happens first, the announcement second — events are disposable.",
  },
  {
    title: "No Redis (yet)",
    why: "Redis would accelerate rate limiting and presence at scale, but Kivo runs on one server today. In-memory tracking is simpler — add the cache only when real users require it.",
  },
  {
    title: "One repo, no microservices",
    why: "A plain monorepo — frontend, backend, mobile folder. Simple architecture beats premature abstraction for a project of this size.",
  },
  {
    title: "JavaScript only — no TypeScript",
    why: "A deliberate project constraint to keep the learning surface focused; strictness comes instead from schema validation at every server boundary.",
  },
  {
    title: "Threads are structurally quiet",
    why: "Thread replies never bump unread badges or ring the bell (only @mentions do), so side-discussions never punish the main timeline.",
  },
  {
    title: "Pins & saves are fields, not tables",
    why: "Toggling a pin is one tiny update and the pinned banner is one indexed query — no extra collection to keep in sync.",
  },
  {
    title: "Link previews unfurl server-side",
    why: "Client-side unfurling would leak users’ IP addresses to every pasted website. One server fetch per URL, guarded, cached for an hour.",
  },
  {
    title: "Calls keep no server-side call state",
    why: "Rooms are named deterministically per conversation, so reconnects and late joins just work with zero call database. The server only remembers a ringing timer.",
  },
  {
    title: "Optimistic UI everywhere",
    why: "Waiting for a round-trip before showing your own message is why old chat UIs felt laggy. Paint first, reconcile when the server confirms, retry on failure.",
  },
];

const DATA_MODELS = [
  ["User", "Profile, appearance, plan, 2FA secrets, blocked users, notification preferences"],
  ["Session", "One row per refresh token — deleting the row is logging out"],
  ["Conversation", "Type (dm / group / space_channel), participants, admins, per-chat look"],
  ["Message", "Content, sender, reply & thread links, reactions, receipts, attachments, pins, saves"],
  ["FriendRequest", "From → to + status; an accepted row is the friendship"],
  ["Space", "Members with roles, channels, category, visibility, invite code"],
  ["Notification", "Recipient, type, delivery flags — fanned out per recipient"],
  ["PushSubscription", "Per-user browser push endpoint"],
  ["AdminActionLog", "Who banned, granted, or deleted what — and when"],
];

const STACK = [
  ["Web app", "Next.js 16 + React 19", "The framework that renders the screens you interact with"],
  ["Styling", "Tailwind CSS v4 + shadcn/ui", "Utility classes and pre-built accessible widgets"],
  ["Animations", "Motion (Framer Motion)", "The smooth entrances, springs, and transitions"],
  ["Server", "Node.js + Express 5", "The program listening for requests on the internet"],
  ["Realtime", "Socket.IO 4", "The always-open wire that pushes events instantly"],
  ["Database", "MongoDB (Atlas)", "The filing cabinet holding all users, chats, and Spaces"],
  ["Validation", "Zod 4", "The bouncer that rejects malformed or malicious requests"],
  ["Auth", "JWT + bcryptjs", "Tamper-proof identity tickets + one-way password hashing"],
  ["Files", "Appwrite Storage", "Where images, documents, and voice notes live"],
  ["Push", "web-push (VAPID)", "Delivering notifications when the app is closed"],
  ["Email", "Nodemailer (Gmail SMTP)", "Password-reset and verification emails"],
  ["Calls", "LiveKit Cloud", "The audio/video rooms for voice & video calls"],
  ["Runtime", "Bun", "The fast JavaScript runtime used to run it all"],
];

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-28">
      <h2 className="font-goga text-[28px] font-medium tracking-tight text-ink">
        {title}
      </h2>
      <div className="doc-body mt-4 flex flex-col gap-4 font-sans text-[15px] leading-[1.65] text-ink-muted">
        {children}
      </div>
    </section>
  );
}

function Steps({ items }) {
  return (
    <ol className="mt-1 flex flex-col gap-3">
      {items.map((text, i) => (
        <li key={text} className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface-2 font-sans text-[12px] font-semibold text-ink"
          >
            {i + 1}
          </span>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullet({ children }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent-blue"
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}
