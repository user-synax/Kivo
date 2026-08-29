# Kivo — Product Requirements Document

**Version:** 2.0
**Last Updated:** August 29, 2026
**Status:** MVP Development (Core DMs Complete)

---

## Product Overview

| Field | Value |
|---|---|
| **Name** | Kivo |
| **Tagline** | Chat your way. |
| **Category** | Realtime communication platform |
| **Primary Differentiator** | Deep, smooth, user-controlled customization layered on top of a polished messaging experience |

### Vision

Kivo is a modern, realtime communication platform focused on two experiences:

1. **WhatsApp-like** private and group messaging.
2. **Discord-like** communities built around Spaces and Channels.

Kivo is **not** a Slack replacement. Work-management, enterprise collaboration, canvases, task systems, and Slack-style workflow features are explicitly out of scope for MVP.

### Principles

- **Fast and realtime** — conversations feel instant.
- **Simple to understand** despite being feature-rich.
- **Personal and highly customizable** — deeper than a light/dark switch.
- **Clean, polished, responsive UI** — mobile-first quality without sacrificing desktop UX.
- **Privacy and authorization are foundational** — never trust the client.
- **One unified Kivo identity** across DMs, Groups, and Spaces.
- **Avoid unnecessary complexity** — no premature microservices.

---

## Core Product Model

```
Kivo
├── DMs (1:1 private conversations)
├── Groups (private small-group conversations)
└── Spaces (community-level containers)
    └── Channels (text conversations inside Spaces)
        └── Messages
            └── Threads (future)
```

| Concept | Description | Scope |
|---|---|---|
| **DM** | Private one-to-one communication | MVP |
| **Group** | Private small-group conversations (friends, college, projects, gaming) | MVP — backend complete, UI pending |
| **Space** | Community-level container similar to a Discord server | Post-MVP |
| **Channel** | Text conversation inside a Space | Post-MVP |
| **Thread** | Message-level discussion inside a channel | Phase 2 |

---

## Current Implementation Status

### Summary

| Area | Status | Notes |
|---|---|---|
| Authentication & Sessions | **Complete** | JWT access + httpOnly refresh cookie, session-backed |
| User Profiles | **Complete** | Display name, username, bio, custom status, avatar upload |
| Friends System | **Complete** | Request/accept/decline, friend list, search |
| DM Conversations | **Complete** | Create, list, message history, unread counts |
| Messaging (text) | **Complete** | Send, edit, soft-delete, reactions, read/delivery receipts |
| Typing Indicators | **Complete** | Realtime via Socket.IO |
| Presence | **Complete** | Online/offline, snapshot on connect |
| Realtime Events | **Complete** | Socket.IO with authenticated connections |
| Theme System | **Complete** | 5 themes with live switching, persisted in localStorage |
| Landing Page | **Complete** | Animated hero, floating navbar, responsive |
| Group Chats | **Backend ready** | Schema supports `type: "group"`, no UI or routes |
| Spaces & Channels | **Not started** | Post-MVP |
| Threads | **Not started** | Phase 2 |
| Notifications (push) | **Not started** | Planned |
| Search | **Not started** | Planned |
| File Attachments | **Not started** | Planned |

---

## MVP Feature Specification

### 1. Authentication & Identity

#### 1.1 Registration

| Field | Type | Required | Validation |
|---|---|---|---|
| displayName | String | Yes | Trimmed |
| username | String | Yes | Unique, trimmed, lowercase |
| email | String | Yes | Unique, lowercase, valid format |
| password | String | Yes | Min length enforced via Zod |

- Passwords hashed with bcrypt (12 rounds).
- On success: user document created, session document created, access token returned, refresh token set as httpOnly cookie.
- Duplicate email/username returns `CONFLICT` error.

#### 1.2 Login

- Accepts `emailOrUsername` + `password`.
- Rate limited: 10 requests per 15-minute window.
- On success: same token/session flow as registration.

#### 1.3 Session Management

| Component | Mechanism |
|---|---|
| Access Token | Stateless JWT, short-lived (15 min default), sent in `Authorization: Bearer` header |
| Refresh Token | httpOnly cookie, backed by `Session` document in MongoDB with TTL index |
| Token Refresh | `POST /api/v1/auth/refresh-token` — mints new access token, does not rotate refresh cookie |
| Single-flight refresh | Frontend deduplicates concurrent refresh attempts |
| Auto-refresh | Frontend checks token expiry 60s before expiration and proactively refreshes |

