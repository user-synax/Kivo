"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar/navbar";
import { Button } from "@/components/ui/button";

export const LIVE_URL = "https://kivo.usersynax.dev";

const TOC = [
  { id: "what-is-kivo", label: "What is Kivo" },
  { id: "get-in", label: "Create an account" },
  { id: "layout", label: "The chat layout" },
  { id: "friends", label: "Friends" },
  { id: "dms", label: "Direct messages" },
  { id: "messaging", label: "Sending messages" },
  { id: "groups", label: "Group chats" },
  { id: "spaces", label: "Spaces & channels" },
  { id: "profile", label: "Profile & themes" },
  { id: "notifications", label: "Notifications & install" },
  { id: "keyboard", label: "Keyboard shortcuts" },
  { id: "not-yet", label: "Not built yet" },
];

export function DocsScreen() {
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
        href="#docs-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-pills focus:bg-ink focus:px-4 focus:py-2 focus:text-inverse-ink"
      >
        Skip to docs
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

        <main id="docs-main" className="min-w-0 flex-1">
          <header className="mb-12 max-w-[720px]">
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-pills border border-accent-blue/20 bg-accent-blue/10 px-3.5 py-1 font-sans text-[12px] font-semibold text-accent-blue">
              Guide
            </p>
            <h1 className="font-goga text-[40px] font-medium leading-[0.95] tracking-[-0.03em] text-ink sm:text-[52px]">
              How to use <span className="text-accent-blue">Kivo</span>
            </h1>
            <p className="mt-5 font-sans text-[16px] leading-[1.6] text-ink-muted sm:text-[17px]">
              Kivo is a realtime chat app: private DMs, small groups, and
              Discord-style communities. Live at{" "}
              <a
                href={LIVE_URL}
                className="kivo-focus rounded-sm font-medium text-accent-blue underline-offset-2 hover:underline"
              >
                kivo.usersynax.dev
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
                render={<a href="/login" />}
                className="h-auto min-h-11 rounded-pills border-ink/20 bg-transparent px-6 py-3 text-[15px] font-medium text-ink shadow-none hover:bg-ink/5 hover:text-ink"
              >
                Log in
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
                Kivo puts two familiar chat styles in one place: WhatsApp-like
                private messages and groups, plus Discord-like Spaces with
                channels. You pick a conversation on the left and chat in the
                middle. Everything updates live — new messages, typing, online
                status, and read receipts — without refreshing.
              </p>
              <p>
                It is a student full-stack project, built to learn real product
                engineering. It is still meant for real everyday chat: friends,
                class groups, and small communities.
              </p>
              <ul className="mt-4 grid gap-2">
                <Bullet>1:1 DMs with friends</Bullet>
                <Bullet>Private groups with admins</Bullet>
                <Bullet>Public Spaces you can discover and join</Bullet>
                <Bullet>Mentions, reactions, replies, and themes</Bullet>
              </ul>
            </Section>

            <Section id="get-in" title="Create an account">
              <p>
                Open{" "}
                <a className="kivo-focus rounded-sm font-medium text-accent-blue underline-offset-2 hover:underline" href="/signup">
                  Sign up
                </a>{" "}
                on kivo.usersynax.dev.
              </p>
              <Steps
                items={[
                  "Enter a display name, username, email, and password (at least 8 characters).",
                  "Confirm the password and submit. You land in chat at /app.",
                ]}
              />
              <p>
                Username must be unique: 3–30 characters, letters, numbers, and
                underscores. Email must be unique too.
              </p>
              <p>
                To log in later, use{" "}
                <a className="kivo-focus rounded-sm font-medium text-accent-blue underline-offset-2 hover:underline" href="/login">
                  Log in
                </a>{" "}
                with either your email or username.
              </p>
              <p>
                To log out, open your profile from the bottom of the sidebar,
                go to the full profile page, and choose Log out.
              </p>
            </Section>

            <Section id="layout" title="The chat layout">
              <p>After you sign in you see:</p>
              <ul className="mt-3 flex flex-col gap-2">
                <Bullet>
                  <strong className="text-ink">Left</strong> — DMs, groups,
                  Spaces, search, new chat, theme, and your profile.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Center</strong> — the open
                  conversation.
                </Bullet>
                <Bullet>
                  <strong className="text-ink">Right</strong> — on a wide
                  screen, the other person’s profile in a DM, or group/Space
                  settings when you open them.
                </Bullet>
              </ul>
              <p>
                On a phone you see the conversation list first. Open a chat,
                then use Back in the header to return. You can collapse the
                sidebar on desktop; Kivo remembers that, and the last chat you
                had open.
              </p>
            </Section>

            <Section id="friends" title="Friends">
              <p>
                Open the <strong className="text-ink">+</strong> menu in the
                sidebar and choose Friends. Three tabs: Requests, Friends, Add.
              </p>
              <h3 className="mt-2 font-sans text-[16px] font-semibold text-ink">Add someone</h3>
              <Steps
                items={[
                  "Go to Add and search by username, email, or display name.",
                  "Click Add on a result.",
                ]}
              />
              <p>
                You cannot friend yourself or send a duplicate request. If they
                already requested you, accepting makes you friends right away.
              </p>
              <h3 className="doc-h3">Incoming requests</h3>
              <p>
                Open Requests, then Accept or Decline. They get a notification
                when you accept.
              </p>
              <h3 className="doc-h3">Start a private chat</h3>
              <p>
                On the Friends tab, click Message. That opens an existing DM or
                creates one.
              </p>
            </Section>

            <Section id="dms" title="Direct messages">
              <p>
                DMs are 1:1. Starting chat with the same person again reuses
                the same conversation.
              </p>
              <Steps
                items={[
                  "Find them under Direct in the sidebar, or use the search field.",
                  "Click the row. Unread counts show as a badge. A green dot on the avatar means they are online.",
                ]}
              />
            </Section>

            <Section id="messaging" title="Sending messages">
              <p>
                The same composer works in DMs, groups, and Space channels.
              </p>
              <h3 className="doc-h3">Send</h3>
              <p>
                Type in “Type a message…”, then Enter to send. Shift+Enter
                adds a new line. Max 4000 characters. If a send fails, retry
                from that bubble.
              </p>
              <h3 className="doc-h3">Reply</h3>
              <p>
                Right-click (or use the message menu) → Reply. A quote preview
                sits above the composer. Send, or cancel with the X.
              </p>
              <h3 className="doc-h3">React, edit, delete</h3>
              <ul className="mt-3 flex flex-col gap-2">
                <Bullet>
                  React: message menu → React, or tap a reaction chip under the
                  bubble. Same emoji again removes yours.
                </Bullet>
                <Bullet>
                  Emoji in text: smile button next to the composer (270+
                  emojis, grouped by category).
                </Bullet>
                <Bullet>
                  Edit or delete: only your own messages. Edit saves with
                  Enter, Escape cancels. Delete clears the text but keeps the
                  row so replies stay in place. Edited messages show “edited”.
                </Bullet>
              </ul>
              <h3 className="doc-h3">Mention someone</h3>
              <Steps
                items={[
                  "Type @ then the start of their name or username.",
                  "Pick from the list (arrows, then Enter or Tab, or click).",
                ]}
              />
              <p>
                Mentions only include people in that chat. They get a
                “mentioned you” notification.
              </p>
              <h3 className="doc-h3">History, receipts, typing</h3>
              <p>
                Scroll up for older messages. Your bubbles show sent →
                delivered → read. When someone else is typing, you see it in
                the open chat. Opening a chat marks it read. System lines like
                “Admin added X” do not add to unread.
              </p>
            </Section>

            <Section id="groups" title="Group chats">
              <p>
                Groups are private rooms for a small set of people — not a
                Space.
              </p>
              <h3 className="doc-h3">Create a group</h3>
              <Steps
                items={[
                  "Sidebar + → New group (or + next to Groups).",
                  "Name it (required). Optional group photo, max 4MB.",
                  "Pick at least two friends (you plus two others).",
                  "Create. You are the first admin.",
                ]}
              />
              <h3 className="doc-h3">Manage the group</h3>
              <p>
                Open the group, then Group settings in the header. Admins can
                rename it, change the photo, add or remove members, and
                promote or demote admins. Anyone can leave. The last admin
                cannot be removed or demoted.
              </p>
            </Section>

            <Section id="spaces" title="Spaces & channels">
              <p>
                A Space is a community (like a Discord server). Inside it,
                channels are separate chat rooms.
              </p>
              <h3 className="doc-h3">Create a Space</h3>
              <Steps
                items={[
                  "Sidebar + → new Space.",
                  "Set a name. Optional: description, category, banner, and avatar (max 4MB).",
                  "Create. A #general channel is made for you. You are the owner.",
                ]}
              />
              <p>
                Categories include Technology, Design, Education, Business,
                Gaming, Community, Art, Music, Lifestyle, and Other.
              </p>
              <h3 className="doc-h3">Join a public Space</h3>
              <Steps
                items={[
                  "Sidebar + → Discover Spaces.",
                  "Search or filter by category.",
                  "Click Join. You enter as a member and get every channel.",
                ]}
              />
              <p>
                There are no invite links. Leave from Space settings; you can
                rejoin from Discover.
              </p>
              <h3 className="doc-h3">Channel types</h3>
              <ul className="mt-3 flex flex-col gap-2">
                <Bullet>
                  Text (#) — every member can post.
                </Bullet>
                <Bullet>
                  Announcement (megaphone) — only the owner and admins can
                  post.
                </Bullet>
              </ul>
              <h3 className="doc-h3">Roles</h3>
              <p>
                Owner → admin → moderator → member. Admin and above can edit
                the Space, manage members, and create or rename channels. Only
                the owner can promote someone to admin or delete the Space.
                You cannot delete the last remaining channel. If the owner
                leaves, the highest remaining member is promoted.
              </p>
            </Section>

            <Section id="profile" title="Profile & themes">
              <p>
                Click your name at the bottom of the sidebar to edit profile.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                <Bullet>Display name, unique username, bio (280), status (60)</Bullet>
                <Bullet>
                  Photo (PNG, JPEG, WebP, or GIF, max 4MB) and a color frame
                  (Lime, Blue, Rose, Amber, Violet, Ocean, Sunset, Aurora)
                </Bullet>
                <Bullet>Optional animated banner</Bullet>
              </ul>
              <p>
                Email cannot be changed here. Full profile at /app/profile
                also has Log out.
              </p>
              <h3 className="doc-h3">Themes</h3>
              <p>
                Use the theme control at the bottom of the sidebar. Switch
                live — no reload. Choice is saved in this browser.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                <Bullet>Framer — default near-black, blue accent</Bullet>
                <Bullet>Cloud — cooler, slightly blue</Bullet>
                <Bullet>Sand — warmer</Bullet>
                <Bullet>Ink — neutral near-black</Bullet>
                <Bullet>Midnight — deep navy</Bullet>
              </ul>
            </Section>

            <Section id="notifications" title="Notifications & install">
              <h3 className="doc-h3">In-app bell</h3>
              <p>
                The bell shows unread count. Open it to see DMs, group and
                Space messages, mentions, friend requests, and accepts. Click
                an item to jump to that chat. Scroll for older items. Mark all
                read clears the badge. Escape or click outside to close.
              </p>
              <p>
                You are not notified of your own messages. If a DM is already
                open in front of you, Kivo skips a notification for that DM.
              </p>
              <h3 className="doc-h3">Browser notifications</h3>
              <p>
                The first time you open the bell, the browser may ask for
                notification permission. Allow it if you want alerts when the
                tab is closed. Kivo does not prompt on first page load.
              </p>
              <h3 className="doc-h3">Install Kivo</h3>
              <ul className="mt-3 flex flex-col gap-2">
                <Bullet>
                  Chrome or Edge: install icon in the address bar, or the
                  browser menu → Install Kivo.
                </Bullet>
                <Bullet>Android: Add to Home Screen / Install app.</Bullet>
                <Bullet>iPhone: Share → Add to Home Screen.</Bullet>
              </ul>
              <p>
                Installed Kivo opens the chat app. You still need a network
                connection to send and receive messages.
              </p>
            </Section>

            <Section id="keyboard" title="Keyboard shortcuts">
              <div className="overflow-hidden rounded-cards border border-hairline">
                <table className="w-full text-left font-sans text-[14px]">
                  <thead className="bg-surface-1 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Keys</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-muted">
                    {[
                      ["Send message", "Enter"],
                      ["New line", "Shift + Enter"],
                      ["Insert mention", "Enter or Tab"],
                      ["Move mention highlight", "Arrow up / down"],
                      ["Save edit", "Enter"],
                      ["Cancel edit / close panel", "Escape"],
                    ].map(([action, keys]) => (
                      <tr key={action} className="border-t border-hairline">
                        <td className="px-4 py-3 text-ink">{action}</td>
                        <td className="px-4 py-3">
                          <kbd className="rounded-md border border-hairline bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] text-ink">
                            {keys}
                          </kbd>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section id="not-yet" title="Not built yet">
              <p>
                These are not in Kivo today. Do not expect them on
                kivo.usersynax.dev yet:
              </p>
              <ul className="mt-4 flex flex-col gap-2">
                <Bullet>Search inside messages or conversations</Bullet>
                <Bullet>Images or files attached to a message</Bullet>
                <Bullet>Voice or video calls</Bullet>
                <Bullet>Threads, pins, and saved messages</Bullet>
                <Bullet>Unfriend in the Friends window</Bullet>
                <Bullet>Private invite links for Spaces</Bullet>
                <Bullet>Using the installed app fully offline</Bullet>
              </ul>
            </Section>

            <section
              aria-labelledby="docs-cta"
              className="rounded-cards border border-hairline bg-surface-1 p-6 sm:p-8"
            >
              <h2
                id="docs-cta"
                className="font-goga text-[24px] font-medium tracking-tight text-ink"
              >
                Try it live
              </h2>
              <p className="mt-2 font-sans text-[15px] leading-[1.6] text-ink-muted">
                Open Kivo at {LIVE_URL.replace("https://", "")}, create an
                account, and start a DM or a Space.
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
                  render={<a href={LIVE_URL} />}
                  className="h-auto min-h-11 rounded-pills border-ink/20 bg-transparent px-6 py-3 text-[15px] font-medium text-ink shadow-none hover:bg-ink/5 hover:text-ink"
                >
                  Go to kivo.usersynax.dev
                </Button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

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
