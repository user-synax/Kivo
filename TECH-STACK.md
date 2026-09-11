# Kivo — Technical Stack & Architecture

## Repository Strategy

Kivo uses one Git repository containing two separate applications:

```
kivo/
├── frontend/        # Next.js 16 app (App Router, React 19, JavaScript)
├── backend/         # Express 5 + Socket.IO + Mongoose (JavaScript)
├── README.md        # Overview & setup
├── docs.md          # Features & how-to-use guide
├── PRD.md           # Product requirements & API reference
└── TECH-STACK.md    # This document
```

This is intentionally a simple monorepo layout. Do not introduce microservices.

---

## Frontend

### Core

- **Next.js 16** (App Router), **React 19**
- **JavaScript only** — no TypeScript
- Tailwind CSS v4 (PostCSS), shadcn/ui + Base UI primitives, `motion` (Framer Motion), Socket.IO client, `idb-keyval` (IndexedDB cache), lucide-react/hugeicons/react-icons, date-fns
- Linting & formatting: **Biome** (`bun run lint`)

### Responsibilities

UI and interaction · routing · responsive design · API consumption · Socket.IO client · optimistic UI · theme/customization system · PWA readiness · accessibility · client-side state only where needed.

**Rules**

- JavaScript only.
- Avoid unnecessary UI/component libraries when shadcn/ui or native implementation is sufficient.

### Frontend layout (current)

- `frontend/app/` — route groups:
  - `/` landing, `(auth)/` → `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`
  - `/app` chat dashboard (DashboardShell), `/app/profile`
  - `/u/[username]` **public profiles**
  - `/docs` in-app guide, `/admin` + `/admin/dashboard`
- `frontend/components/` — `dashboard/` (shell, chat panel, message bubbles, sidebar, settings, modals, media drawer, `nested-sidebar.jsx` + `icon-rail.jsx` + `nearby-screen.jsx` (full-screen like Appearance) + `nearby-tab.jsx` + `profile-preview-card.jsx` (square) + `send-request-modal.jsx` + `find-panel.jsx`), `spaces/`, `notifications/`, `profile/`, `calls/` (LiveKit provider, incoming overlay, active call view), `chat/` (attachments), `status/` (`status-tab.jsx` vertical feed WhatsApp-desktop, `status-ring.jsx`, `status-create-modal.jsx`, `status-viewer.jsx`), `mentions/`, `ui/` (incl. shared `empty-state.jsx`, `confirm-modal.jsx`), `motion/` (context menu), `navbar/`, `admin/`, `docs/`
- `frontend/lib/` — `api.js` (fetch wrapper + auto refresh), `auth.js` (session store), `cache.js` (IndexedDB), `theme.js` (themes source of truth), `chat-style.js` (wallpaper/bubble-style constants + CSS, `WALLPAPER_OPTIONS`/`BUBBLE_STYLE_OPTIONS`/`resolveChatLook`/`wallpaperCss`), `avatar-styles.js`, `banners.js`, `countries.js`, `chat.js` (incl. day-divider helpers), `links.js` (URL extract/normalize), `emoji.js` (grapheme-aware emoji-only detection), `drafts.js` (per-chat composer drafts), `status.js` (`createStatus/fetchStatusFeed/fetchMyStatuses/viewStatus/deleteStatus`), `push.js`, `sound.js` (Web Audio sound cues), `last-active.js`, `use-breakpoint.js`, `profile-skin.js` (`ownerSkin`/`profileSkinVars` for public `/u` theming), `profile-effects.js` (`PROFILE_EFFECTS` `glow`/`gradient-name`/`aura`), `social-links.jsx` (`socialLinksFor`/`SocialGlyph`), `outbox.js` (offline queue), `calls.js` (call token/status fetch + Web Audio ringtones), `location.js` (`getCurrentPosition`, `fuzzDistanceMeters`, `formatDistance`, `checkGeolocationPermission` — nearby distance-only), hooks, etc.
- `frontend/Design.md` — visual design system & tokens (Framer dark canvas, `#4ba9e1` blue signal).

### Networking

- REST calls use **relative** `/api/...` paths; `next.config.mjs` **rewrites** `/api/v1/*`, `/api/admin/*`, and `/socket.io/*` to the backend (`BACKEND_URL`, default `http://localhost:4000`). Same-origin URLs let the httpOnly `sameSite=strict` refresh cookie flow without CORS.
- The **Socket.IO client connects directly** to `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`) because Next rewrites do not proxy WebSocket upgrades.

---

## Backend

### Core

- **Node.js + Express 5**, **Socket.IO 4**, **Mongoose 9**, **MongoDB**, **Zod 4**
- JavaScript only. Runtime & package manager: **Bun** (`bun run dev` runs nodemon; `bun run start` runs `src/server.js`).
- `backend/server.js` at the repo root is a legacy stub — the real entrypoint is `backend/src/server.js` (the Express app is built in `src/app.js`, shared by the HTTP server + Socket.IO).