#### 1.4 Logout

- `POST /api/v1/auth/logout` — destroys current session, clears refresh cookie.
- `POST /api/v1/auth/logout-all` — destroys all sessions for the user.

#### 1.5 Route Protection

| Guard | Behavior |
|---|---|
| `GuestGate` | Redirects authenticated users away from `/login`, `/signup` to `/app` |
| `AuthGate` | Redirects unauthenticated users from `/app/*` to `/login` |

#### 1.6 User Profile

| Field | Type | Editable | Notes |
|---|---|---|---|
| displayName | String | Yes | Trimmed |
| username | String | Yes | Unique, validated |
| bio | String | Yes | Max 280 characters |
| status | String | Yes | Max 60 characters (custom status line) |
| avatarStyle | String | Yes | One of 8 preset styles (6 solid colors + 2 gradient rings) |
| avatarUrl | String | Via upload | Hosted on Appwrite Storage |
| email | String | No | Read-only |
| role | String | No | `user` or `admin` |

#### 1.7 Avatar Upload

- Endpoint: `PATCH /api/v1/users/me/avatar`
- Storage: Appwrite Storage
- Max size: 4MB
- Accepted types: png, jpeg, webp, gif
- Old avatar file is deleted on re-upload
- Removal: `DELETE /api/v1/users/me/avatar`

---

### 2. Friends System

#### 2.1 Friend Requests

| Action | Endpoint | Description |
|---|---|---|
| Send request | `POST /api/v1/friends/request` | By username or email |
| List incoming | `GET /api/v1/friends/requests` | Pending requests addressed to current user |
| Accept | `POST /api/v1/friends/requests/:id/accept` | Creates bidirectional friendship |
| Decline | `POST /api/v1/friends/requests/:id/decline` | Rejects the request |

#### 2.2 Friend Management

| Action | Endpoint |
|---|---|
| List friends | `GET /api/v1/friends` |
| Remove friend | `DELETE /api/v1/friends/:id` |

#### 2.3 Constraints

- Self-friending is blocked.
- One active request per directed pair (enforced by unique index).
- Reverse-request conflict handling (if target already sent you a request, accept auto-mutual).
- "Already friends" detected before creating new request.

#### 2.4 Frontend UX

- `FriendsModal` with three tabs: Requests, Friends, Add Friend.
- Search with debounced API calls.
- "Message" button on friend cards creates or opens existing DM.

---

### 3. Direct Messaging

#### 3.1 Conversation Creation

- `POST /api/v1/conversations` with `{ participantId }`.
- Server creates or returns existing DM (no duplicates via `$all` lookup).
- Both participants auto-join the Socket.IO room on connection.

#### 3.2 Conversation List

- `GET /api/v1/conversations` — sorted by `lastMessageAt` descending.
- Each entry includes: participant info (displayName, username, avatarStyle, avatarUrl), unread count, last message preview, online status.
- Unread count = messages not from current user and not in `readBy` array.

#### 3.3 Message Operations

| Operation | Endpoint | Authorization |
|---|---|---|
| Fetch messages | `GET /api/v1/conversations/:id/messages` | Must be participant |
| Send message | `POST /api/v1/conversations/:id/messages` | Must be participant |
| Edit message | `PATCH /api/v1/messages/:id` | Sender only |
| Delete message | `DELETE /api/v1/messages/:id` | Sender only (soft-delete) |
| Add reaction | `POST /api/v1/messages/:id/reactions` | Must be participant |
| Remove reaction | `DELETE /api/v1/messages/:id/reactions/:reactionId` | Own reaction only |
| Mark read | `PATCH /api/v1/conversations/:id/read` | Must be participant |

#### 3.4 Message Schema

```
Message {
  conversationId: ObjectId (indexed)
  senderId: ObjectId (indexed)
  content: String (max 4000 chars, blanked on soft-delete)
  replyToMessageId: ObjectId (nullable, future thread support)
  reactions: [{ userId, emoji, _id }]
  deliveredTo: [ObjectId]
  readBy: [{ userId, readAt }]
  isEdited: Boolean
  isDeleted: Boolean
  createdAt: Date
  updatedAt: Date
}
```

