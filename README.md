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

- ⚡ **Real-time everything** — messages, typing, presence, and read receipts via Socket.IO (no polling).
- 🔔 **Full notification system** — in-app notifications with a bell + center, web push for offline users, and DM-focused suppression.
- 📱 **Progressive Web App** — installable on any device with a service worker, manifest, and offline push delivery.
- 🏠 **Discord-style Spaces & Channels** — moderated communities with text/announcement channels, role-based permissions, and realtime updates.
- 👥 **Full group chats** — private multi-person conversations with admins, member management, and moderation.
- 🔎 **Space discovery** — browse and join public communities by category or search.
- ↩️ **Reply & reactions** — quote-reply on any message, emoji reactions (270+), edit, and soft-delete.
- 🎨 **5 live-switchable themes** with a warm "Nexus" color palette, persisted without a page reload.
- 👤 **Rich profiles** — display name, custom status, bio, banner, avatar frames, and uploads hosted on Appwrite Storage.
- 🤝 **Complete friends system** — send, accept, decline, remove, search, and jump straight into a DM.
- 📱 **Mobile-first polish** — responsive three-panel layout that works beautifully from phone to XL desktop.
- 🔐 **Security-first** — JWT access tokens + httpOnly sessions, server-side Zod validation, never trust the client.
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
            └── Replies (quote reply)          ✅ Done
            └── Threads (future)               🚧 Phase 2
```

---

## 👥 For Everyday Users

Although Kivo is a **student project**, the messaging core is **fully functional** — you can use it today for:

- ✉️ **Private 1:1 chats** with friends, family, or classmates
- 👥 **Group conversations** (e.g. college projects, gaming squads) with admins & member management
- 🏠 **Your own Spaces & Channels** — run a community, moderate members, and organize chat by channel
- 🔎 **Discover public spaces** by category or search and join with one click
- 🎨 **Personalizing your chat** with 5 live-switchable themes
- 🟢 Real-time presence, typing indicators, read receipts, and message replies

It's a great platform for **normal, everyday conversations** — no enterprise features needed.

---

## 🚦 Implementation Status

### ✅ Complete
- Authentication & sessions (JWT + httpOnly refresh cookie)
- User profiles (name, username, bio, custom status, **banner**, avatar upload)
- Friends system (request / accept / decline / list / search / remove)
- DM conversations (create, list, history, unread counts)
- Text messaging (send, **reply**, edit, soft-delete, reactions, emoji picker, receipts)
- **Group chats** (create, add/remove members, promote/demote admins, realtime updates)
- **Spaces & Channels** (create, discover, join, moderation roles, text & announcement channels)
- **Notification system** (in-app notification center + notification sounds + bell with unread badge)
- **Web Push** (PWA service worker, VAPID subscriptions, offline push delivery)
- **Progressive Web App** (installable, manifest, service worker)
- Typing indicators & presence (realtime via Socket.IO)
- Theme system (5 themes, live switching)
- Animated landing page

### 🚧 Planned / Not Started
- Threads · Mention notifications
- Search (conversation / message) · File attachments · Image sharing
- Voice channels / video calls

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
| **Biome** | Linting & formatting |

> JavaScript only — no TypeScript, by design.

### Backend — `/backend`

| Technology | Purpose |
|---|---|
| **Node.js + Express 5** | HTTP framework |
| **Socket.IO 4** | Realtime WebSocket layer |
| **Mongoose 9** | MongoDB ODM |
| **MongoDB Atlas** | Primary database |
| **Zod 4** | Request validation |
| **JWT (jsonwebtoken)** | Authentication |
| **bcryptjs** | Password hashing (12 rounds) |
| **web-push** | VAPID web push notifications (offline delivery) |
| **Appwrite** | File storage |
| **Redis** | Caching, rate limiting (planned) |

> **Runtime:** [Bun](https://bun.sh) — package manager & runtime for dev.

---

## 🗂️ Repository Structure

```
kivo/
├── frontend/            # Next.js 16 app (App Router, React 19)
│   ├── app/             # Routes: landing, login, signup, app, profile, invite
│   ├── components/      # UI, dashboard, chat, auth, navbar, spaces, notifications
│   └── lib/             # theme, api, auth, chat, spaces, push, sound, avatar helpers
│
├── backend/             # Express 5 + Socket.IO + Mongoose
│   └── src/
│       ├── config/      # DB, env, webpush config
│       ├── middleware/  # auth, errorHandler, rateLimiter
│       ├── models/      # User, Session, Conversation, Message, FriendRequest, Space, Notification, PushSubscription
│       ├── modules/     # auth, users, conversations, messages, friends, spaces, notifications, push, admin
│       ├── socket/      # Socket.IO init, presence, room helpers, events
│       └── utils/       # helpers & errors
│
├── docs.md              # Full features & how-to-use guide
├── PRD.md               # Full product requirements & spec
├── TECH-STACK.md        # Architecture & engineering decisions
└── Design.md            # Visual design system
```

Each backend module follows a clean **4-file pattern**: `*.routes.js` → `*.controller.js` → `*.service.js` → `*.validation.js`.

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (>= 1.3)
- [MongoDB](https://www.mongodb.com/atlas) (Atlas or local)
- [Appwrite](https://appwrite.io) account (for avatar storage)

> For web push notifications, generate VAPID keys with `npx web-push generate-vapid-keys` and add them to your backend `.env`.

### 1. Backend

```bash
cd backend
bun install