### Responsibilities

Authentication/session logic · authorization · business rules · REST API · realtime event authorization · database operations · rate limiting · file upload orchestration · notification orchestration · error handling · security controls.

### Server architecture

Domain/module-based organization:

```
backend/src/
├── app.js               # Express app: helmet, CORS, cookies, /health, route mounts, 404 + error handler
├── server.js            # HTTP server bootstrap: DB connect → Socket.IO init → listen
├── config/              # env (dotenv), db (Mongoose), webpush (VAPID client)
├── lib/                 # appwrite (storage client), attachments (uploads), email (nodemailer SMTP),
│                        #   plus (entitlements + limits), emoji-image (sharp normalization)
├── middleware/          # auth (JWT bearer), adminAuth (admin cookie), rateLimiter, errorHandler
├── models/              # User, Session, Conversation, Message, FriendRequest, Space,
│                        #   Notification, PushSubscription, AdminActionLog, Status (24h TTL),
│                        #   CustomEmoji, PlusRequest
├── modules/             # auth, users, friends, conversations, messages, spaces,
│                        #   notifications, push, attachments, search, link-preview, calls, admin,
│                        #   status, emoji (custom emoji CRUD), plus (UPI claims), crypto, billing, voice
├── socket/              # index.js (init, JWT handshake, presence, rooms), io.js (emit helpers)
└── utils/               # errors, asyncHandler
```

Each domain module follows a clean **4-file pattern**: `*.routes.js` → `*.controller.js` → `*.service.js` → `*.validation.js` (validation omitted where a module has no inputs to validate).

### API style

Versioned REST APIs under `/api/v1`; the standalone admin API lives under `/api/admin`.