**Indexes:**
- `{ conversationId: 1, createdAt: -1 }` — primary message query
- `{ senderId: 1, createdAt: -1 }` — moderation/search

#### 3.5 Cursor-Based Pagination

- Messages fetched newest-first.
- Client sends `cursor` (message ID) to load older messages.
- Server returns messages before the cursor + `hasMore` flag.
- Frontend implements infinite scroll with `loadMore` on scroll-to-top.

#### 3.6 Optimistic UI

- Messages appear instantly in the UI before server confirmation.
- Failed messages show a retry button.
- Delivery states: sending → sent → delivered → read.

---

### 4. Realtime System (Socket.IO)

#### 4.1 Connection

- Single Socket.IO server attached to the Express HTTP server.
- Handshake authentication via JWT (same secret as HTTP access tokens).
- Connections without valid tokens are rejected.

#### 4.2 Presence

| Event | Direction | Description |
|---|---|---|
| `presence:online` | Server → All | Broadcast when a user first connects |
| `presence:offline` | Server → All | Broadcast when a user's last socket disconnects |
| `presence:snapshot` | Server → Client | Sent on connect; list of currently online peer IDs |

- In-memory `Map<userId, Set<socketId>>` — single-instance only.
- Exposed to REST layer via `io.isUserOnline(userId)`.

#### 4.3 Messaging Events

| Event | Direction | Description |
|---|---|---|
| `message:new` | Server → Room | New message in a conversation |
| `message:edited` | Server → Room | Message content updated |
| `message:deleted` | Server → Room | Message soft-deleted |
| `message:reaction` | Server → Room | Reaction added or removed |
| `message:read` | Server → Room | Messages marked as read |
| `message:delivered` | Client → Server | Acknowledge receipt of `message:new` |
| `message:delivery-updated` | Server → Room | Broadcast updated `deliveredTo` array |

#### 4.4 Typing Indicators

| Event | Direction | Description |
|---|---|---|
| `typing:start` | Client → Server → Room | User started typing |
| `typing:stop` | Client → Server → Room | User stopped typing |

#### 4.5 Room Naming

- Room format: `conversation:{conversationId}`
- Helper: `emitToConversation(conversationId, event, data)`

#### 4.6 Authorization

- Server verifies conversation membership before accepting socket events.
- Server verifies user identity from JWT — never trusts client-provided user IDs.

---

### 5. Theme & Customization System

#### 5.1 Theme Architecture

- 5 built-in themes stored in `lib/theme.js`.
- Theme applied via CSS custom properties at the `:root` level.
- Persisted in `localStorage` under `kivo:theme`.
- Live switching — no page reload required.

#### 5.2 Available Themes

| Theme | Style | Radii | Shadows | Surfaces |
|---|---|---|---|---|
| **Replit** (default) | Flat, border-driven | 40px cards, pill buttons | Minimal | Cream/dark |
| **Replit Soft** | Gentle floating elevation | 28px cards | Subtle | Cream/dark |
| **Replit Crisp** | Geometric, precise | 14px cards | Hairline | Cream/dark |
| **Replit Float** | Bold, pillowy | 48px cards | Prominent | Cream/dark |
| **Replit Ink** | Dark variant of default | 40px cards | Minimal | Near-black |

#### 5.3 Color Palette ("Nexus")

| Token | Light Value | Dark Value |
|---|---|---|
| primary | `#F68B1F` (ember orange) | `#F68B1F` |
| secondary | `#F2EAD3` (warm cream) | `#1e1a12` |
| accent | `#FDB813` (gold) | `#FDB813` |
| background | `#F2EAD3` | `#14110b` |
| surface | `#FFFFFF` | `#1e1a12` |
| text-primary | `#111827` | `#F2EAD3` |
| text-secondary | `#4B5563` | `#9ca3af` |
| border | `#E5E7EB` | `#2d2719` |

#### 5.4 Typography

| Role | Font | Weight |
|---|---|---|
| Display / Headings | Inter | 500 |
| Body | Playfair Display | 400 |
| Mono / Labels | JetBrains Mono | 600 |

#### 5.5 Motion System

- Staggered text reveals, dropdown/panel open/close.
- Modal open/close, tabs sliding pill.
- Chat message entrance animations.
- Custom scrollbars, emoji picker.
- `prefers-reduced-motion` respected throughout.
- Built on `motion` (Framer Motion) + CSS transitions.

#### 5.6 Future Customization (Post-MVP)

