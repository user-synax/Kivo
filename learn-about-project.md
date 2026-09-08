# Learn about Kivo 💬

**Kivo ("Chat your way") is a free, real-time chat app for the web** — the kind you open in a browser or install to your home screen — that blends two styles of chatting you already know:

| Style | Like | What it means in Kivo |
|---|---|---|
| Private & group messaging | 📱 WhatsApp | 1-to-1 **DMs** and small private **Groups** |
| Community chat | 🛰️ Discord | **Spaces** with **channels**, roles, and discovery |

Everything in it updates **live** — messages, typing indicators, online status, read receipts — without ever refreshing the page. And on top of that sits a deep **customization system** (themes, colors, wallpapers, bubble styles) that goes far beyond a light/dark toggle.

> 🎓 **Honest framing:** Kivo is a **student project** — built by one person (Ayush) as a full-stack learning journey, not a company product. That said, the messaging core is **fully functional** and meant to be used by real people for real conversations. Live at **[kivo.usersynax.dev](https://kivo.usersynax.dev)** · Open source on **[GitHub](https://github.com/user-synax/Kivo)**.

This document explains the project for **anyone** — no coding knowledge required for the first half. The second half peels the layers back for the curious. By the end you'll know what Kivo is, how to use it, how it works under the hood, and *why* it was built this way and not some other way.

---

## 📑 Contents

1. [What can you do with Kivo?](#-what-can-you-do-with-kivo)
2. [How it works — the 30-second version](#-how-it-works--the-30-second-version)
3. [The journey of a message](#-the-journey-of-a-message)
4. [How each feature actually works](#-how-each-feature-actually-works)
5. ["How this, not that" — design decisions explained](#-how-this-not-that--design-decisions-explained)
6. [Under the hood (for the curious)](#-under-the-hood-for-the-curious)
7. [Run it yourself](#-run-it-yourself)
8. [What's *not* in Kivo (yet)](#-whats-not-in-kivo-yet)
9. [Glossary](#-glossary)
10. [Where to learn more](#-where-to-learn-more)

---

## ✨ What can you do with Kivo?

Think of Kivo as one app with three kinds of conversation:

### 1. Direct messages (DMs) — private 1:1 chats
- Add someone by **username, email, or display name**, or become friends first.
- See when they're **online** (green dot) or "active 5m ago" when not.
- Messages show **sent → delivered → read** ticks; tap the ticks to see a **"Seen by"** card with exact times.

### 2. Groups — private chats for a small circle
- Create a group (you + at least two friends), name it, give it a photo.
- **Admins** can add/remove members and promote other admins.
- College project team? Gaming squad? That's what groups are for.

### 3. Spaces — communities with channels
- A **Space** is like a Discord server: it contains **channels** (text channels anyone in the Space can post in, and **announcement** channels only admins can post in).
- Roles: **owner → admin → moderator → member**, all enforced by the server.
- **Public Spaces** appear in Discover — browse by category (Technology, Gaming, Art…) and join in one click. **Private Spaces** are hidden and joinable only via a rotating **invite link** that expires after 7 days.
- Owners/admins can even give a Space its own colors and chat wallpaper.

### And on every conversation…
- 📎 **Attachments** — up to 10 images/PDFs/documents per message (30 MB each), plus **voice messages** (hold the mic, release to send).
- ↩️ **Reply, react (270+ emojis), edit, delete, forward, pin, save** — right-click (or long-press on mobile) any message.
- 🧵 **Threads** — a quiet side-conversation attached to any message that doesn't spam the main chat.
- ✍️ **Typing indicators, @mentions, drafts that survive reloads, swipe-to-reply on mobile.**
- 🔎 **Ctrl+K global search** across messages, people, and Spaces — with jump-to-message.
- 🔗 **Link previews** — the first link in a message unfurls a card with the page's title and image.
- 🖼️ **Shared media gallery** — every image, file, and link from a chat in one drawer.

### And for *you* personally…
- 🎨 **10 themes** (6 dark, 4 light) that switch live with no reload — plus a **theme studio** to recolor any theme's accent and canvas tone, saved to your account.
- 👤 A **public profile page** at `/u/yourname` — avatar, banner, bio, status emoji, country flag, GitHub contribution graph, social links, and a **Wave 👋** button for visitors. Share it with a **QR code**.
- 🔔 A **notification center** with per-category preferences and sounds — plus **push notifications** to your device even when the app is closed.
- 📱 An **installable app (PWA)** — works on phone and desktop, keeps your recent chats available offline, and **queues messages you send while offline** to deliver automatically on reconnect.
- 📞 **Voice & video calls** in DMs and groups (ring, join, mute, camera, group grid, call history with "Call back").
- 🔐 **Serious security**: optional **two-factor authentication** (authenticator app + backup codes), **Google/GitHub sign-in**, password reset that logs out every device, and blocking.

---

## 🧭 How it works — the 30-second version

Every chat app is a relay race between your device and a server. Kivo looks like this:

```
Your browser
   │
   │  (1) Loads the app once — the screens, buttons, themes
   ▼
Next.js frontend  ──(2) saves & fetches data over REST──►  Express backend  ──►  MongoDB
   │                                                            │                 (the database:
   └────────(3) a live, always-open Socket.IO wire──────────────┘                  every user, message,
                "new message!", "typing…", "online", receipts                      conversation, Space)
```

- The **frontend** (Next.js) is the app itself — what you see and click. It runs in your browser.
- The **backend** (Express) is the referee and the memory — it checks who you are, validates everything you send, applies the rules (are you in this conversation? are you allowed to rename this Space?), and stores the truth.
- **MongoDB** is the filing cabinet — the single source of truth. If the server restarts, nothing is lost.
- **Socket.IO** is the party line — a live connection that stays open so the server can *push* events to everyone instantly, instead of apps constantly asking "anything new?" (that asking is called *polling*, and Kivo doesn't do it).

One more rule to remember: **MongoDB is the authority; Socket.IO only announces**. A message counts as sent only when it's in the database. The live wire just spreads the news.

---

## ✉️ The journey of a message

What actually happens when you type *"hey!"* and press Enter?

1. **Instant echo (optimistic UI).** The bubble appears in your chat *immediately*, marked with a clock/send state. Kivo doesn't wait for the server — it *assumes* success so the app feels instant. If the send later fails, the bubble gets a retry button.
2. **The request goes out.** Your browser sends `POST /api/v1/conversations/:id/messages` with the text (max 4000 characters) and a tiny **JWT access token** that proves who you are (valid for 15 minutes, kept fresh automatically behind the scenes).
3. **The backend checks everything, in order:**
   - *Who are you?* — verify the token (authentication).
   - *Is it well-formed?* — every piece of the request is checked against strict rules with **Zod** (validation). The client is **never trusted**.
   - *Are you allowed?* — are you actually a member of this conversation, or are you muted/banned? (authorization).
   - *Slow down* — rate limits (e.g. 40 messages/minute) keep spam and abuse out.
4. **It's saved.** The message is written to MongoDB, stamped with sender, time, mentions, and any attachments.
5. **The news spreads.** The server emits a `message:new` event over Socket.IO into the conversation's **room** — every participant's app receives it in milliseconds and the bubble pops into their chat with a sound or notification (if their preferences allow).
6. **Receipts flow back.** Each recipient's app quietly reports "delivered" and, when they open the chat, "read up to here" — which flips your ticks from sent → delivered → read.
7. **Notifications fan out.** For anyone offline, the backend queues a **web push notification** through the browser's push service, so their phone/desktop pings even with Kivo closed.
8. **The exception proves the rule — offline sending.** If *your* internet drops mid-typing, your message goes into a durable **outbox** in your browser. It survives reloads and flies out automatically the moment you're back online.

That's the whole trick: *instant paint, verified truth, instant delivery, quiet catch-up*.

---

## ⚙️ How each feature actually works

### 🔴 Realtime (Socket.IO)
- When you open Kivo, your browser opens one **WebSocket** connection and authenticates it with your JWT during the handshake. Banned users are rejected right there.
- The server puts your connection into **rooms** — one per conversation and Space you belong to. "Rooms" are just broadcast groups: sending an event to `conversation:123` reaches exactly the people who belong to conversation 123, and nobody else.
- **Presence** (online/offline dots) is broadcast *only to people who share a chat or Space with you* — the whole internet isn't told when you log in. A ~12-second grace period stops the dot from flickering when your connection hiccups.
- **Typing indicators** are tiny `typing:start` / `typing:stop` events — no data stored, pure signaling.
- **Reconnect gap-fill:** after your connection drops and returns, the app asks "what did I miss?" — it refetches the conversation list and pulls only messages *newer than the newest one it already has*. Nothing is lost while you were offline, and no full re-download happens.

### 🔔 Notifications & sounds
- The in-app **bell** collects DMs, group/Space messages, mentions, friend requests, and waves. Every notification is a row in MongoDB with per-user **preferences** (you can mute whole categories; **@mentions always get through**).
- **Smart suppression:** if the DM is already open on your screen, the server skips the notification for it — the app tells the server "I'm focused on this chat" (`conversation:focus`).
- **Push when closed:** the browser's Push service (VAPID) delivers native notifications to offline users; dead subscriptions are cleaned up automatically. Clicking one deep-links into that exact conversation.
- **Sounds** are synthesized in your browser with the Web Audio API — there are no sound files to download, and each category has its own toggle.

### 🌍 Offline mode & PWA
- On first visit, a **service worker** (a small script that lives in your browser) caches the app shell, so Kivo opens even with a bad connection and shows a styled offline page when there's no network at all.
- Your conversation lists and the **latest 50 messages per chat** are cached in **IndexedDB** (a small database built into the browser) — that's why reopening Kivo paints instantly while fresh data streams in.
- Text sent offline rides the **outbox** (see step 8 above). Attachments still need a connection.

### 🎨 Themes & customization (the signature feature)
- Every color in Kivo is a **CSS variable token** (canvas, surface, ink, accent, hairline…). A "theme" is just one object of values that restyles *everything* — no component is ever repainted by hand.
- **10 presets** ship in, six dark (Framer — the default near-black + blue, Midnight, Graphite, Espresso, Pine, Plum) and four light (Porcelain, Linen, Mist, Sage). Switching is instant because only variables change.
- The **theme studio** lets you recolor the accent and wash the canvas of any preset — saved to *your account*, so your colors follow you across devices. Contrast is preserved automatically.
- **Per-Space palettes:** a Space's owners can give it its own look that every member sees *while viewing that Space*. Per-chat **wallpapers** (dots/grid/lines/bubbles/wash) and **bubble styles** resolve in a priority order: conversation → Space → your personal choice, with a "member's own" opt-out.
- Even **public profiles wear their owner's theme colors** for visitors.

### 🏠 Spaces, roles & invites
- Roles are checked **server-side, by rank**: owner → admin → moderator → member. A moderator cannot promote anyone; only the owner can create new admins or delete the Space; the last owner can never be demoted or left stranded.
- Each channel is backed by its own conversation, so channels have independent history, unread counts, and receipts.
- **Private Spaces** generate a single rotating invite link (7-day expiry). Codes are never exposed through the API — only to owners/admins who manage them.

### 📁 Files, images & voice
- Uploads go from your browser → backend (validated: **allow-listed file types only**, 30 MB cap) → **Appwrite Storage** (a separate file-hosting service — Kivo never stores blobs in the database). Each user has avatars in one bucket and attachments in another.
- **Voice messages** are recorded in your browser with `MediaRecorder`, uploaded as a normal audio attachment, and played back by the person receiving. The only extra data is the duration, stamped at record time so bubbles show "0:12" before the audio even loads.
- **Link previews are fetched by the *server*, never your browser** — so no website you paste can see your IP. The server reads the page's metadata, guards against tricks (SSRF protection), and caches each URL for an hour.

### 📞 Voice & video calls
- Calls run on **LiveKit** (a dedicated real-time media network) — chat servers are bad at streaming audio/video, so Kivo delegates.
- There's *no call state stored on Kivo's server*: rooms are named deterministically per conversation (`kivo_<conversationId>`), so everyone — including late joiners — lands in the same room. The only server memory is a 30-second "ringing" timer that turns into a missed call.

### 👤 Accounts, security & trust
- **Passwords** are hashed with bcrypt (12 rounds) — even the database can't read them.
- **Sessions:** a 15-minute access token (in the request header) + a refresh cookie that is `httpOnly` (JavaScript can't touch it) and backed by a real **Session** row in the database — which means "log out everywhere" and "admin bans user" *actually* revoke access, instantly.
- **2FA** (optional): standard TOTP authenticator codes with one-time backup codes. Login becomes two steps.
- **OAuth:** sign in with Google or GitHub; existing accounts auto-link by email; linking *both* providers earns the native **Kivo Verified** badge automatically.
- **Blocking** is enforced server-side — blocked users can't DM, wave, or see you in search, and the friendship is removed.
- **Everything is validated and rate-limited** at the boundary, security headers are on (Helmet), and errors never leak stack traces or secrets.
- **Admin panel** (`/admin`): ban/unban, delete rogue groups/Spaces, grant the **Kivo Plus** plan, and every action lands in an audit log.

### 👑 Kivo Plus
An entitlement *scaffold* (no payments): an admin can flip your account to the `plus` plan, unlocking **custom banner uploads** and **profile effects** (glow, gradient name, aura). Downgrade resets everything. Free users are forced back to defaults *by the server*, not the UI.

---

## 🤔 "How this, not that" — design decisions explained

This is the part most projects never explain. Each choice here was made *against* an alternative:

| Decision | Why *this* and not that |
|---|---|
| **WhatsApp + Discord in one identity** | People already live in both styles. Kivo's bet: one login for *private* circles (DMs/groups) *and* *public* communities (Spaces), instead of carrying two apps. |
| **MongoDB is the only truth; Socket.IO only announces** | If realtime events were the source of truth, a server restart would erase conversations. Instead the database write happens first, the announcement second — events are disposable. |
| **No Redis (yet)** | Redis would add speed for rate-limiting and presence *at scale*, but Kivo runs on one server instance today. In-memory limits and presence are simpler and good enough — the docs explicitly say: don't add Redis before it's actually needed. |
| **One codebase, three apps (web / backend / mobile folder)** | A monorepo with plain folder separation — no microservices, no package-publishing ceremony. Simple architecture beats premature abstraction. |
| **JavaScript only — no TypeScript** | A deliberate project constraint to keep the learning surface focused; strictness comes instead from Zod validation at every server boundary. |
| **Messages in their own collection** | Not embedded as an array inside conversations (which would grow unbounded). Own collection = indexed queries, cursor pagination, and threads that are just messages with a `threadId`. |
| **Threads are "structurally quiet"** | Thread replies never bump unread badges or ring the bell (only @mentions do). Chosen on purpose so side-discussions don't punish the main timeline. |
| **Pins & saves are fields on the message, not separate tables** | Toggling a pin is one tiny update; the pinned banner is one indexed query. No extra collection to keep in sync. |
| **Link previews unfurl server-side** | Client-side unfurling would leak users' IPs to every pasted website and cause mixed-content errors. One server fetch per URL, cached an hour. |
| **Calls have no server-side call state** | Deterministic room names per conversation mean reconnects and late joins "just work" with zero call database. The server only remembers a ringing timer. |
| **Optimistic UI everywhere** | Waiting for a round-trip before showing your own message is why old chat UIs felt laggy. Paint first, reconcile when the server confirms, retry on failure. |
| **Composer drafts in localStorage, not the database** | Unsent text is device-local ephemera — syncing half-typed sentences to an account would be over-engineering. |
| **Notifications: bulk insert + fire-and-forget push** | The sender's request doesn't wait on hundreds of push deliveries; notifications fan out in one database insert and push goes async. |

---

## 🔬 Under the hood (for the curious)

### The data model (simplified)

| Model | What it holds |
|---|---|
| **User** | email, username, display name, bio, status, avatar/banner, country, social links, `plan` (free/plus), 2FA secrets, blocked users, notification preferences, appearance (accent, tint, wallpaper, bubble style) |
| **Session** | one row per refresh token, with an expiry date — deleting the row *is* logging out |
| **Conversation** | type `dm` / `group` / `space_channel`, participants, admins, per-chat look |
| **Message** | content (4000), sender, reply/thread links, reactions, `readBy`/`deliveredTo` receipts, mentions, embedded attachments, `pinnedAt`, `savedBy`, forwarding attribution |
| **FriendRequest** | from → to + status (an accepted row *is* the friendship) |
| **Space** | embedded members with roles, embedded channels, category, visibility, invite code |
| **Notification** | recipient, type, delivery flags — fan-out per recipient |
| **PushSubscription** | per-user browser push endpoint |
| **AdminActionLog** | who banned/granted/deleted what, and when |

Messages are heavily **indexed** for the ways they're read: by conversation + time, by thread, by pinned state, by who saved them, plus a text index for search.

### The API surface
Versioned REST under `/api/v1`, one mount per domain — `auth`, `users`, `friends`, `conversations`, `messages`, `spaces`, `notifications`, `push`, `attachments`, `search`, `link-preview`, `calls` — plus a separate `/api/admin`. Every backend module follows the same 4-file shape: **routes → controller → service → validation**, so navigating the code is predictable.

### The repository map

```
kivo/
├── frontend/    Next.js 16 web app (React 19, Tailwind v4, JS only)
│   ├── app/         routes: / landing, /learn, /docs, /login…, /app chat, /u/<name>, /admin
│   ├── components/  chat shell, bubbles, spaces, calls, notifications, profile, ui…
│   └── lib/         api client, themes, cache (IndexedDB), socket, drafts, push, sounds…
├── backend/     Express 5 + Socket.IO + Mongoose (JS only)
│   └── src/         modules/ (one folder per domain), models/, middleware/, socket/, lib/
├── README.md        full feature list & setup
├── docs.md          the complete user manual
├── TECH-STACK.md    architecture & every engineering decision
├── PRD.md           product requirements & API reference
└── learn-about-project.md   ← you are here
```

### The stack in plain words

| Piece | Technology | In plain words |
|---|---|---|
| Web app | **Next.js 16 + React 19** | The framework that renders the screens you interact with |
| Styling | **Tailwind CSS v4 + shadcn/ui** | Utility classes and pre-built accessible widgets |
| Animations | **Motion (Framer Motion)** | The smooth entrances, springs, and transitions |
| Server | **Node.js + Express 5** | The program listening for requests on the internet |
| Realtime | **Socket.IO 4** | The always-open wire that pushes events instantly |
| Database | **MongoDB (Atlas)** | The filing cabinet holding all users, chats, Spaces |
| Validation | **Zod 4** | The bouncer that rejects malformed or malicious requests |
| Auth | **JWT + bcryptjs** | Tamper-proof identity tickets + one-way password hashing |
| Files | **Appwrite Storage + Multer** | Where images, documents, and voice notes live |
| Push | **web-push (VAPID)** | Delivering notifications when the app is closed |
| Email | **Nodemailer (Gmail SMTP)** | Password-reset and verification emails |
| Calls | **LiveKit Cloud** | The audio/video rooms for voice & video calls |
| Runtime | **Bun** | The fast JavaScript runtime used to develop & run it |

---

## 🚀 Run it yourself

Prerequisites: [Bun](https://bun.sh) ≥ 1.3, a [MongoDB](https://www.mongodb.com/atlas) database, and optionally an [Appwrite](https://appwrite.io) project (file storage) + Gmail app password (emails).

```bash
# 1. Backend
cd backend
bun install
cp .env.example .env      # fill in MongoDB URI, JWT secrets, Appwrite keys…
bun run dev               # → http://localhost:4000

# 2. Frontend (new terminal)
cd frontend
bun install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
bun run dev               # → http://localhost:3000
```

For web push, generate keys with `npx web-push generate-vapid-keys`. For calls, add LiveKit credentials (call buttons stay hidden until configured). The full env-var table lives in the [README](README.md).

---

## 🚧 What's *not* in Kivo (yet)

Honesty is part of the design docs, so: no payments (Plus is admin-granted), no E2E encryption, full offline history is limited to the last 50 messages per chat, video *attachments* aren't supported (voice is), and realtime presence assumes a single server instance (scaling out needs a shared adapter). **Disappearing messages (24h/7d auto-delete) were removed 2026-09-08** — `disappearingDuration`/`expireAt` and all timer UI deleted from frontend & backend. The roadmap in the [README](README.md) tracks everything.

---

## 📖 Glossary

| Term | Meaning |
|---|---|
| **Realtime** | Data arrives the moment it's sent — no refresh, no polling |
| **WebSocket / Socket.IO** | A two-way connection that stays open between your browser and the server |
| **Room** | A broadcast group on the socket server (e.g. one per conversation) |
| **JWT** | A signed, tamper-proof token that proves who you are (valid 15 min here) |
| **httpOnly cookie** | A cookie JavaScript cannot read — used for the refresh session |
| **Optimistic UI** | Show the result instantly, confirm (or retry) when the server answers |
| **PWA** | Progressive Web App — a website installable like a native app |
| **Service worker** | A browser script that caches the app for offline use & push |
| **IndexedDB** | A small database built into browsers, used for offline caching |
| **VAPID / Web Push** | The standard that lets servers push notifications via the browser |
| **Zod** | A schema library used to validate every server input |
| **SSRF** | Server-Side Request Forgery — a trick Kivo's link-preview fetcher guards against |
| **SFU** | Selective Forwarding Unit — the media server topology LiveKit uses for calls |
| **TOTP** | Time-based one-time passwords — the standard behind authenticator apps |

---

## 🔗 Where to learn more

- **[kivo.usersynax.dev](https://kivo.usersynax.dev)** — use it live
- **/learn** on the site — this same story as a visual page
- **/docs** on the site — the step-by-step *how to use* guide
- [README.md](README.md) — complete feature list, setup, socket events
- [TECH-STACK.md](TECH-STACK.md) — architecture, data model, every engineering decision
- [docs.md](docs.md) — the full user manual
- [PRD.md](PRD.md) — product requirements & API reference
- [GitHub — user-synax/Kivo](https://github.com/user-synax/Kivo) — the source code

---

*Kivo — Chat your way. Built by Ayush as a full-stack learning journey, offered to anyone who wants a fast, personal, deeply customizable chat app.*