| Mount | Module |
|---|---|
| `/api/v1/auth` | register, login, refresh-token, logout, logout-all, verify-email, resend-verification, forgot/reset-password |
| `/api/v1/users` | me, profile update/avatar/banner (`PATCH /me/banner` 8 MB Plus), public profile by username, search (`30/min`, blocked/isBanned filtered, bio/status for card), blocked list, block/unblock, **privacy** (`PATCH /me/privacy {discoverableByNearby}`), **location** (`POST /me/location {lat,lng,accuracy}` `10/min`, `DELETE /me/location`), **nearby** (`GET /nearby?radius&limit` `30/min`, `$geoNear` + fuzz + `2dsphere`); validation `AVATAR_STYLE_IDS`/`PROFILE_EFFECT_IDS` + `updateMeSchema` + `privacySchema`/`locationSchema`/`nearbyQuerySchema` (`appearance` hex + wallpaper/bubble enums + `Permissions-Policy geolocation=(self)`) |
| `/api/v1/friends` | request (with optional `welcomeMessage` 280, blocked guard `BLOCKED_USER`, `20/hour`), accept/decline, list, remove; `GET /requests` returns `welcomeMessage` + avatar |
| `/api/v1/conversations` | DMs/groups CRUD, members/admins, read/unread, **conversation look** (`PATCH /:id/look`, `conversationLookSchema`), **permanent delete** (`DELETE /:id` — DM either side, group admin, channels 403), messages (list/send), pinned list, threads (list + panel feed) |
| `/api/v1/messages` | edit, delete, pin/unpin, save/unsave, saved feed, reactions (receipts via `readBy`/`deliveredTo`; "Seen by" card is client `message-bubble.jsx`) |
| `/api/v1/spaces` | spaces CRUD, discover (public only), join, join-by-invite-code, invite manage (GET/POST/DELETE), members/roles, channels |
| `/api/v1/notifications` | list, unread-count, mark read, preferences, **wave** (`POST /:id/wave` 20 s cooldown, `WAVE_COOLDOWN`/`WAVE_BLOCKED`, `senderUsername` denormalized, push deep-links to profile) |
| `/api/v1/push` | vapid-public-key, subscribe, unsubscribe |
| `/api/v1/attachments` | multipart upload (Multer → Appwrite) |
| `/api/v1/search` | unified global search |
| `/api/v1/link-preview` | server-side og unfurl (`?url=`) with SSRF guard + 1h cache |
| `/api/v1/calls` | LiveKit voice/video: token mint (`POST /token`, guarded, 20/min), capability flag (`GET /config`), ongoing lookup (`GET /status`) |
| `/api/v1/status` | Status 24h text+photo: `POST /` multipart `media` 10/day (`multer` 30MB, `STATUS_ALLOWED_MIMES` image, `uploadAttachment` → Appwrite `APPWRITE_ATTACHMENTS_BUCKET_ID`, caption `text`), `GET /feed` (friends grouped) 30/min, `GET /me`, `POST /:id/view` 60/min, `DELETE /:id` (deletes Appwrite file), hourly `cleanupExpiredStatuses()` sweep, `status:new/deleted/viewed` |
| `/api/v1/emoji` | Custom emoji CRUD: `GET /` (global + space + personal merged), `GET /personal` (own library), `POST /` (create, multipart image), `DELETE /:id` (delete); Plus-gated for personal/space; admin-only for global |
| `/api/v1/plus` | Kivo Plus UPI claims: `POST /claim` (file 12-digit UTR, 5/day limiter), `GET /claim` (latest claim status) |
| `/api/admin` | admin login, stats, users (ban/unban/**plan** `POST /users/:id/plan` Plus grant/revoke, detail), **Plus claims** (`GET /plus-requests`, `POST /plus-requests/:id/approve`, `POST /plus-requests/:id/reject`), groups & spaces (delete) |

`GET /health` returns `{ success: true, data: { status: "ok" } }` for uptime checks.

---

## Data Model (MongoDB / Mongoose)

MongoDB is the canonical source of truth. Core collections:

| Model | Notes |
|---|---|
| `User` | email, username, displayName, bio (280), status (60), **statusEmoji** (chip, max 8), avatar (URL + `avatarFileId` hidden), avatarStyle (`AVATAR_STYLE_IDS` 10), **banner** + `bannerFileId` (curated GIFs + Plus custom 8 MB upload via `updateBanner`), **country** (ISO-2 → flag), **githubUsername** (graph) + **xUsername**/`instagramUsername`/`youtubeUrl`/`websiteUrl` (**social links**, `social-links.jsx`), **verified / showBadge** + **plan** (`free`/`plus`) + **planExpiresAt** (nullable, 30 days from grant) + **profileEffect** (`none`/`glow`/`gradient-name`/`aura`, Plus-only), blockedUsers, ban fields (`isBanned`/`bannedAt`/`bannedReason`), lastActiveAt, email-verification & password-reset token hashes, **location** GeoJSON `Point [lng,lat]` + `locationUpdatedAt` + `2dsphere` + `locationUpdatedAt` index + **privacyPreferences.discoverableByNearby** (default `true`, Settings toggle, full-screen `NearbyScreen`), **notificationPreferences** (DMs, groups, mentions, friend reqs, Space msgs off by default, announcements), **appearance** (`{accent, tint}` hex + `wallpaper`/`bubbleStyle` enums `none`/`dots`/`grid`/`diagonal`/`bubbles`/`wash` + `rounded`/`pill`/`squared`/`outline` — returned only on self/session + public profile `appearance`, never in search) |
| `Session` | Backs each refresh token; `expiresAt` TTL index → deleting/expiring a session revokes it |
| `Conversation` | `type: dm / group / space_channel`, participants, admins (groups, `createdBy`), `spaceId`+`channelId` for channel conversations, **appearance** (`wallpaper`/`bubbleStyle` per-DM/group, `PATCH /:id/look`, `conversationLookSchema` — Space channels 403; priority conversation > Space > personal via `resolveChatLook`), `lastMessageAt`; messages are **not** embedded — **removed 2026-09-08:** `disappearingDuration` (24h/7d) deleted |
| `Message` | conversationId + senderId, content (4000), type `text/system/poll`, replyToMessageId (inline quote-replies), **threadId** (null = main timeline; set = reply inside the thread rooted at that message), reactions (subdocs), deliveredTo, readBy (`readBy` drives receipts — `message:read` carries `upToMessageId`/`upToCreatedAt`/`readAt` anchor), mentions, **attachments** (embedded; kind enum `image`/`document`/`audio`), **audioDuration** (seconds, voice messages only), **forwardedFromId + forwardedFromName** (forward attribution), **pinnedAt + pinnedBy** (pin is a timestamp, not a collection), **savedBy** (`[{userId, savedAt}]` per-user bookmarks), `isEdited` + `editHistory` (cap 10), `scheduledAt` + `status` (`sent`/`scheduled`), `forwardCount`, `poll` (when `type:poll`), `isDeleted` — **removed 2026-09-08:** `expireAt` + `status:"expired"` auto-delete |
| `FriendRequest` | directed `from`/`to` + status (`pending/accepted/declined`) + **welcomeMessage 280** + `welcomeMessageAt`; accepted rows are the friendship edge |
| `Space` | members (embedded: userId + role `owner/admin/moderator/member`), channels (embedded: text/announcement), category, slug, **appearance** (`{accent,tint}` palette + `wallpaper`/`bubbleStyle` chat look — the "Space look"; owner/admin-editable via Space settings, read by every member's client to scope the channel view), **visibility** (`public`/`private` — private hidden from Discover, joinable only by invite code), `inviteCode` + `inviteExpiresAt` (single rotating 7-day invite per Space, owner/admin-managed; codes are never included in Space payloads) |
| `Notification` | recipient/sender/**senderUsername** (denormalized for wave deep-link), type (`dm_message`, `group_message`, `space_message`, `mention`, `friend_request`, `friend_accept`, `space_invite` reserved, **`wave`** — per-recipient 20 s cooldown, `WAVE_COOLDOWN_SECONDS`), delivery flags (`inAppDelivered`/`pushDelivered`/`pushError`, bulk `insertMany` + async `persistPushState`) |
| `Status` | `userId` + `text` 280 + `background` enum 6 + `media{fileId,bucketId,url,kind:image|video,mimeType,size,fileName}` nullable + `viewers[{userId, viewedAt}]` + `expiresAt` indexed 24h (no TTL; hourly `cleanupExpiredStatuses()` deletes Appwrite file then doc), indexes `userId+expiresAt`, `createdAt -1`, `viewers.userId`, `expiresAt` — friends+blocked both-ways filtered in `listFeed` |
| `CustomEmoji` | `name` (2-32, lowercase alphanumeric + underscore), `spaceId` (null = global/personal), `ownerId` (null = global/space, ObjectId = personal Plus-only), `createdBy`, `url`, `fileId`, `bucketId`, `animated`; unique indexes: per-space name, per-owner name, global name |
| `PlusRequest` | `userId`, `utr` (12-digit UPI reference), `amountPaise` (4900), `status` (pending/approved/rejected/expired), `expiresAt` (24h review window), `reviewedAt`, `reviewNote`; indexes: status+createdAt, userId+status |
| `PushSubscription` | per-user VAPID endpoint + keys (unique endpoint, `{userId, endpoint}` unique) |
| `AdminActionLog` | audit trail: `ban_user`/`unban_user`/`grant_plus`/`revoke_plus`/`delete_group`/`delete_space` + IP + timestamp |

Design notes:

- **Messages live in their own collection** (never an unbounded array inside a conversation). Key indexes: `conversationId + createdAt`, `conversationId + threadId + createdAt` (thread panel feed), `senderId + createdAt`, `conversationId + pinnedAt` (pinned banner), `savedBy.userId + savedBy.savedAt` (Saved feed), plus a text index on `content` for search (thread replies excluded from results).
- Conversations/space channels each map 1:1 to a `Conversation` so every channel has its own message thread.
- Duplicate-DM prevention is enforced in the service layer (a unique index on an array does not behave as a pairwise constraint in MongoDB).

---

## Realtime (Socket.IO)

- Socket.IO is the primary realtime layer. All connections authenticate via **JWT handshake**; banned users are rejected at reconnect.
- On connect, sockets **auto-join** every conversation room (`conversation:<id>`) and space room (`space:<id>`) the user belongs to.
- Server emits into rooms after DB writes: `message:*` (new/edited/deleted/reaction/**pin-updated**, thread replies reuse `message:new`/`message:edited`/`message:deleted` with `threadId`), `conversation:*` (`member-added`/`member-removed`/`admin-changed`/`removed`/`updated` — `removed` also fans out per-user on permanent delete so both sides drop the thread live), `space:*` (`updated`/`member-*`/`channel-*`/`joined`/`removed`/`deleted`), `status:new/deleted/viewed` (friends-only vertical feed keep-alive, 24h TTL), per-user `notification:new` (incl. `wave`) and `friend:removed` (unfriend syncs both lists live).
- Clients emit `typing:start/stop` (re-broadcast), `conversation:focus/blur` (DM notification suppression — checked in `createForMessage` before fan-out), `message:delivered` (receipt ack), and call signaling `call:ring/accept/decline/end` (relayed with membership + block guards; 30s ring registry → `call:missed`).
- **Presence is in-memory and scoped**: `presence:online/offline` are only fanned out to users who share a conversation or space, with a ~12 s offline grace period to avoid flicker. `presence:snapshot` corrects late joiners. The DM list shows `online` dots; offline labels use `lastActiveAt` → "active X ago" (`last-active.js`, live tick).
- **Reconnect gap-fill:** after a reconnect the client refetches the conversation list (now via single-aggregation unread counts) and any messages newer than the newest known message (REST `after=`), then merges them into the cache.
- **Receipts** are client-driven: `message:read` carries `{ userId, upToMessageId, upToCreatedAt, readAt }` so taps show precise per-message state; `MessageBubble`/`ReceiptsPanel` build peers via `deliveredTo`/`readBy` + `participants` (DMs, groups, Space channels all work; panel captures `THEME_VARS` for <body> portal).
- This is a **single-instance** design today. Horizontal scaling would require a shared adapter (e.g. a Redis pub/sub adapter) — do not add Redis before that is actually needed.

---

## Caching, Rate Limiting, Storage, Push

### Redis — planned, not used yet

Redis is **not** currently a dependency. Rate limiting is an **in-memory fixed-window limiter** (`middleware/rateLimiter.js`) and presence is an in-memory map. If/when Redis arrives its role is acceleration only:

- rate limiting across instances, short-lived caching, unread counters, presence/typing for scaled Socket.IO
- **never** canonical storage for messages

### Rate limiting (current)

Per-user by default with IP fallback, `X-RateLimit-*` + `Retry-After` headers. Notable limits: register `5/hour/IP`, login `10/15min`, login-2FA code step `10/5min/IP`, 2FA setup `5/5min`, 2FA code verification `5/60s`, refresh `30/60s`, forgot/reset password `5/5min` & `10/5min`, resend-verification `1/min`, message send `40/min`, edit `20/min`, reactions `60/min`, friend requests `20/hour`, **user-search `30/min`**, **nearby `30/min`**, **location `10/min`**, space/channel creation `10/hour`, attachment uploads `10/min` (30 MB × 10 files each), search `30/min`, link-preview `30/min`, call-token `20/min`, status-create `10/day` + status-feed `30/min` + status-view `60/min`, plus-claim `5/day`, admin login `5/15min`.

### Appwrite Storage

Appwrite is **supporting infrastructure, not the core database**. It stores:

- **Avatars** — user/group photos (4 MB cap, allow-listed image MIME types, Appwrite preview URLs, old file deleted on replace)
- **Message attachments** — a separate bucket (`APPWRITE_ATTACHMENTS_BUCKET_ID`), images jpg/png/gif/webp + documents pdf/doc(x)/xls(x)/ppt(x)/txt + audio webm/ogg/mp3/m4a/aac/wav, 30 MB × 10 files, MIME allow-list enforced server-side; the bucket's allowed-file-extensions list must include the audio extensions or Appwrite rejects the upload
- **Custom emoji** — a separate bucket (`APPWRITE_EMOJI_BUCKET_ID`, falls back to attachments bucket), images jpg/png/gif/webp auto-normalized to webp (gif preserved), 2 MB per emoji, stored as `view` URL to preserve animation

Appwrite is optional at boot — the server runs without credentials and the upload endpoints return a clear `APPWRITE_NOT_CONFIGURED`/`BUCKET_NOT_CONFIGURED` error until they are set.

### Web Push

Offline notification delivery uses **`web-push` (VAPID)**, not Appwrite Messaging. Per-user subscriptions are stored in Mongo; dead endpoints (404/410) are cleaned up on send. The service worker deep-links notification clicks back into the conversation.

### Transactional email

**nodemailer** over **Gmail SMTP** (`GMAIL_USER`, `GMAIL_APP_PASSWORD`) for the password-reset flow and the email-verification resend flow. Sending is fire-and-forget so signup/login never blocks.

---

## Validation, Auth & Authorization

- **Zod** validates every body, query, and route param server-side. The client is never trusted.
- **Auth**: short-lived JWT access tokens (15 min) in `Authorization: Bearer`, plus an httpOnly refresh cookie backed by a `Session` document (TTL). Refresh is single-flight and does **not** rotate the cookie (rotation races can strand clients); sessions are revoked by deleting the document (logout, logout-all, password reset, admin ban).
- **2FA is optional per account**: TOTP per RFC 6238 implemented in-repo (`src/lib/totp.js`, SHA-1/30 s, constant-time compare) — no third-party TOTP runtime. `qrcode` renders the setup secret as a QR. The TOTP secret is stored server-side (verification requires it; it is only persisted as a pending secret until a setup code confirms it) and backup codes are bcrypt-hashed and single-use. Login mints a short-lived one-time JWT ticket (`5m`) that the second step exchanges for a real session only after a valid code; disable additionally requires the account password.
- **Authorization is resource-based**: membership checks for conversations/spaces/channels, sender checks for edit/delete, rank checks (`owner → admin → moderator → member`) for space moderation, owner-only rules for admin promotion, Space deletion, and last-owner protection.
- Centralized Express error handling with a consistent envelope:
```json
{
  "success": false,
  "error": { "code": "SOME_ERROR", "message": "Human readable message" }
}
```
Production errors never expose stack traces, secrets, connection details, or internal paths.

---

## Security Middleware

Secure CORS (`CORS_ALLOWED_ORIGINS`) · Helmet headers · JSON body limits · cookie security (`httpOnly`, `sameSite`, scoped path) · rate limiting · input validation · upload validation · auth + admin-auth middleware · centralized error handler · `trust proxy` for correct IPs behind a load balancer.

---

## Performance

Cursor-based pagination · `around=<messageId>` anchor fetch for jump-to-message · `after=<messageId>` catch-up fetch for reconnects · Mongo indexes on access patterns + text index for search · optimistic UI · IndexedDB caching (lists + last 50 messages) with stale-while-revalidate · debounced search & autocomplete · Socket.IO instead of polling · reduced-motion support. **Recent optimizations:** conversation list unread counts run as a **single `aggregate` (`unreadCountsByConversation`)** — no N+1 `countDocuments`; notifications fan out via one `insertMany` + batch pref fetch + fire-and-forget push (sender `POST /messages` doesn't wait on VAPID); `ChatPanel` memoizes the entire bubble list (`React.memo` `MessageRows`, stable `rowsCtx` ref, O(1) reply `byId` map) so typing/scroll/presence no longer re-renders every `MessageBubble`; double-tap like is throttled (500 ms) with 850 ms pop timer cleanup; presence + typing updates are scoped to sharing peers + offline grace; **voice waveform** is `useMemo` 32-bar deterministic (`fileId` seed, no canvas/fetch), bars are pure CSS divs (`transition-colors 75ms`, `tabular-nums` timer prevents CLS), shared `<audio>` + `passive` listeners; **in-chat search** highlight is client-side filtered `useMemo` + dim `opacity-40` non-matches + `ring-accent` active, no extra network. Do not optimize blindly — measure first when possible.

---

## Environment Variables

Keep secrets server-side. Backend (`backend/.env.example`): `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `ACCESS_TOKEN_TTL` (15m), `REFRESH_TOKEN_TTL` (7d), `REFRESH_COOKIE_SAMESITE`, `CORS_ALLOWED_ORIGINS`, `APPWRITE_*` (+ `APPWRITE_ATTACHMENTS_BUCKET_ID`), `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT`, `LIVEKIT_URL/API_KEY/API_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM`, `FRONTEND_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_JWT_SECRET`, `ADMIN_JWT_TTL`, `ADMIN_COOKIE_NAME`.

Frontend: `NEXT_PUBLIC_API_URL` (Socket.IO origin) and `BACKEND_URL` (Next rewrite target) — both default to `http://localhost:4000`.

Public browser variables are explicitly prefixed and contain no secrets. `.env.example` files are maintained; `*.env` is gitignored.

---

## Deployment

- **Frontend**: static/Next hosting (Vercel-class) with rewrites to the backend.
- **Backend**: a single always-available Node/Bun-compatible host that supports **long-lived WebSocket connections** for Socket.IO. Single instance for now (in-memory presence); scale out with a shared adapter when real users require it.
- **Database**: MongoDB Atlas.
- **Storage**: Appwrite Storage (avatars + attachments).
- **Push**: VAPID keys via env vars.

---

## Engineering Decisions (current & standing)

- JavaScript only across frontend and backend.
- Simple architecture over premature abstraction; domain-driven modules.
- No microservices. No direct frontend-to-database access.
- Realtime and persistence are separate concerns — MongoDB is authoritative; Socket.IO only distributes events.
- Redis is future acceleration/state infrastructure, not canonical storage.
- Appwrite supplements the core backend (storage only today).
- Notification **sound cues** are client-side only: `lib/sound.js` synthesizes short chimes with the Web Audio API (no audio assets), and per-category + master toggles persist in `localStorage["kivo:sounds"]`. Cues are triggered from live socket events (`message:new` for DM/group/Space/mention, `notification:new` for friend requests/waves) — the server never knows about audio, and the notification center + push remain the server-gated delivery paths.
- **Forwarding keeps server-side attribution**: `createMessage` accepts a bare `{ forwardedFromId }` (membership of the source conversation checked server-side, no mention resolution) and stamps the copy with the original author's display name; the client renders the "Forwarded from" pill from the payload, never from guesswork.
- **Pins are message fields, not a collection**: `pinnedAt`/`pinnedBy` on the message itself — toggling is a single update, listing is an indexed query (max 10, newest first), and soft-delete clears the pin for free.
- **Threads reuse the message collection**: a thread reply is just a `Message` with `threadId` set, and every main-timeline surface (list, cursors, search, pinned, unread counts) filters `threadId: null`. That keeps threads free of a second store while making them structurally quiet — replies never bump the unread badge or create category notifications, only `@mention` ones (mentions are resolved server-side from content, so they work identically in threads). The client keeps thread replies out of its IndexedDB message cache for the same reason.
- **Saved messages are embedded per user** (`Message.savedBy`, mirroring reactions): no join table, single-document toggle, and an indexed per-user feed query. Read endpoints resolve a per-user `saved` boolean so the UI never needs a second fetch; the Saved panel is client state over `GET /messages/saved` + the conversation list, reusing the same jump-to-message highlight flow as Ctrl+K search.
- **Link previews are unfurled server-side, never client-side**: the browser never fetches arbitrary pages (no IP leak, no mixed-content issues). The service parses `og:*`/twitter/`<title>`/meta tags with regex (no HTML parser dependency), guards SSRF on hostname + resolved IPs + post-redirect URL, and caches per URL for 1h — so popular links cost one fetch per hour. The client renders at most one card per message (first URL) and stays silent when there is nothing previewable, matching WhatsApp/Telegram behavior.
- **Timeline polish is derived, not stored**: day dividers come from `dayKey` comparisons at render time (no schema change), big-emoji from grapheme counting in `lib/emoji.js`, and the jump pill from scroll position + the existing `readBy` receipts — so none of these add server state, migrations, or socket traffic. Composer drafts live in `localStorage` (`lib/drafts.js`) for the same reason: unsent text is device-local ephemera, not account data.
- **Voice messages add no media pipeline**: the client records with `MediaRecorder` (opus/webm preferred, normalized to a bare audio MIME before upload) and the file rides the existing attachment upload — the server stores it as-is and the browser plays it straight from the Appwrite view URL. The only new state is `Message.audioDuration` (seconds, stamped at record time so bubbles show a duration before the audio loads) and a `kind: "audio"` attachment. Playback uses one shared client-side `<audio>` element (`preload="metadata"`, `passive` `timeupdate`, `Set` listeners) so only one voice message plays at a time; forwards copy the source's `audioDuration`. **Waveform is deterministic 32-bar pseudo-waveform** (`waveformHeights` seeded by `fileId`/`url`, `useMemo`, no network/canvas), bars `w 2.5→3px gap 2px h 18–96% rounded-full`, `bg-accent` filled vs `text-muted/25`, `tabular-nums` timer (`m:ss / m:ss`) prevents CLS, `role="slider"` seekable (`click` + `←/→ ±5s`, `Home`/`End`, `Space` toggle), responsive `min-w 220→260 sm:max-w 340`, `transition-colors duration-75`, shared glow `blur` only when playing.
- **Calls keep no server-side call state**: LiveKit rooms are deterministic per conversation (`kivo_<id>`) so late joiners and reconnects land in the same room; join tokens live 6h (no mid-call refresh); the only server state is the 30s ring registry in the socket layer (missed-call timeout). The client renders LiveKit tracks manually (no prebuilt conference UI) so every tile/control wears the app's own theme tokens, and `livekit-client` loads lazily to stay SSR-safe.
- **The chat look is CSS-first and stateless**: wallpapers are painted with `color-mix()` over the theme's own tokens (`--text-primary`/`--accent`), so one pattern definition re-tints for dark/light presets and per-Space palette scopes — no extra color state server- or client-side. Bubble geometry is two container-scoped CSS rules (`kivo-bubbles-squared`/`-outline`) on the chat panel, so styling flows to every descendant bubble (main timeline + thread panel) without prop drilling. `appearance.wallpaper`/`bubbleStyle` are enum ids stored on the User, Space, and Conversation (`PATCH /users/me` + `PATCH /spaces/:id` + `PATCH /conversations/:id/look`); partial appearance updates merge server-side (a color reset never wipes the chat look and vice versa), and `resolveChatLook()` merges **conversation > Space > personal** per field with "Member's own" (`null`) inheritance just like Space palettes.
- **Kivo Plus is an entitlement flag with UPI payments**: `User.plan` (`free`/`plus`) + `planExpiresAt` (30 days from grant) drives entitlements. The client is never trusted — `getEffectivePlan()` in `lib/plus.js` checks expiry server-side. UPI payments are self-serve: users pay ₹49 to the published UPI ID, submit a 12-digit UTR via `POST /plus/claim`, and admin reviews within 24h (`PlusRequest` model with pending/approved/rejected/expired states). The `/plus` page shows pricing, UPI steps, and claim status. Per-plan caps in `PLAN_LIMITS` (message length, attachments, file size, pins, saved, groups, spaces, channels, calls, search, polls, emoji) are enforced server-side via `getRequesterPlan()`. Hourly `sweepPlus()` lapses expired claims and scrubs Plus-only effects on expired accounts.
- **Wave is a tiny notification, not a chat message**: `POST /notifications/:id/wave` creates a `wave` notification (`senderUsername` denormalized, 20 s per-recipient cooldown `WAVE_COOLDOWN_SECONDS`, blocked/self guards `WAVE_BLOCKED`/`SELF_WAVE`), fans out through the same `notification:new` + VAPID push pipeline, and deep-links to `/u/username` from the center. No message row, no unread badge spam.
- **Receipts are derived from `readBy`/`deliveredTo` + `participants`**: the client groups other participants into Read vs Delivered via `buildReceiptPeers`; the "Seen by" card (`ReceiptsPanel`) is portaled to `<body>` so overflow never clips it, flips above/below based on viewport, and captures theme vars (`THEME_VARS`) because the theme lives on a wrapper, not `:root`.
 - **Nearby is full-screen distance-only, privacy-first**: `User.location` GeoJSON `Point` + `2dsphere` + `privacyPreferences.discoverableByNearby` default `true` (`NearbyScreen` `fixed inset-0 z-50` like `AppearanceScreen`). One-shot `getCurrentPosition` → `POST /me/location {lat,lng,accuracy}` (`10/min`, reject `accuracy>200` or `discoverable OFF`) stores `locationUpdatedAt`; `DELETE /me/location` clears on toggle OFF; `GET /nearby?radius=1/2/5/10km` (`30/min`, `$geoNear` + `fuzzDistanceMeters` `<1km→50m, ≥1km→0.1km`, filtered `isBanned`/`blockedUsers` both-ways/`friends|pending`/`stale>15min`/`discoverable`), radius chips, consent sheet `kivo:nearbyConsent`, `Permissions-Policy geolocation=(self)`; desktop rail **Nearby** + mobile **Menu → Nearby users** full-screen, desktop also via `nested-sidebar.jsx:508` `nearbyOpen` like `appearanceOpen`.
 - **Find is square cards + welcome message**: `ProfilePreviewCard` `rounded-2xl border bg-surface` square responsive grid (`grid-cols-1 sm:grid-cols-2`) with banner wash, avatar `lg`, verified/Plus chips, status/bio clamp, `SendRequestModal` (preview header + textarea 280 + counter) with **Send with message** vs **Send without**; `POST /friends/request {welcomeMessage}` stores `welcomeMessage` + snippet in notification, `GET /friends/requests` shows `Quote` bubble before accept; `GET /users/search` now blocked/banned filtered `30/min`, returns bio/status for card.
 - **Status is friends-only, photo-aware, status-tab first**: `Status` `expiresAt` 24h + hourly `cleanupExpiredStatuses()` (deletes Appwrite `media.fileId` then doc, replaces TTL to avoid orphaned files); `listFeed` groups by `userId` for WhatsApp Desktop vertical feed, `isViewed` per `viewers.userId`, blocked both-ways filtered via `User.blockedUsers`; creation `10/day` via `multer`+`STATUS_ALLOWED_MIMES` (image 30MB) → `uploadAttachment` (Appwrite `APPWRITE_ATTACHMENTS_BUCKET_ID`), `media` nullable (text-only keeps `background`), `status:new/deleted/viewed` keep `NestedSidebar` `activeTab==="status"` + mobile `BottomTabBar` in sync with green/grey `StatusRing` (`#25D366`/`var(--border)`), viewer photo 5s auto-advance, caption overlay.
- **Chat panel is memoized for the hot path**: `MessageRows` (`React.memo`) only re-renders on `messages`/`threadSummaries`/`firstUnreadId`/`editingId`/`selectedIds` etc.; handlers travel via a mutated `rowsCtx` ref to keep memo identity stable. Reply lookups are O(1) `Map`, swipe-to-reply is a direction-locked touch gesture, and like animation timers are cleaned up on unmount.
- **Custom emoji is three-tiered and Plus-gated**: Global (admin-only, 200 max), Space-scoped (Plus/admin, 100 per Space), Personal (Plus-only, 50 per user, usable everywhere). The `CustomEmoji` model uses sparse unique indexes per scope (space, owner, global) so the same `:name:` can exist across owners. Images are normalized via sharp (gif preserved for animation) and stored in Appwrite (`APPWRITE_EMOJI_BUCKET_ID` or fallback to attachments bucket). The client caches emoji in IndexedDB with stale-while-revalidate, and `:shortcode:` parsing happens client-side via `parseCustomEmoji()` in `lib/custom-emoji.js`. Reactions use `custom:<emojiId>` format. Realtime `emoji:new`/`emoji:deleted` events keep all clients in sync.
- Build only features supported by the current PRD; keep the UI fast and polished; reuse design tokens from `frontend/Design.md`.
- TypeScript is intentionally out of scope for this project.

## Future Scaling Direction

Initial topology:

```
Next.js ──► Express + Socket.IO (single instance) ──► MongoDB
                  │
                  ├── in-memory rate limiter & presence
                  ├── Appwrite (file storage)
                  └── VAPID web push
```

Later, if scale requires:

```
Load Balancer
├── API/Socket Server 1
├── API/Socket Server 2
└── API/Socket Server 3
        ▼
     Redis (adapter, rate limits, counters)
        ▼
     MongoDB
```

Only split services when actual scale or organizational complexity justifies it.