- Custom themes (user-created).
- Custom fonts.
- Advanced message styles.
- Custom emoji/reaction packs.
- Animated profile elements.
- Per-conversation and per-space appearance overrides.
- Theme sharing.

---

### 6. UI & Layout

#### 6.1 Landing Page

- Animated hero section with interactive chat mockup.
- Floating pill-style navbar with scroll-responsive opacity.
- Sections: Features, Customization, Security, Roadmap.
- Responsive — mobile hamburger menu, desktop nav links.
- `GuestGate` redirects authenticated users to `/app`.

#### 6.2 Dashboard Layout

| Breakpoint | Layout |
|---|---|
| Mobile (< 768px) | Stack navigation: conversation list → chat panel → detail panel |
| Desktop (768px+) | Sidebar + chat panel + optional detail panel |
| Desktop XL (1280px+) | Three-column: sidebar + chat + user detail panel |

#### 6.3 Sidebar

- Conversation list with search/filter.
- Unread badges per conversation.
- Online presence indicators.
- Compose button (start new conversation).
- Theme switcher dropdown.
- Profile navigation at bottom.
- Collapsible to icon rail on desktop.

#### 6.4 Chat Panel

- Message list with cursor-based pagination.
- Auto-scroll to bottom on new messages.
- Typing indicator display.
- Emoji picker (9 categories, 270+ emojis).
- Message actions on hover: react, edit, delete.
- Message grouping (60-second window).
- Delivery/read receipts (sent → delivered → read).
- Retry button for failed messages.

#### 6.5 User Detail Panel

- Desktop XL+ only.
- Shows other user's profile: avatar, name, username, online status, custom status, bio, email, member-since date.

#### 6.6 Accessibility

- `prefers-reduced-motion` respected.
- `focus-visible` styles on all interactive elements.
- ARIA attributes on modals, buttons, inputs.
- Keyboard navigation: Escape to close modals/menus, Tab navigation.

---

### 7. Search

| Search Type | Status | Notes |
|---|---|---|
| User search | **Complete** | By username, email, displayName; includes friend relationship status |
| Space search | Not started | Post-MVP |
| Conversation search | Not started | Post-MVP |
| Message search | Not started | Post-MVP |

- Endpoint: `GET /api/v1/users/search?q=`
- Debounced on frontend.

---

### 8. Notifications

| Type | Status | Notes |
|---|---|---|
| In-app notifications | Not started | Planned |
| Mention notifications | Not started | Planned |
| Push notifications | Not started | Will use Appwrite Messaging |

- Per-user notification preferences: not started.

---

### 9. Attachments

| Type | Status | Notes |
|---|---|---|
| Avatar uploads | **Complete** | Via Appwrite Storage, 4MB max |
| Image attachments | Not started | Post-MVP |
| Document/file attachments | Not started | Post-MVP |

- File size/type validation enforced server-side.
- Preview where supported.
- Safe storage via Appwrite Storage.

---

## API Reference

### Base URL

```
/api/v1
```

### Authentication

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

Refresh token is sent automatically via httpOnly cookie.

### Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

### Endpoints

#### Auth

| Method | Path | Auth | Rate Limit | Body |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | No | No | `{ displayName, username, email, password }` |
| POST | `/api/v1/auth/login` | No | 10/15min | `{ emailOrUsername, password }` |
| POST | `/api/v1/auth/refresh-token` | No | 30/60s | Cookie only |
| POST | `/api/v1/auth/logout` | Yes | No | — |
| POST | `/api/v1/auth/logout-all` | Yes | No | — |

#### Users

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/api/v1/users/me` | Yes | — |
| PATCH | `/api/v1/users/me` | Yes | `{ displayName?, username?, bio?, status?, avatarStyle? }` |
| PATCH | `/api/v1/users/me/avatar` | Yes | Multipart (max 4MB) |
| DELETE | `/api/v1/users/me/avatar` | Yes | — |
| GET | `/api/v1/users/search?q=` | Yes | — |
| GET | `/api/v1/users/:id` | Yes | — |

#### Conversations

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/conversations` | Yes | `{ participantId }` |
| GET | `/api/v1/conversations` | Yes | — |
| GET | `/api/v1/conversations/:id/messages` | Yes | `?cursor=&limit=` |
| POST | `/api/v1/conversations/:id/messages` | Yes | `{ content, replyToMessageId? }` |
| PATCH | `/api/v1/conversations/:id/read` | Yes | — |

