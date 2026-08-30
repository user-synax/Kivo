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
- 🎨 **5 live-switchable themes** with a warm "Nexus" color palette, persisted without a page reload.
- 👤 **Rich profiles** — display name, custom status, bio, and avatar uploads hosted on Appwrite Storage.
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
| **Spaces & Channels** | 🛰️ Discord | Community-level containers with text channels (post-MVP) |

Kivo is **not** a Slack replacement — work-management, canvases, and enterprise tooling are intentionally out of scope. The focus is a **fast, simple, deeply personal** chat experience.

---

## 🧩 Product Model

```
Kivo
├── DMs (1:1 private conversations)            ✅ MVP
├── Groups (private small-group chat)          🔧 Backend ready, UI pending
└── Spaces (community containers)              🚧 Post-MVP
    └── Channels (text conversations)          🚧 Post-MVP
        └── Messages
            └── Threads (future)               🚧 Phase 2
```

---

## 👥 For Everyday Users

Although Kivo is a **student project**, the messaging core is **fully functional** — you can use it today for:

- ✉️ **Private 1:1 chats** with friends, family, or classmates
- 👥 **Small group conversations** (e.g. college projects, gaming squads) — backend ready, UI on the way
- 🎨 **Personalizing your chat** with 5 live-switchable themes
- 🟢 Real-time presence, typing indicators, and read receipts

It's a great platform for **normal, everyday conversations** — no enterprise features needed.

---

## 🚦 Implementation Status

### ✅ Complete
- Authentication & sessions (JWT + httpOnly refresh cookie)
- User profiles (name, username, bio, custom status, avatar upload)
- Friends system (request / accept / decline / list / search / remove)
- DM conversations (create, list, history, unread counts)
- Text messaging (send, edit, soft-delete, reactions, receipts)
- Typing indicators & presence (realtime via Socket.IO)
- Theme system (5 themes, live switching)
- Animated landing page

### 🔧 Backend Ready
- Group chats (schema supports `type: "group"`, UI pending)

### 🚧 Planned / Not Started
- Spaces & Channels · Threads · Notifications (Appwrite push)
- Search (conversation / message) · File attachments · Image sharing

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
| **Appwrite** | File storage & push notifications |
| **Redis** | Caching, rate limiting (planned) |

> **Runtime:** [Bun](https://bun.sh) — package manager & runtime for dev.

---

## 🗂️ Repository Structure

```
kivo/
├── frontend/            # Next.js 16 app (App Router, React 19)
│   ├── app/             # Routes: landing, login, signup, app, profile
│   ├── components/      # UI, dashboard, chat, auth, navbar
│   └── lib/             # theme, api, auth, chat, avatar helpers
│
├── backend/             # Express 5 + Socket.IO + Mongoose
│   └── src/
│       ├── config/      # DB + env config
│       ├── middleware/  # auth, errorHandler, rateLimiter
│       ├── models/      # User, Session, Conversation, Message, FriendRequest
│       ├── modules/     # auth, users, conversations, messages, friends, admin
│       ├── socket/      # Socket.IO init, presence, events
│       ├── services/    # Business logic
│       └── utils/       # helpers & errors
│
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
| `typing:start` / `typing:stop` | Client → Room | Typing indicator |
| `presence:online` / `offline` | Server → All | Presence broadcast |
| `presence:snapshot` | Server → Client | Online peers on connect |

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
- Reactions, edit, and soft-delete
- 60-second message grouping & hover actions
- Emoji picker — 9 categories, 270+ emojis
- Delivery & read receipts

### 👥 Friends
- Request by username or email
- Accept/decline, auto-mutual on reverse requests
- Conflict-safe unique constraints (no duplicate/self-friending)
- Search with debounced API calls + "Message" shortcut

### 👤 Profiles
- Display name, unique username, bio (280), custom status (60)
- 8 preset avatar styles + real avatar upload (Appwrite, 4MB max)
- User detail panel (desktop XL+) with member-since info

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
| **Phase 1** (current) | DMs, realtime, friends, profiles, customization, landing page |
| **Phase 2** | Spaces & Channels, Threads, pinned/saved messages, search |
| **Phase 3** | Voice rooms, video calls, screen sharing, bots & webhooks |
| **Phase 4** | Developer platform, mini-apps, marketplace & custom themes |

---

## 📁 Related Documents

- 📄 [`PRD.md`](./PRD.md) — full product requirements, API reference, schema
- 🏗️ [`TECH-STACK.md`](./TECH-STACK.md) — architecture & engineering decisions
- 🎨 [`Design.md`](./Design.md) — visual design system & tokens

---

<div align="center">

<br />

Made with ❤️ · [Kivo](https://github.com/user-synax/Kivo)

</div>
