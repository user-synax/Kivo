<div align="center">

<br />

<img src="https://img.shields.io/badge/status-MVP%20Development-1F6FEB?style=for-the-badge&labelColor=111" alt="MVP Development" />
<img src="https://img.shields.io/badge/Next.js%2016-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=000" alt="React" />
<img src="https://img.shields.io/badge/Express%205-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />

# 💬 Kivo

### *Chat your way.*

**A modern, realtime communication platform** blending **WhatsApp-style private & group messaging** with **Discord-inspired communities** — powered by a deep, user-controlled customization system that goes far beyond a light/dark toggle.

> 🎓 **A student project, built as a full-stack learning journey** — not a commercial product or a team effort. That said, it's **fully usable by real people** for their everyday private and group conversations.

</div>

<br />

---

## ✨ Highlights

- ⚡ **Real-time everything** — messages, typing, presence, and read receipts via Socket.IO (no polling). Missed messages are **gap-filled on reconnect**.
- 🔔 **Full notification system** — in-app notification center with a bell, per-category **notification preferences**, DM-focused suppression, and web push for offline users.
- 📱 **Progressive Web App** — installable on any device with a service worker, manifest, and offline push delivery.
- 🏠 **Discord-style Spaces & Channels** — moderated communities with text/announcement channels, role-based permissions, and realtime updates.
- 👥 **Full group chats** — private multi-person conversations with admins, member management, and moderation.
- 🔎 **Space discovery** — browse and join public communities by category or search.
- ↩️ **Reply & reactions** — quote-reply on any message, emoji reactions (270+), double-click/long-press ❤️, `@mentions`, edit (or ↑ on an empty composer), and soft-delete.
- 🔗 **Links & previews** — clickable URLs with server-fetched preview cards (title, description, og-image); day dividers across history and WhatsApp-style big emoji.
- ⬇️ **Jump-to-latest pill** — reading history never yanks to the bottom; a floating "N new" pill offers the way back.
- ✍️ **Composer that remembers** — per-chat drafts survive switches and reloads; paste screenshots straight into attachments; swipe a bubble right on mobile to reply.
- 📋 **Rich message actions** — right-click / long-press any bubble: quick reactions, **copy**, **view profile / block**, **forward with attribution**, **pin to chat**, select mode, and native **Share…** on mobile.
- ✅ **Read receipts** — tap ticks on your own message for a **Seen by** card (avatar + `Read · time` / `Delivered` per participant — DMs, groups, and Space channels; auto-flips above/below, dismiss on Escape/scroll).
- 📎 **File & image attachments** — up to 10 images/PDFs/documents per message (30 MB each) in any chat; image lightbox with navigation, inline previews, and download.
- 🎨 **10 live-switchable themes** — six dark (Framer, Midnight, Graphite, Espresso, Pine, Plum) and four light (Porcelain, Linen, Mist, Sage), persisted without a page reload.
- 👤 **Rich profiles** — display name, custom status (32 emoji chip + 6 vibe presets: Gaming/Vibing/Away/Studying/Working/Sleepy), bio, banner, avatar uploads & frames, **country flag**, **GitHub contribution graph**, and **social link chips** (GitHub/X/Instagram/YouTube/website) on a public profile page (`/u/username`) — plus a one-tap **Wave 👋** ping (20 s cooldown, `wave` notification that deep-links to the sender's profile), a **Share** sheet with **QR code** for the profile, and the page **wears the owner's theme colors** (`profile-skin.js`).
- ✅ **Verification badges** — verified users can show a badge on their public profile (toggle in Settings).
- 👑 **Kivo Plus (entitlement scaffold)** — admin-granted `free`/`plus` plan (`POST /api/admin/users/:id/plan`; no payments/stripe UI) with Plus-only profile perks: **custom banner uploads** (own GIF/image up to 8 MB, `PATCH /api/v1/users/me/banner`, auto-retires old file) and **profile effects** (`none`/`glow`/`gradient-name`/`aura` — avatar halo + animated name via `profile-effects.js` / `globals.css`). Downgrade resets effects to `none`; free users are server-forced to `none`.
- 🚫 **Blocking** — block another user from any DM or profile; **Blocked users** manager in Settings shows your list with one-tap unblock. Blocked chats are hidden and friendships are removed.
- 🤝 **Complete friends system** — send, accept, decline, **remove**, search, and jump straight into a DM.
- 📱 **Mobile-first polish** — a bottom tab bar (Chats / Groups / Spaces / Menu) with Profile, Settings, and a full-screen Appearance page behind the Menu, plus an icon-rail navigation on desktop that work beautifully from phone to XL desktop.
- 🗄️ **Offline caching** — conversations, Spaces, friends, friend requests, and the latest 50 messages per chat cached in IndexedDB for instant paint on reload.
- 🔎 **Global search (Ctrl+K)** — command palette searching messages, people, and spaces with jump-to-message support.
- 🛡️ **Admin panel** — standalone `/admin` dashboard with user management, ban/unban, group & space moderation, and audit logging.
- 📴 **Offline indicator & send queue** — "You are offline" banner when both signals drop, and a durable outbox that queues your text messages offline, survives reloads, and delivers them automatically when you're back.
- 📧 **Transactional email** — forgot/reset password emails work end-to-end via Gmail SMTP; a link-based email-verification flow exists (`/verify-email`, resend API).
- 🕒 **Last online status** — "active X min/hour ago" instead of a bare offline state.
- 📬 **Mark as unread** — right-click any conversation and re-mark it unread; a "New messages" separator shows where unread hits start.
- 🔐 **Security-first** — JWT access tokens + httpOnly sessions, server-side Zod validation, rate limiting on every sensitive route, never trust the client.
- 🧵 **Optimistic UI** — messages appear instantly with sent → delivered → read states and retry on failure.

---

## 🎯 The Vision

Kivo blends two beloved messaging styles into **one unified identity**:

| Experience | Like | Description |
|---|---|---|
| **DMs & Groups** | 📱 WhatsApp | Private 1:1 and small-group conversations |
| **Spaces & Channels** | 🛰️ Discord | Community containers with text/announcement channels, moderation roles & discovery |

Kivo is **not** a Slack replacement — work-management, canvases, and enterprise tooling are intentionally out of scope. The focus is a **fast, simple, deeply personal** chat experience.

---

## 🧩 Product Model

```
Kivo
├── DMs (1:1 private conversations)            ✅ Done
├── Groups (private small-group chat)          ✅ Done
└── Spaces (community containers)              ✅ Done
    └── Channels (text & announcement)         ✅ Done
        └── Messages                           ✅ Done
            ├── Replies (quote reply)          ✅ Done
            ├── Attachments (images & docs)    ✅ Done
            └── Threads (side panel)           ✅ Done
```

---

## 👥 For Everyday Users

Although Kivo is a **student project**, the messaging core is **fully functional** — you can use it today for:

- ✉️ **Private 1:1 chats** with friends, family, or classmates
- 👥 **Group conversations** (e.g. college projects, gaming squads) with admins & member management
- 🏠 **Your own Spaces & Channels** — run a community, moderate members, and organize chat by channel
- 🔎 **Discover public spaces** by category or search and join with one click
- 🎨 **Personalizing your chat** with 10 live-switchable themes (dark & light)
- 📎 **Sharing files and images** — drag or click to upload up to 10 files (30 MB each), preview images in a lightbox, view documents inline
- 🟢 Real-time presence, typing indicators, read receipts, `@mentions`, and message replies, **forwarding & pinning**
- 📱 A **bottom tab bar** (Chats / Groups / Spaces / Menu) makes the app feel native on phones; Profile, Settings and a full-screen Appearance page open from the Menu
- 🧑‍🤝‍🧑 Public profile pages at `/u/username` — shareable, with badges, country, and GitHub activity

It's a great platform for **normal, everyday conversations** — no enterprise features needed.

---

## 🚦 Implementation Status

### ✅ Complete
- Authentication & sessions (JWT + httpOnly refresh cookie, session-backed; instant signup — no OTP)
- Email verification (link-based flow, `/verify-email` page + resend API; signup itself is instant and doesn't block chat)
- Password reset (forgot/reset password via emailed token, invalidates all sessions)
- User profiles (name, username, bio, custom status + 32 emoji chip & 6 vibe presets, banner, country, GitHub username, **X/Instagram/YouTube/website social links**, avatar upload & frames)
- **Public profile pages** (`/u/:username`) with verified badge, country flag, GitHub contribution graph, **social link chips**, **Wave 👋** button (20 s cooldown, `wave` notification), **Share sheet + QR code**, and **owner-theme skin** (`profile-skin.js`)
- **Verification badges** (admin-granted `verified`, visibility toggled by the user in Settings)
- **Blocking** (block from DMs/profiles; **Blocked users manager in Settings** — list + one-tap unblock; relationships & wave/ping respected server-side)
- Friends system (request / accept / decline / list / search / **remove**)
- DM conversations (create, list, history, unread counts — list uses a **single aggregation** for unread badges)
- Text messaging (send, **reply** + **mobile swipe-to-reply**, **@mentions**, edit, soft-delete, reactions, double-click ❤️, emoji picker, **per-message Seen-by receipts**)
- **Message actions** — right-click / long-press any bubble: quick-reaction strip, **copy**, **view profile**, **block**, reply, edit/delete (own), **forward**, **pin**, **select mode** (multi-copy/forward/delete), and native **Share…** on mobile; bubble list is **memoized** (`MessageRows`) with O(1) reply map and throttled double-tap like
- **Forwarding** — resend any message into another conversation with a **"Forwarded from @user"** attribution pill (original author kept)
- **Pinned messages** — any member pins/unpins; a pinned banner sits under the chat header, newest first (max 10), cleared by unpin or by deleting the message
- **Threads** — any message can host a side conversation: replies open in a dedicated panel (desktop drawer / mobile sheet), live "N replies" chips sit under root bubbles, and thread activity never spams the main timeline, unread badge, or notification bell (unless you're @mentioned)
- **Saved messages** — bookmark any message (menu → Save message, thread replies included); the Saved panel (bookmark icon next to search) lists them across all your chats newest-first with one-click jump-to-message
- **Group chats** (create, add/remove members, promote/demote admins, realtime updates)
- **Spaces & Channels** (create, discover, join, moderation roles, text & announcement channels)
 - **Notification system** (in-app center + sounds + bell with unread badge; **bulk `insertMany` fan-out**, fire-and-forget push)
- **Notification preferences** (per-category toggles: DMs, groups, mentions, friend requests, Space messages off by default, announcements; **mentions override muted categories**, **wave** flows as ungated lightweight ping)
- **Web Push** (PWA service worker, VAPID subscriptions, offline push delivery; expired endpoints auto-pruned)
- **Progressive Web App** (installable, manifest, service worker)
- Typing indicators & presence (realtime via Socket.IO, scoped to peers, offline grace to avoid flicker)
- **Reconnect gap-fill** (refetches conversation list + messages newer than the newest known message after every reconnect)
- Theme system (**10 themes**, 6 dark + 4 light, live switching, no reload)
- **Custom per-user colors** — theme studio in Settings: recolor any preset's accent + canvas tone, live preview, saved to your account (server-synced, follows you across devices)
- **Per-Space palettes** — owners/admins give a Space its own accent + canvas tone (Space settings); every member's chat view adopts them while viewing that Space's channels
- **Chat wallpapers & bubble styles** — six patterns (dots / grid / lines / bubbles / accent wash / plain) behind the message list plus Rounded / Pill / Squared / Outlined-mine bubbles; set per user (Appearance page → Chat look), per Space (Space settings → Space look) and per DM/group (chat header → palette icon), each with "member's own" inheritance (conversation > Space > personal)
- **Avatar rings follow your accent** — identity ring re-tints with your theme-studio color
- **Mobile UX** (Chats / Groups / Spaces / Menu bottom bar, pushed Settings & Profile screens, full-screen Appearance page, responsive panels, edge-swipe back, safe-area handling)
- **Offline caching** (IndexedDB cache for conversations, Spaces, friends, requests, and last-50 messages)
- **File & image attachments** (images + documents, max 10 files & 30 MB each per message — Appwrite storage, lightbox, inline preview)
- **Voice messages** (hold-to-record in the composer, slide up to cancel, inline play/pause player with progress + duration — recorded in-browser via MediaRecorder, stored as-is, no transcoding)
- **Global search (Ctrl+K)** — command palette with messages, people, spaces, jump-to-message
- **Admin panel** — standalone dashboard with user/group/space management, ban/unban, **Plus plan grant/revoke (`POST /api/admin/users/:id/plan`)**, audit logging
- **Offline indicator** — "You are offline" banner + composer keeps working for text
- **Offline send queue** — text sent while offline goes to a durable per-account outbox (survives reloads) and flushes automatically on reconnect/online; attachments still need a connection
- **Last online status** — "active … ago" labels for offline users in DMs & profiles
- **Mark as unread** — context menu on conversations + "New messages" separator in chat
- **Link previews** — `GET /api/v1/link-preview?url=…` unfurls og-title/description/image server-side (SSRF-guarded, 1h cache); first URL per bubble renders a card
- **Date dividers + big emoji** — Today/Yesterday/weekday/date pills; 1–3 emoji-only messages render large and chromeless
- **Jump-to-latest pill** — floating unread-count button when scrolled off the live edge; auto-scroll only pins when already at the bottom (or for your own sends)
- **Composer upgrades** — per-conversation drafts in localStorage (debounced, cleared on send), paste-image to attach, ↑-on-empty-composer edits your last message, **mobile swipe-to-reply**
- **Kivo Plus extras** — custom banner upload (8 MB, `PATCH /users/me/banner`), profile effects (4 presets, `profile-effects.js` / `globals.css`), locked state for free users
- **Wave & social links** — GitHub/X/Instagram/YouTube/Website fields on profile, `social-links.jsx` chips + brand glyphs, wave ping (`POST /notifications/:id/wave`, 20 s cooldown)
- **Two-factor authentication (2FA)** — TOTP via authenticator apps (QR setup in Settings), one-time backup codes, two-step login challenge
- Animated landing page

### 🚧 Planned / Not Started
- Voice / video calls (not wired yet — no backend or frontend)
- Re-sending a verification email automatically at signup (removed with the OTP step)

---

## 🏗️ Tech Stack

### Frontend — `/frontend`

| Technology | Purpose |
|---|---|
| **Next.js 16** (App Router) | Framework |
| **React 19** | UI library |
| **Tailwind CSS v4** | Utility-first styling |
| **shadcn/ui** + Base UI | Component primitives |
| **Motion (Framer Motion)** | Animations |
| **Socket.IO Client** | Realtime |
| **idb-keyval** | IndexedDB offline caching |
| **lucide-react** / hugeicons / react-icons | Icons |
| **Biome** | Linting & formatting |

> JavaScript only — no TypeScript, by design.

### Backend — `/backend`

| Technology | Purpose |
|---|---|
| **Node.js + Express 5** | HTTP framework |
| **Socket.IO 4** | Realtime WebSocket layer (in-memory presence, single instance) |
| **Mongoose 9** | MongoDB ODM |
| **MongoDB Atlas** | Primary database |
| **Zod 4** | Request validation |
| **JWT (jsonwebtoken)** | Authentication |
| **bcryptjs** | Password hashing (12 rounds) |
| **web-push** | VAPID web push notifications (offline delivery) |
| **nodemailer** | Transactional email (password reset, verification) via Gmail SMTP |
| **Appwrite Storage** | File storage — avatars + message attachments (separate buckets) |
| **Multer** | Multipart file upload handling (memory storage) |
| **Redis** | Planned for caching/rate limiting — **not used yet** (in-memory limiter + presence today) |

> **Runtime:** [Bun](https://bun.sh) — package manager & runtime for dev (backend `nodemon` for watch mode).

---

## 🗂️ Repository Structure

```
kivo/
├── frontend/                 # Next.js 16 app (App Router, React 19, JS only)
│   ├── app/                  # Routes: /, login, signup, verify-email, forgot/reset
│   │   │                     #   password, /app (chat), /app/profile, /u/[username],
│   │   │                     #   /docs, /admin + /admin/dashboard
│   ├── components/           # dashboard (chat shell, panels), spaces, notifications,
│   │   │                     #   profile, chat, ui, motion, navbar, admin, docs
│   ├── lib/                  # api, auth, cache, chat, theme, push, sound, spaces,
│   │   │                     #   avatar-styles, banners, countries, last-active, links,
│   │   │                     #   emoji, drafts, hooks
│   └── Design.md             # Visual design system & tokens
│
├── backend/                  # Express 5 + Socket.IO + Mongoose (JS only)
│   └── src/
│       ├── config/           # env, db, webpush config
│       ├── lib/              # appwrite client, attachment upload, email (nodemailer)
│       ├── middleware/       # auth, adminAuth, errorHandler, rateLimiter (in-memory)
│       ├── models/           # User, Session, Conversation, Message, FriendRequest,
│       │                     #   Space, Notification, PushSubscription, AdminActionLog
│       ├── modules/          # auth, users, friends, conversations, messages, spaces,
│       │                     #   notifications, push, attachments, search, link-preview, admin
│       ├── socket/           # Socket.IO init (presence, rooms), emit helpers
│       └── utils/            # errors & async handlers
│
├── README.md                 # This file
├── docs.md                   # Full features & how-to-use guide
├── PRD.md                    # Product requirements, API reference, schema
└── TECH-STACK.md             # Architecture & engineering decisions
```

Each backend module follows a clean **4-file pattern**: `*.routes.js` → `*.controller.js` → `*.service.js` → `*.validation.js` (where validation applies).

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (>= 1.3)
- [MongoDB](https://www.mongodb.com/atlas) (Atlas or local)
- [Appwrite](https://appwrite.io) account (avatar + attachment storage; optional for a bare login/chat server)
- [Gmail App Password](https://myaccount.google.com/apppasswords) for transactional email

> For web push notifications, generate VAPID keys with `npx web-push generate-vapid-keys` and add them to your backend `.env`.

### 1. Backend

```bash
cd backend
bun install

# configure environment (MongoDB + Appwrite + auth secrets)
cp .env.example .env

bun run dev   # dev (nodemon, http://localhost:4000)
bun run start # production (bun)
```

### 2. Frontend

```bash
cd frontend
bun install

# REST calls are proxied to the backend by Next.js rewrites (BACKEND_URL,
# default http://localhost:4000). Socket.IO connects directly, so point
# NEXT_PUBLIC_API_URL at the backend origin.
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local

bun run dev   # http://localhost:3000
bun run build # production build
bun run lint  # biome check
```

### Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `PORT` | backend | API/Socket.IO port (default 4000 in `.env.example`) |
| `MONGODB_URI` | backend | MongoDB connection string |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | backend | JWT signing secrets |
| `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` | backend | Token lifetimes (default `15m` / `7d`) |
| `REFRESH_COOKIE_SAMESITE` | backend | `strict` (or `lax` for cross-subdomain) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | backend | Web push (VAPID) keys for offline notifications |
| `APPWRITE_ENDPOINT` / `APPWRITE_PROJECT_ID` / `APPWRITE_API_KEY` | backend | Appwrite credentials (storage) |
| `APPWRITE_BUCKET_ID` | backend | Appwrite bucket for avatar uploads |
| `APPWRITE_ATTACHMENTS_BUCKET_ID` | backend | Appwrite bucket for message attachments (separate from avatar bucket) |
| `CORS_ALLOWED_ORIGINS` | backend | Allowed frontend origins (empty = allow any in dev) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | backend | Gmail SMTP credentials for transactional email |
| `EMAIL_FROM` | backend | "From" header for outgoing emails |
| `FRONTEND_URL` | backend | Frontend base URL used to build email verify/reset links |
| `ADMIN_EMAIL` | backend | Admin panel login email |
| `ADMIN_PASSWORD_HASH` | backend | Bcrypt hash of the admin password |
| `ADMIN_JWT_SECRET` / `ADMIN_JWT_TTL` | backend | Admin JWT signing + lifetime (default 30m) |
| `ADMIN_COOKIE_NAME` | backend | Admin cookie name (default `admin_token`) |
| `BACKEND_URL` | frontend | Backend origin used by Next.js API rewrites (default `http://localhost:4000`) |
| `NEXT_PUBLIC_API_URL` | frontend | Backend origin for the Socket.IO connection (default `http://localhost:4000`) |

> See `backend/.env.example` for the full list with comments. Never commit real secrets — `*.env` is gitignored.

---

## 🔐 Authentication Flow

```
Registration / Login
        │
        ▼
  Access Token (JWT, 15 min)  ──►  Authorization: Bearer <token>
  Refresh Token (httpOnly cookie, session-backed)
        │
        ▼
  Auto-refresh 60s before expiry  ►  single-flight dedup
        │
        ▼
  Protected routes / Socket.IO (handshake via JWT)
```

- **Registration is instant** — no OTP or verification barrier; you land in `/app`. Sessions are server-backed (`Session` documents with a TTL index).
- **GuestGate** redirects logged-in users away from `/login`, `/signup`, and the landing page.
- **AuthGate** redirects unauthenticated users from `/app/*` to `/login`.
- **Rate limits** (in-memory, per user or IP): register `5/hour` (per IP), login `10/15min`, refresh `30/60s`, forgot-password `5/5min`, reset-password `10/5min`, resend-verification `1/min`, message send `40/min`, message edit `20/min`, reactions `60/min`, friend requests `20/hour`, space/channel creation `10/hour`, attachment uploads `10/min`, global search `30/min`, link previews `30/min`, admin login `5/15min`.

### Email verification & password reset

- A **link-based email verification flow** exists: `GET /api/v1/auth/verify-email?token=…` (24h expiry, token stored hashed) and `POST /api/v1/auth/resend-verification` (authenticated, 1/min). The frontend `/verify-email?token=…` page validates tokens. Note: after the OTP step was removed, signup no longer emails a verification link automatically and there is no in-app resend banner — the endpoints remain for the flow.
- **Forgot password** (`/forgot-password`) emails the user a reset link (1h expiry). **Reset password** (`/reset-password?token=…`) sets a new password and invalidates **all** existing sessions in one go.
- All transactional email is sent over **Gmail SMTP** via `nodemailer` (see env vars below). Email sending is fire-and-forget, so signup/login never blocks on the mail server.

---

## ⚡ Realtime Events (Socket.IO)

| Event | Direction | Description |
|---|---|---|
| `message:new` | Server → Room | New message |
| `message:edited` | Server → Room | Content updated |
| `message:deleted` | Server → Room | Message soft-deleted |
| `message:pin-updated` | Server → Room | Message pinned/unpinned (banner + bubble state refresh) |
| `message:reaction` | Server → Room | Reaction added/removed |
| `message:read` | Server → Room | Marked as read (payload includes the reader's anchor + `readAt` for precise per-message receipts) |
| `message:unread` | Server → Room | Conversation marked unread (badge + separator) |
| `message:delivery-updated` | Server → Room | Delivery state changed |
| `typing:start` / `typing:stop` | Client → Room | Typing indicator (re-broadcast to others) |
| `presence:online` / `offline` | Server → Peers | Presence broadcast, scoped to people who share a conversation/space with the user |
| `presence:snapshot` | Server → Client | Online peers on connect |
| `conversation:focus` / `conversation:blur` | Client → Server | Tracks the DM the user is viewing (notification suppression) |
| `message:delivered` | Client → Server | Delivery ack for a received message |
| `conversation:member-added` / `member-removed` | Server → Room | Group membership changes |
| `conversation:updated` / `admin-changed` / `removed` | Server → Room | Group updates |
| `space:updated` / `space:member-*` / `space:channel-*` | Server → Space | Space, members & channels |
| `space:deleted` / `space:joined` / `space:removed` | Server → All | Space lifecycle |
| `notification:new` | Server → User | New in-app notification (fanned out per recipient) |

> Every connection is **authenticated** via JWT handshake (banned users are rejected at reconnect), and the server verifies conversation/space membership before accepting sensitive events. All socket rooms are joined automatically on connect. After a reconnect the client **gap-fills**: it refetches the conversation list and fetches messages newer than the newest known message in the open chat, so nothing is missed while offline.

---

## 🎨 Theme System

| Theme | Family | Feel |
|---|---|---|
| **Framer** (default) | Dark | Framer-style canvas · near-black surfaces · blue accent |
| **Midnight** | Dark | Deep navy canvas |
| **Graphite** | Dark | Cool slate, premium metallic depth |
| **Espresso** | Dark | Rich warm brown, deep tonal ramp |
| **Pine** | Dark | Deep forest green cast |
| **Plum** | Dark | Moody aubergine |
| **Porcelain** | Light | Neutral off-white canvas |
| **Linen** | Light | Warm cream canvas |
| **Mist** | Light | Cool blue-gray canvas |
| **Sage** | Light | Soft green-tinted canvas |

**Core tokens (default "Framer")**

| Token | Value |
|---|---|
| Canvas (`--bg-base`) | `#090909` (near-black) |
| Surface (`--bg-surface`) | `#141414` |
| Elevated (`--bg-elevated`) | `#1c1c1c` |
| Accent (`--accent`) | `#4ba9e1` (blue signal) |
| Text primary | `#ffffff` |
| Border (`--border`) | `#262626` (hairline) |
| Online indicator | `#22c55e` |

**Typography:** Outfit (display/headings — exposed as the `font-goga` / `font-display` tokens) · Inter (body) · system monospace for `font-mono`.

Themes share one geometry — corner radius, elevation, and layout languages are global design tokens in `globals.css`, so switching a theme only re-skims colors. Palettes apply via CSS custom properties, persist in `localStorage` under `kivo:theme`, and switch **live** with zero reload — all while respecting `prefers-reduced-motion`. The single source of truth for palette colors is `frontend/lib/theme.js`; the visual system is documented in `frontend/Design.md`. The theme picker lives in **Settings → Appearance**.

---

## 🧱 Key Features

### 📎 File & Image Attachments
- Upload images (jpg, png, gif, webp) and documents (pdf, doc/docx, xls/xlsx, ppt/pptx, txt) — **max 30 MB each, up to 10 files per message**
- Multiple attachments per message, mixed types allowed, caption optional
- Per-file upload progress indicator in the composer
- **Image lightbox** — click any image to open a fullscreen centered modal with arrow-key navigation, download, and filename label
- PDF, document, and text files render as download cards with file icon, name, and size
- Server-side MIME validation (allow-listed) and Appwrite storage in a dedicated attachments bucket

### 💬 Messaging
- Cursor-based pagination with infinite scroll (newest-first), plus `around=<messageId>` anchor fetch for jump-to-message
- Optimistic UI with sent → delivered → read states + retry on failure
- **Quote replies** with inline preview of the original message
- **`@mentions`** with autocomplete (conversation participants only) + mention notifications that override muted categories
- **Double-click / long-press a message to ❤️ it**, reactions, edit, and soft-delete
- **Rich bubble menu** (right-click / long-press) — quick emoji strip, **copy**, **view profile**, **block**, reply, edit/delete (own), **forward**, **pin**, **select mode**, and native **Share…** on mobile
- **Forwarding** — copies the message into another conversation with a "Forwarded from @user" pill (original author kept)
- **Pinned messages** — pin/unpin from the menu; a banner under the chat header lists them newest-first (max 10), cleared by unpin or by deleting the message
- **Threads** — menu → Thread (or click a reply chip) opens the side panel for that message; replies there stay out of the main timeline (no unread/notification spam, mentions still ping)
- **Saved messages** — menu → Save message bookmarks any bubble (yours, others', thread replies); the Saved panel (bookmark icon next to search in the sidebar) lists them newest-first across chats and jumps straight to the message
- 60-second message grouping & hover actions (context menu)
- **New messages separator** — a labelled divider sits where your unread messages begin (auto-clears as you read to the bottom)
- **Clickable links + preview cards** — URLs open in a new tab; the first URL per message unfurls a card with the page's og-image, title, and description (nothing renders when a page offers no preview)
- **Date dividers** — Today / Yesterday / weekday / date pills split long histories (grouping breaks across days)
- **Big emoji** — 1–3 emoji-only messages render large with no bubble (ZWJ, flags, and skin tones count as one)
- **Jump-to-latest pill** — floating button with the unread count when scrolled up; tap to return to the live edge
- **Composer drafts, paste-to-attach, ↑-to-edit** — drafts persist per chat, pasted images attach directly, ↑ on empty edits your last message
- Emoji picker — 9 categories (Smileys, People, Hearts, Animals, Food, Activity, Travel, Objects, Symbols), 270+ emojis
- Delivery & read receipts — tap the ticks on your own message for a **Seen by** breakdown (each DM/group member with read time or delivered); typing indicators
- **Reconnect gap-fill** — after the socket reconnects, missed messages are fetched and merged into the cache

### 👥 Groups
- Create private groups (you + at least 2 friends) with a name & optional avatar (4 MB)
- Add/remove members and promote/demote admins (real-time)
- Admin-only management with system notices ("Admin added X", "Y left the group")
- Prevent orphaned groups — the last admin can't be removed/demoted

### 🏠 Spaces & Channels
- Create a space with name, avatar, banner, description & category (a `#general` channel is auto-created with a backing conversation)
- Role hierarchy: **owner → admin → moderator → member** with rank-based permissions
- Text & announcement channels, each backed by its own message thread
- Admin+ create, rename, and delete channels (last channel protected)
- Full moderation — add/remove members, assign roles (admin promotion is owner-only), self-leave with auto owner promotion
- **Discovery** — browse/search **public** spaces by category, join with one click
- **Privacy & invites** — a Space can be **public** (Discover + direct join) or **private** (hidden from Discover, invite-only). Owner/admins manage a rotating invite link with a 7-day expiry in Space settings; invite links deep-link into the app and private Spaces can't be direct-joined

### 👥 Friends
- Request by username, email, or display name; search is debounced
- Accept/decline, auto-mutual on reverse requests
- Conflict-safe unique constraints (no duplicate/self-friending)
- **Remove a friend** from their profile (public page or in-app drawer)
- "Message" shortcut opens/creates the DM

### 👤 Profiles
- Display name, unique username, bio (280), custom status (60)
- **10 avatar frame presets** (Default, **My accent** — follows your theme color — Lime, Blue, Rose, Amber, Violet, Ocean, Sunset, Aurora) + real avatar upload (Appwrite, 4 MB max)
- Profile **banner** — curated animated GIF covers
- **Country** (flag shown on profile) and optional **GitHub username** (renders a contribution graph)
- **Public profile page** at `/u/<username>` — shareable with anyone; visitors get a "Join Kivo" nudge
- **Verified badge** for verified accounts (visibility toggled in Settings)
- Block/unblock and Add friend / Message / Unfriend actions on every profile

### 🔔 Notifications
- In-app notification center — a bell with an unread count badge and a dropdown list
- Covers DMs, group & Space messages (incl. announcements), mentions, friend requests & accepts; cursor-paginated with "mark all read"
- **Notification preferences** (Settings) — per-category toggles for Direct Messages, Group Messages, Mentions, Friend Requests, Space Messages (off by default), and Announcements; `@mentions` always override a muted category
- **DM-focused suppression** — if you're actively viewing a DM, notifications for it are skipped server-side
- **Sound cues** per notification category (Settings → Sounds): Direct Messages, Mentions, Group Messages, Space Messages, and Friend Requests each have their own toggle plus a one-tap preview — chimes are synthesized in-browser (Web Audio), so no audio files ship with the app
- Realtime delivery via socket (`notification:new`) with per-recipient fan-out
- **Unread dots** on the Chats/Groups/Spaces navigation icons when a category has unread activity

### 📱 PWA & Web Push
- **Installable PWA** — `manifest.json` with icons, standalone display, and a service worker (`sw.js`)
- **Web push** powered by VAPID (`web-push`) — offline users receive DMs, group messages, mentions, and friend events as native notifications
- Permission is opt-in via explicit user action (`requestPermission`); `syncSubscription` only auto-subscribes when permission is already granted
- Push subscriptions are stored per user; expired/unsubscribed endpoints (404/410) are cleaned up automatically
- Notification click actions in the service worker deep-link into the open conversation

---

## 🧠 Architecture Design

```
Browser  ──HTTPS──►  Next.js frontend  ──REST──►  Express backend  ──►  MongoDB
   │                                                 │
   └─────────── Socket.IO (realtime) ◄───────────────┘
```

**Message flow:** Client → POST → Authenticate → Zod validate → Authorize membership → MongoDB write → Socket.IO emit → recipients.

> MongoDB is authoritative; **Socket.IO only distributes realtime events**. Redis is planned acceleration, not canonical storage — the current limiter and presence store are in-memory (single instance). Appwrite supplements the core (file storage); web-push delivers offline notifications.

---

## 🔒 Security

- JWT access tokens + **session-backed** httpOnly refresh cookies
- Server-side **Zod validation** on every body, query, and param
- Resource-based authorization (membership / ownership checks)
- Rate limiting with `X-RateLimit-*` + `Retry-After` headers on auth, messaging, search, and upload routes
- Helmet security headers, secure CORS, body-size limits
- Upload validation (allow-listed MIME types & sizes), old files deleted on replace
- Banned users are rejected at login and disconnected from sockets; no stack traces / secrets leaked in production

---

## 🆚 Roadmap

| Phase | Focus |
|---|---|
| **Phase 1** (current) | DMs, groups, realtime, friends, spaces & channels, notifications + preferences, PWA, 10 themes, mobile UX, offline caching, attachments, voice messages, public profiles & badges, blocking, message forwarding & pinning, threads, global search, 2FA |
| **Phase 1.5** | Voice & video calls |
| **Phase 2** | Stronger search, video attachments |
| **Phase 3** | Voice rooms, video calls, screen sharing, bots & webhooks |
| **Phase 4** | Developer platform, mini-apps, marketplace theme sharing |

---

## 📁 Related Documents

- 🆔 [`docs.md`](./docs.md) — full features & how-to-use guide
- 📄 [`PRD.md`](./PRD.md) — full product requirements, API reference, schema
- 🏗️ [`TECH-STACK.md`](./TECH-STACK.md) — architecture & engineering decisions
- 🎨 [`frontend/Design.md`](./frontend/Design.md) — visual design system & tokens

---

<div align="center">

<br />

Made with ❤️ · [Kivo](https://github.com/user-synax/Kivo)

</div>