#### Messages

| Method | Path | Auth | Body |
|---|---|---|---|
| PATCH | `/api/v1/messages/:id` | Yes | `{ content }` |
| DELETE | `/api/v1/messages/:id` | Yes | — |
| POST | `/api/v1/messages/:id/reactions` | Yes | `{ emoji }` |
| DELETE | `/api/v1/messages/:id/reactions/:reactionId` | Yes | — |

#### Friends

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/friends/request` | Yes | `{ usernameOrEmail }` |
| GET | `/api/v1/friends/requests` | Yes | — |
| POST | `/api/v1/friends/requests/:id/accept` | Yes | — |
| POST | `/api/v1/friends/requests/:id/decline` | Yes | — |
| GET | `/api/v1/friends` | Yes | — |
| DELETE | `/api/v1/friends/:id` | Yes | — |

#### Admin

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/admin/users/:id/force-logout` | Admin | — |
| GET | `/api/v1/admin/users` | Admin | — |

---

## Technical Architecture

### Repository Structure

```
kivo/
├── frontend/          # Next.js 16, App Router, React 19
├── backend/           # Express 5, Socket.IO, Mongoose 9
├── PRD.md
├── Design.md
└── TECH-STACK.md
```

### Frontend Stack

| Technology | Purpose |
|---|---|
| Next.js 16.3.3 | Framework (App Router) |
| React 19.2.8 | UI library |
| Tailwind CSS v4 | Utility-first styling |
| shadcn/ui (Base-Nova) | Component primitives |
| motion (Framer Motion) 13.1.1 | Animations |
| Socket.IO Client 4.8.3 | Realtime |
| Biome 2.4.2 | Linting + formatting |

**Language:** JavaScript only (no TypeScript).

### Backend Stack

| Technology | Purpose |
|---|---|
| Node.js + Express 5 | HTTP framework |
| Socket.IO 4.8.3 | Realtime WebSocket layer |
| Mongoose 9.9.4 | MongoDB ODM |
| MongoDB Atlas | Primary database |
| Redis | Caching, rate limiting, presence (planned) |
| Zod 4.4.3 | Request validation |
| JWT (jsonwebtoken 9) | Authentication |
| bcryptjs 2.4.3 | Password hashing |
| Appwrite | File storage + push notifications |

**Runtime:** Bun (package manager + runtime for dev).

### Backend Module Structure

```
backend/src/
├── config/
│   ├── db.js              # Mongoose connection
│   └── env.js             # Environment config with validation
├── lib/
│   └── appwrite.js        # Appwrite Storage client
├── middleware/
│   ├── auth.js            # JWT verification + role authorization
│   ├── errorHandler.js    # Centralized error + 404 handler
│   └── rateLimiter.js     # In-memory fixed-window rate limiter
├── models/
│   ├── User.js
│   ├── Session.js
│   ├── Conversation.js
│   ├── Message.js
│   └── FriendRequest.js
├── modules/
│   ├── auth/              # Register, login, refresh, logout
│   ├── users/             # Profile, avatar, search
│   ├── conversations/     # DM creation, list, messages
│   ├── messages/          # Edit, delete, reactions
│   ├── friends/           # Request, accept, decline, list
│   └── admin/             # Force logout, user listing
├── socket/
│   ├── index.js           # Socket.IO init, presence, events
│   └── io.js              # Room helpers, emit utilities
└── utils/
    ├── asyncHandler.js    # Express async wrapper
    └── errors.js          # ApiError class + error factories
```

Each module follows a 4-file pattern:
- `*.routes.js` — Express router
- `*.controller.js` — HTTP handlers
- `*.service.js` — Business logic
- `*.validation.js` — Zod schemas

### Database Schema

#### User
```
{
  email:          String (unique, lowercase, trimmed)
  displayName:    String (trimmed)
  username:       String (unique, sparse, trimmed)
  bio:            String (max 280)
  status:         String (max 60)
  avatarStyle:    String (nullable)
  avatarUrl:      String (nullable)
  avatarFileId:   String (select: false)
  passwordHash:   String (select: false)
  role:           String (enum: ["user", "admin"], default: "user")
  createdAt:      Date
  updatedAt:      Date
}
```