# configure environment (MongoDB + Appwrite + auth secrets)
cp .env.example .env

bun run dev   # dev (nodemon)
bun run start # production (bun)
```

### 2. Frontend

```bash
cd frontend
bun install

# point the frontend at your backend (see below)
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local

bun run dev   # http://localhost:3000
bun run build # production build
bun run lint  # biome check
```

### Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `MONGODB_URI` | backend | MongoDB connection string |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | backend | JWT signing secrets |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | backend | Web push (VAPID) keys for offline notifications |
| `APPWRITE_*` | backend | Appwrite endpoint, project, key, bucket (avatar upload) |
| `CORS_ALLOWED_ORIGINS` | backend | Allowed frontend origins |
| `NEXT_PUBLIC_API_URL` | frontend | Backend base URL (HTTP + Socket.IO) |

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

- **GuestGate** redirects logged-in users away from `/login` & `/signup`.
- **AuthGate** redirects unauthenticated users from `/app/*` to `/login`.
- Rate limits: login `10/15min`, refresh `30/60s`.

---

## ⚡ Realtime Events (Socket.IO)

| Event | Direction | Description |
|---|---|---|
| `message:new` | Server → Room | New message |
| `message:edited` | Server → Room | Content updated |
| `message:deleted` | Server → Room | Message soft-deleted |
| `message:reaction` | Server → Room | Reaction added/removed |
| `message:read` | Server → Room | Marked as read |
| `message:delivery-updated` | Server → Room | Delivery state changed |
| `typing:start` / `typing:stop` | Client → Room | Typing indicator |
| `presence:online` / `offline` | Server → All | Presence broadcast |
| `presence:snapshot` | Server → Client | Online peers on connect |
| `conversation:member-added` / `member-removed` | Server → Room | Group membership changes |
| `conversation:updated` / `admin-changed` / `removed` | Server → Room | Group updates |
| `space:updated` / `space:member-*` / `space:channel-*` | Server → Space | Space, members & channels |
| `space:deleted` / `space:joined` / `space:removed` | Server → All | Space lifecycle |
| `notification:new` | Server → User | New in-app notification (fanned out to online recipients) |

> All socket events are **authenticated** via JWT handshake, and **authorized** — the server verifies conversation membership before accepting sensitive events.

---

## 🎨 Theme System — "Nexus" Palette

| Theme | Style |
|---|---|
| **Replit** (default) | Flat, border-driven · 40px cards · minimal shadows |
| **Replit Soft** | Gentle floating elevation · 28px cards |
| **Replit Crisp** | Geometric, precise · 14px cards · hairline borders |
| **Replit Float** | Bold, pillowy · 48px cards · prominent shadows |
| **Replit Ink** | Dark variant of Replit · near-black surfaces |

**Brand colors**

| Token | Light | Dark |
|---|---|---|
| Primary | `#F68B1F` (ember) | `#F68B1F` |
| Secondary | `#F2EAD3` (cream) | `#1e1a12` |
| Accent | `#FDB813` (gold) | `#FDB813` |
| Canvas | `#F2EAD3` | `#14110b` |
| Surface | `#FFFFFF` | `#1e1a12` |

**Typography:** Inter (display) · Playfair Display (body) · JetBrains Mono (labels)

Themes apply via CSS custom properties, persist in `localStorage`, and switch **live** with zero reload — all while respecting `prefers-reduced-motion`.

---

## 🧱 Key Features

### 💬 Messaging
- Cursor-based pagination with infinite scroll (newest-first)
- Optimistic UI with sent → delivered → read states + retry on failure
- **Quote replies** with inline preview of the original message
- Reactions, edit, and soft-delete
- 60-second message grouping & hover actions (bubble menu)
- Emoji picker — 9 categories, 270+ emojis
- Delivery & read receipts

### 👥 Groups
- Create private groups (2+ members) with a name & optional avatar
- Add/remove members and promote/demote admins (real-time)
- Admin-only management with system notices ("Admin added X", "Y left the group")
- Prevent orphaned groups — the last admin can't be removed/demoted

### 🏠 Spaces & Channels
- Create a space with name, avatar, banner, description & category (a `#general` channel is auto-created)
- Role hierarchy: **owner → admin → moderator → member** with rank-based permissions
- Text & announcement channels, each backed by its own message thread
- Admin+ create, rename, and delete channels (last channel protected)
- Full moderation — add/remove members, assign roles, self-leave with auto owner promotion
- **Discovery** — browse/search public spaces by category, join with one click

### 👥 Friends
- Request by username or email
- Accept/decline, auto-mutual on reverse requests
- Conflict-safe unique constraints (no duplicate/self-friending)
- Search with debounced API calls + "Message" shortcut

### 👤 Profiles
- Display name, unique username, bio (280), custom status (60)
- 8 preset avatar styles + real avatar upload (Appwrite, 4MB max)
- Profile **banner** image
- User detail panel (desktop XL+) with member-since info

### 🔔 Notifications
- In-app notification center — a bell with an unread count badge and a dropdown list
- Covers messages (DM / group / space), friend requests & accepts; cursor-paginated with "mark all read"
- **DM-focused suppression** — if you're actively viewing a DM, notifications for it are skipped server-side
- Notification **sounds** on new messages
- Realtime delivery via socket (`notification:new`) with per-recipient fan-out

### 📱 PWA & Web Push
- **Installable PWA** — `manifest.json` with icons, standalone display, and a service worker (`sw.js`)
- **Web push** powered by VAPID (`web-push`) — offline users receive DMs, group messages, and friend events as native notifications
- Permission is opt-in via explicit user action (`requestPermission`); `syncSubscription` only auto-subscribes when permission is already granted
- Push subscriptions are stored per user; expired/unsubscribed endpoints (404/410) are cleaned up automatically
- Notification click actions in the service worker deep-link into the app

---

## 🧠 Architecture Design

```
Browser  ──HTTPS──►  Next.js frontend  ──REST──►  Express backend  ──►  MongoDB
   │                                                │
   └─────────── Socket.IO (realtime) ◄──────────────┘
```

**Message flow:** Client → POST → Authenticate → Zod validate → Authorize membership → MongoDB write → Socket.IO emit → recipients.

> MongoDB is authoritative; **Socket.IO only distributes realtime events**. Redis is acceleration, not canonical storage. Appwrite supplements the core (storage/push).

---

## 🔒 Security

- JWT access tokens + **session-backed** httpOnly refresh cookies
- Server-side **Zod validation** on every body, query, and param
- Resource-based authorization (membership / ownership checks)
- Rate limiting with `X-RateLimit-*` + `Retry-After` headers
- Helmet security headers, secure CORS, body-size limits
- Upload validation (types & 4MB max), old files deleted on replace
- No stack traces / secrets leaked in production

---

## 🆚 Roadmap

| Phase | Focus |
|---|---|
| **Phase 1** (current) | DMs, groups, realtime, friends, spaces & channels, notifications, PWA, customization |
| **Phase 2** | Threads, pinned/saved messages, stronger search, mention notifications |
| **Phase 3** | Voice rooms, video calls, screen sharing, bots & webhooks |
| **Phase 4** | Developer platform, mini-apps, marketplace & custom themes |

---

## 📁 Related Documents

- 🆔 [`docs.md`](./docs.md) — full features & how-to-use guide
- 📄 [`PRD.md`](./PRD.md) — full product requirements, API reference, schema
- 🏗️ [`TECH-STACK.md`](./TECH-STACK.md) — architecture & engineering decisions
- 🎨 [`Design.md`](./Design.md) — visual design system & tokens

---

<div align="center">

<br />

Made with ❤️ · [Kivo](https://github.com/user-synax/Kivo)

</div>