#### Session
```
{
  userId:         ObjectId → User (indexed)
  deviceInfo: {
    userAgent:    String (nullable)
    ip:           String (nullable)
  }
  expiresAt:      Date (TTL index, auto-delete)
  createdAt:      Date
  updatedAt:      Date
}
```

#### Conversation
```
{
  type:           String (enum: ["dm", "group"], default: "dm")
  participants:   [ObjectId → User] (indexed)
  lastMessageAt:  Date (indexed, nullable)
  createdAt:      Date
  updatedAt:      Date
}
```

#### Message
```
{
  conversationId:      ObjectId → Conversation (indexed)
  senderId:            ObjectId → User (indexed)
  content:             String (max 4000, blanked on soft-delete)
  replyToMessageId:    ObjectId → Message (nullable)
  reactions:           [{ userId, emoji, _id }]
  deliveredTo:         [ObjectId → User]
  readBy:              [{ userId, readAt }]
  isEdited:            Boolean (default: false)
  isDeleted:           Boolean (default: false)
  createdAt:           Date
  updatedAt:           Date
}
```

#### FriendRequest
```
{
  from:           ObjectId → User (indexed)
  to:             ObjectId → User (indexed)
  status:         String (enum: ["pending", "accepted", "declined"])
  createdAt:      Date
  updatedAt:      Date
}
```
**Indexes:** `{ from, to }` unique, `{ to, status }`, `{ from, status }`.

### Frontend Pages

| Route | File | Purpose | Auth |
|---|---|---|---|
| `/` | `app/page.js` | Landing page (hero + navbar) | GuestGate |
| `/login` | `app/(auth)/login/page.jsx` | Login form | GuestGate |
| `/signup` | `app/(auth)/signup/page.jsx` | Signup form | GuestGate |
| `/app` | `app/app/page.jsx` | Main dashboard | AuthGate |
| `/app/profile` | `app/app/profile/page.jsx` | User profile | AuthGate |

### Frontend Component Tree

```
components/
├── auth-guard.jsx            # GuestGate + AuthGate
├── socket-provider.jsx       # Socket.IO context
├── theme-provider.jsx        # Theme context
├── Hero.jsx                  # Re-export barrel
├── saa-s-template.jsx        # Unused SaaS template
├── auth/
│   ├── AuthCard.jsx          # Animated card wrapper
│   └── AuthInput.jsx         # Styled input with error states
├── hero/
│   └── hero.jsx              # Landing hero section
├── navbar/
│   ├── navbar.jsx            # Floating pill navbar
│   └── nav-items.js          # Navigation data
├── chat/
│   └── chat-bubble.jsx       # Reusable chat bubble
├── dashboard/
│   ├── dashboard-shell.jsx   # Main dashboard orchestrator
│   ├── sidebar.jsx           # Conversation list + controls
│   ├── chat-panel.jsx        # Active chat view
│   ├── message-bubble.jsx    # Individual message bubble
│   ├── avatar.jsx            # Avatar with initials fallback
│   ├── emoji-picker.jsx      # 9-category emoji picker
│   ├── friends-modal.jsx     # Friends management modal
│   ├── profile-edit-modal.jsx # Profile editing modal
│   └── user-panel.jsx        # Right-hand detail panel
└── ui/
    ├── button.jsx            # shadcn Button
    └── bubble.jsx            # shadcn Bubble primitive
```

---

## Security Requirements

### Authentication

- Never trust client-provided roles/permissions.
- Authenticate every protected request.
- JWT access tokens are stateless; refresh tokens are session-backed.
- Sensitive credentials never exposed to the browser.

### Authorization

- Resource-based authorization (conversation membership, message ownership).
- Server verifies membership before allowing message operations.
- Server verifies user identity from JWT — never from request body.

### Input Validation

- All request bodies, query parameters, and route parameters validated with Zod.
- Validation errors return `VALIDATION_ERROR` with first issue message.

### Rate Limiting

- In-memory fixed-window rate limiter.
- Applied to: login (10/15min), refresh (30/60s).
- Sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` headers.

### Upload Validation

- File type validation (png, jpeg, webp, gif for avatars).
- File size validation (4MB max for avatars).
- Old files deleted on replacement.

### Security Headers

- Helmet middleware for secure HTTP headers.
- Secure CORS configuration.
- Request body size limits.

### Production Safety

- Stack traces not exposed in production.
- Secrets not logged or returned in responses.
- Database connection details hidden.

### Future

- Build block/report foundations.
- Prevent unauthorized message editing/deletion.
- Prevent users from accessing conversations/spaces they do not belong to.

---

## Performance Requirements

| Strategy | Implementation |
|---|---|
| Optimistic UI | Messages appear instantly; retry on failure |
| Cursor pagination | Message loading with cursor-based approach |
| Lazy loading | Conversations and messages loaded on demand |
| Efficient images | Avatar sizing, lazy loading |
| MongoDB indexes | Proper indexes on conversationId, senderId, membership |
| Redis caching | Planned for session cache, unread counters, presence |
| Socket.IO | Realtime instead of polling |
| Minimal state | Client-side state only where needed |
| Reduced re-renders | Component-level optimization |

---

## Deployment

| Component | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Static/SSR Next.js deployment |
| Backend | Render/Railway | Must support long-lived WebSocket connections |
| Database | MongoDB Atlas | Managed MongoDB |
| Storage | Appwrite Storage | Avatars, future attachments |
| Push | Appwrite Messaging | Planned |

### Environment Variables

**Server-side (never exposed to browser):**
- `MONGODB_URI`
- `REDIS_URL`
- `ACCESS_TOKEN_SECRET`
- `REFRESH_TOKEN_SECRET`
- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_BUCKET_ID`
- `CORS_ORIGIN`
- `NODE_ENV`

**Client-side (explicitly prefixed):**
- `NEXT_PUBLIC_*` (no secrets)

Maintain `.env.example` in both frontend and backend.

---

## Out of Scope for MVP

- Slack-style work-management features
- Voice channels / video calls / screen sharing
- End-to-end encryption
- Bots / webhooks / integrations
- Marketplace
- Payments
- Stories / status feed
- AI assistant
- Live streaming
- Plugin ecosystem
- Desktop native client
- Complex automation / workflows

These may be considered after the core communication experience is stable.

---

## Future Roadmap

### Phase 1 — Core Communication (Current)

- DMs, realtime messaging, friends, profiles, customization, landing page.
- Group chats (backend ready, UI pending).

### Phase 2 — Enhanced Messaging

- Spaces & Channels (Discord-like communities).
- Threads.
- Pinned messages.
- Saved messages.
- Custom emoji.
- Advanced permissions.
- Scheduled messages.
- Stronger search (message, conversation, space).

### Phase 3 — Rich Communication

- Voice rooms.
- Video calls.
- Screen sharing.
- Bots & webhooks.
- Integrations.

### Phase 4 — Platform

- Developer platform.
- Mini-apps.
- Automation.
- Marketplace / custom themes.
- Theme sharing.

---

## Success Criteria

The MVP is successful when:

1. Users can reliably communicate in realtime (DMs, typing, presence, read receipts).
2. Conversation loading is fast with cursor-based pagination.
3. Mobile and desktop UX both feel polished.
4. Customization is visibly deeper than ordinary chat apps (5 themes, live switching).
5. Permissions and security are enforced server-side.
6. The architecture can support future voice/video/community features without rewriting.

---

## Visual Direction

Design source of truth: `Design.md`

- **Primary:** `#F68B1F` (ember orange)
- **Secondary:** `#F2EAD3` (warm cream)
- **Accent:** `#FDB813` (gold)
- **Dark canvas:** `#14110b`
- **Dark surface:** `#1e1a12`

Design ratio: **85% minimal / 15% personality**.

Personality comes from product UI, customization previews, reactions, and micro-interactions — not from excessive gradients, glow, 3D decoration, or animation.

### Design Principles

- Near-black canvas with warm tones.
- Hairline borders.
- Generous whitespace.
- Minimal shadows.
- Strong geometric headings (Inter).
- Clean UI surfaces.
- Restrained motion with purpose.

---

## Engineering Principles

- JavaScript only across frontend and backend.
- Prefer simple architecture over premature abstraction.
- Domain-driven modules on the backend.
- No microservices initially.
- No direct frontend-to-database access.
- No trust in client authorization claims.
- No unbounded database arrays for messages.
- Realtime and persistence are separate concerns.
- Redis is acceleration infrastructure, not canonical storage.
- Appwrite supplements the core backend.
- Build only features supported by the current PRD.
- Keep the UI fast and polished.
- Reuse design tokens from `Design.md`.
