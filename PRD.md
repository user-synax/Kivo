# Kivo — Product Requirements Document

**Version:** 2.8
**Last Updated:** September 4, 2026
**Status:** MVP Development (Core Messaging + Spaces + Notifications + Attachments + Email Verification/Password Reset + Link Previews + Timeline Polish + Composer Upgrades + Kivo Plus + Social/Wave + Read-Receipts Modal + Conversation Look + Perf Optimizations Complete)

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
            └── Attachments (images, docs & voice) ✅
            └── Threads (side-panel replies) ✅
```

| Concept | Description | Scope |
|---|---|---|
| **DM** | Private one-to-one communication | ✅ Complete |
| **Group** | Private small-group conversations (friends, college, projects, gaming) | ✅ Complete |
| **Space** | Community-level container similar to a Discord server | ✅ Complete |
| **Channel** | Text / announcement conversation inside a Space | ✅ Complete |
| **Notification** | In-app + web push events (message, friend, space) | ✅ Complete |
| **Push Subscription** | Per-user VAPID subscription for offline delivery | ✅ Complete |
| **Attachment** | Image/document/voice file attached to a message | ✅ Complete |
| **Thread** | Message-level side discussion in a dedicated panel | ✅ Complete |

---

## Current Implementation Status

### Summary

| Area | Status | Notes |
|---|---|---|
| Authentication & Sessions | **Complete** | JWT access + httpOnly refresh cookie, session-backed |
| Email Verification | **Backend wired** | Link flow (`/verify-email`, resend API); no auto-email at signup since the OTP step was removed |
| Password Reset | **Complete** | Forgot/reset via emailed token (1h), invalidates all sessions |
| User Profiles | **Complete** | Display name, username, bio, status + emoji chip (32 emoji + 6 vibe presets), avatar + frames, banner (curated + Plus custom 8 MB), country, GitHub username, **X/Instagram/YouTube/website social links**, **profileEffect** (4 Plus presets) |
| Friends System | **Complete** | Request/accept/decline, friend list, search |
| DM Conversations | **Complete** | Create, list, message history, unread counts (single-aggregation unread badge) |
| Messaging (text) | **Complete** | Send, edit, soft-delete, reactions, read/delivery receipts (**"Seen by" modal** — tap ticks on own message → avatar + `Read · time` / Delivered per participant, DMs/groups/Space channels, flip-positioned card, Escape/scroll dismiss), copy, select mode, **swipe-to-reply** (mobile) |
| **@Mentions** | **Complete** | Autocomplete + mention notifications |
| Message Replies | **Complete** | Reply-to with inline quote preview |
| Message Forwarding | **Complete** | Forward any visible message to another chat with a "Forwarded from @user" pill (original author kept, no caption) |
| Pinned Messages | **Complete** | Any member pins/unpins; banner under the chat header (newest first, max 10); unpin or message delete clears it |
| Typing Indicators | **Complete** | Realtime via Socket.IO |
| Presence | **Complete** | Online/offline, snapshot on connect |
| Realtime Events | **Complete** | Socket.IO with authenticated connections |
| Theme System | **Complete** | 10 themes (6 dark + 4 light), live switching; preset persisted in localStorage |
| Custom Colors (Theme Studio) | **Complete** | Per-user accent + canvas-tint overlay over any preset, live preview, saved to the account (`appearance` field) and synced on login |
| Space Palettes | **Complete** | Per-Space accent + tint (`Space.appearance`), set by owners/admins in Space settings with live preview; scoped to the channel chat view for all members |
| Chat Look (Wallpaper & Bubble Style) | **Complete** | `appearance.wallpaper` (`none`/`dots`/`grid`/`diagonal`/`bubbles`/`wash`) + `appearance.bubbleStyle` (`rounded`/`pill`/`squared`/`outline`) on user and Space (`chat-style.js`: `WALLPAPER_OPTIONS`, `BUBBLE_STYLE_OPTIONS`, `wallpaperCss`, `resolveChatLook`); wallpapers painted with CSS `color-mix()` over theme tokens (auto re-tint for dark/light + Space palettes, zero extra color state), bubble geometry via container-scoped CSS classes (`kivo-bubbles-*`); partial updates merge (a color reset never wipes the chat look and vice versa); Spaces can set per-field "member's own" inheritance; DMs/groups carry a shared conversation-level `appearance` (wallpaper/bubbleStyle) set via the chat header palette icon (`PATCH /conversations/:id/look`, `conversationLookSchema`) — either DM participant or group admins — resolving conversation > Space > personal per field |
| **Wave & Social Links** | **Complete** | `User.xUsername`/`instagramUsername`/`youtubeUrl`/`websiteUrl` + `githubUsername`; `social-links.jsx` chips + brand glyphs + contribution graph; **Wave** ping (`POST /notifications/:id/wave`, type `wave`, senderUsername denormalized, 20 s per-recipient cooldown, blocked/self guards) — deep-links to sender profile from notification center; **Share sheet + QR code** on `/u/username` |
| **Perf — Unread & Notifications** | **Complete** | `unreadCountsByConversation()` — one aggregation vs N+1 `countDocuments`; notifications bulk `insertMany` + batch-prefetch prefs + fire-and-forget `sendWebPushToUser` (sender's POST doesn't wait on VAPID); message list `React.memo` `MessageRows`, O(1) `byId` map, stable `rowsCtx`, throttled like/anim |
| Landing Page | **Complete** | Animated hero, floating navbar, responsive |
| Group Chats | **Complete** | Create, manage members, admins, realtime updates |
| Spaces & Channels | **Complete** | Create, discover, moderate, text/announcement channels |
| Space Discovery | **Complete** | Browse & search public spaces by category |
| Private Spaces & Invites | **Complete** | `public`/`private` Space visibility; private Spaces are hidden from Discover and joinable only via a rotating 7-day invite link (Space settings → Privacy & invites), with code join from Discover and `/app?join=CODE` deep links |
| Notification System | **Complete** | In-app notification center + DM-focused suppression + per-category sound cues (Settings → Sounds) |
| Web Push | **Complete** | VAPID push for offline users, PWA service worker |
| PWA / Installable | **Complete** | Manifest, icons, service worker |
| Mobile UX | **Complete** | Bottom tab bar, responsive panels, safe-area handling |
| Offline Caching | **Complete** | IndexedDB (`idb-keyval`) cache for conversations, Spaces, friends, requests |
| File & Image Attachments | **Complete** | Upload images + docs via Appwrite, lightbox, inline preview, download cards |
| Voice Messages | **Complete** | Hold-to-record mic in the composer (MediaRecorder), slide-up-to-cancel, inline play/pause player with progress + duration (`Message.audioDuration`), stored as-is in Appwrite (no transcoding); audio + duration preserved on forward |
| Threads | **Complete** | Any message hosts a side conversation: replies carry `threadId`, render in a dedicated panel (desktop drawer / mobile sheet), "N replies" chips under root bubbles, excluded from the main timeline & unread badge; thread replies only notify when @mentioned |
| Saved Messages | **Complete** | Bookmark any message (menu → Save message; own, others', thread replies); per-user `savedBy` on the Message; Saved panel (sidebar bookmark icon) lists them across chats newest-first with jump-to-message; deleted messages drop out |
| Mention Notifications | **Complete** | `@mention` feature shipped |
| **Global Search (Ctrl+K)** | **Complete** | Unified search: messages, people, spaces; jump-to-message |
| **Admin Panel** | **Complete** | Standalone dashboard: user/group/space management, ban/unban, **Plus plan grant/revoke** (`POST /api/admin/users/:id/plan`), audit logging (`AdminActionLog` `grant_plus`/`revoke_plus`) |
| **Offline Support** | **Complete** | Message cache (IndexedDB), offline indicator, durable send queue (outbox) that flushes queued text on reconnect |
| **Last Online Status** | **Complete** | "active … ago" labels for offline users (DMs + profiles) |
| **Mark as Unread** | **Complete** | Context-menu on conversations + "New messages" separator in chat |
| **Notification Preferences** | **Complete** | Per-category toggles (DMs, groups, mentions, friend requests, Space msgs, announcements) |
| **Blocking** | **Complete** | Block from DMs & profiles; **Blocked users manager** (Settings list + one-tap unblock); server-enforced, friendships removed |
| **Public Profiles & Verified Badges** | **Complete** | `/u/:username` pages with country flag + GitHub graph; admin-granted `verified`, user-controlled badge |
| **Kivo Plus (entitlement scaffold)** | **Complete** | `User.plan` (`free`/`plus`, admin-granted via `/admin` — no payments wired; `ADMIN_*` env); Plus perks so far: custom profile-banner upload (`PATCH /users/me/banner`, 8 MB, Appwrite, old file retired on switch) + profile effects (`profileEffect`: `none`/`glow`/`gradient-name`/`aura`, CSS `kivo-pfx-*` in `globals.css`, previewed in `ProfileEditModal`, enforced server-side — free users forced to `none`, downgrade resets to `none`) |
| **Reconnect Gap-Fill** | **Complete** | Conversation list + messages newer than newest-known refetched after socket reconnect |
| **Rate Limiting** | **Complete** | In-memory limiter across auth, messaging, search, uploads, admin |
| **Two-Factor Auth (2FA)** | **Complete** | TOTP via authenticator app (QR setup in Settings), one-time backup codes, two-step login challenge |
| **Link Previews** | **Complete** | `GET /api/v1/link-preview?url=…` unfurls og-title/description/image server-side (SSRF-guarded, 1h cache, 30/min); clickable links + first-URL preview card in bubbles (main timeline + threads) |
| **Date Dividers + Big Emoji** | **Complete** | Today/Yesterday/weekday/date pills across history (grouping breaks across days); 1–3 emoji-only messages render large and chromeless (`lib/emoji.js`, grapheme-aware) |
| **Jump-to-Latest Pill** | **Complete** | Floating "N new"/"Latest" button when scrolled off the live edge; auto-scroll only pins at the bottom (or for own sends) — history reading never yanked |
| **Composer Upgrades** | **Complete** | Per-conversation drafts in localStorage (debounced, cleared on send, survive reloads); paste-image attaches directly; ↑ on an empty composer edits last message; **mobile swipe-to-reply** (right swipe ~45 px with direction lock, haptics) |
| Voice / Video Calls | **Not started** | No voice/call backend or UI |

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
- Signup is **instant** — a session is issued immediately and the user lands in the app. **No OTP or verification wall** (the OTP sign-up step was removed).
- A link-based email-verification flow remains on the API (`POST /api/v1/auth/resend-verification` + `/verify-email?token=…`, 24h expiry, token stored hashed). An email is not automatically sent at signup currently.
- Duplicate email/username returns `CONFLICT` error.

#### 1.1.1 Email Verification

| Item | Detail |
|---|---|
| Verify link | `GET /api/v1/auth/verify-email?token=…` — marks `isEmailVerified = true` (24h expiry) |
| Resend | `POST /api/v1/auth/resend-verification` (authenticated, limit 1/min). No-op if already verified. |
| Banner | None currently — the resend endpoint is API-only after the OTP step was removed |
| Token storage | SHA-256 hash stored on the user (`emailVerificationTokenHash`), never the raw token |

#### 1.1.2 OAuth / Social Login (Google & GitHub)

Kivo supports signup and login via **Google** and **GitHub** OAuth in addition to the local email/password flow.

**Endpoints**

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/auth/oauth/providers` | No | Returns `{ google, github }` booleans — which provider buttons the login/signup pages should render |
| GET | `/api/v1/auth/oauth/:provider` | No | Starts the OAuth flow: emits a signed state JWT, builds the provider authorization URL, and 302-redirects the browser to Google/GitHub |
| POST | `/api/v1/auth/oauth/:provider/link-url` | Yes | For authenticated users linking a second provider in Settings: returns `{ url }` for the provider authorization URL (state embeds the userId) |
| GET | `/api/v1/auth/oauth/:provider/callback` | No | Public callback: exchanges the provider code for a profile, handles login/signup/linking, and 302-redirects to the frontend callback page with tokens/query in the URL |

**Flows**

- **Signup via provider:** clicking the button on `/signup` hits `GET /oauth/:provider`, which redirects to the provider. On consent, the backend callback creates a new account (email pre-verified, username generated from profile/email hints, provider avatar used if available) or auto-links to an existing local account with that email. The callback sets the httpOnly refresh cookie and passes the short-lived access token to the frontend `/oauth/callback` page in the URL. Rate limits: `oauth-start`, `oauth-callback`.
- **Login via provider:** same start/callback path; if the account has 2FA enabled, the callback redirects to `/login?oauth2fa=1` with a short-lived 2FA ticket in `sessionStorage` so the existing 2FA step can finish the login.
- **Account linking (Settings):** an authenticated user hits `POST /oauth/:provider/link-url` to get a provider authorization URL whose state embeds their userId. After consent, the callback links the provider to the existing account — no new account is created. Linking **both** Google and GitHub earns the native Kivo `verified` badge automatically (`recomputeNativeVerified`). Rate limit: `oauth-link` (10 per 60 s).
- **OAuth-only accounts:** accounts created via a provider have `passwordHash: null`. The login endpoint returns `OAUTH_ONLY_ACCOUNT` and tells the user to use the provider button instead. Disabling 2FA on such accounts is allowed (password is optional).

**Provider profile**

- Google: `openid email profile` scope; profile fetched from `userinfo` (sub = providerId, email verified by Google drives `isEmailVerified`).
- GitHub: `read:user user:email` scope; profile from `/user`, emails from `/user/emails` (requires at least one verified email). GitHub login also seeds `githubUsername` from the handle if unset.

**Verification badges**

- Each linked provider sets a per-provider flag (`googleVerified` / `githubVerified`) and stores the provider email (`googleEmail` / `githubEmail`).
- The public profile renders **Google Verified** / **GitHub Verified** chips when the respective flag is true.
- When **both** providers are linked, the user document's `verified` flag is set to `true` automatically (native Kivo verified badge) — no admin action needed.
- Providing the same provider identity to two different Kivo accounts is blocked (`PROVIDER_ALREADY_LINKED`); email auto-link only merges a provider into an existing local account when no other account already claims that provider id.

**Provider-only account protection**

- When a provider account is linked to an existing local account by email, the provider identity is attached and the email is marked verified; the local password (if any) stays valid.
- Provider `sub`/`id` lookups use sparse indexes so local-only accounts (null ids) do not collide.

**Environment variables**

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (default `${FRONTEND_URL}/api/v1/auth/oauth/google/callback`); `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI` (default `${FRONTEND_URL}/api/v1/auth/oauth/github/callback`). A provider button is only rendered when the backend reports it as configured (`isOAuthConfigured`).

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

#### 1.4.1 Password Reset

| Step | Endpoint | Behavior |
|---|---|---|
| Request | `POST /api/v1/auth/forgot-password` | Rate-limited `5/5min`; emails a reset link (1h expiry). Always returns success (no account enumeration). |
| Reset | `POST /api/v1/auth/reset-password` | Rate-limited `10/5min`; sets the new password and invalidates **all** sessions (force re-login everywhere). |

- Both endpoints are public (no auth).
- Frontend pages: `/forgot-password` and `/reset-password?token=…`.
- Token is stored hashed (`passwordResetTokenHash`); never the raw token.

#### 1.4.2 Transactional Email

All transactional email (verification, password reset) is sent via **nodemailer** over **Gmail SMTP**. Sending is fire-and-forget so signup/login never blocks. Env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM`, `FRONTEND_URL` (base URL for building email links; default `http://localhost:3000`).

#### 1.5 Route Protection

| Guard | Behavior |
|---|---|
| `GuestGate` | Redirects authenticated users away from `/login`, `/signup` to `/app` |
| `AuthGate` | Redirects unauthenticated users from `/app/*` to `/login` |

#### 1.6 User Profile

| Field | Type | Editable | Notes |
|---|---|---|---|
| displayName | String | Yes | Trimmed, max 50 |
| username | String | Yes | Unique, validated, 3–30 chars `^[a-zA-Z0-9_]+$` |
| bio | String | Yes | Max 280 characters |
| status | String | Yes | Max 60 characters (custom status line) |
| statusEmoji | String | Yes | Optional single emoji chip before the status line (max 8, 32-emoji picker + 6 **vibe presets**: Gaming/Vibing/Away/Studying/Working/Sleepy set emoji + text together) |
| banner | String | Yes | **Free:** curated animated GIF cover. **Plus:** custom upload via `PATCH /users/me/banner` (image/*, max 8 MB, Appwrite `avatar` bucket, old file deleted on switch) |
| profileEffect | String | Yes (Plus) | `none` / `glow` (avatar halo) / `gradient-name` (animated name) / `aura` (both). `PROFILE_EFFECT_IDS` in `users.validation.js`; free users forced to `none` server-side; downgrade resets to `none` |
| country | String | Yes | ISO-3166 alpha-2 → flag shown on profiles (`flagcdn.com`) |
| githubUsername | String | Yes | GitHub contribution graph on the public profile (max 39, `^[a-zA-Z0-9-]*$`) |
| xUsername | String | Yes | Social link chip — X/Twitter handle, no @ (max 60, `^[a-zA-Z0-9_]*$`) |
| instagramUsername | String | Yes | Social link chip — Instagram handle, no @ (max 60, `^[a-zA-Z0-9_.]*$`) |
| youtubeUrl | String | Yes | Social link chip — full `https://` URL (max 500) |
| websiteUrl | String | Yes | Social link chip — full `https://` URL (max 500) — brand glyphs via `social-links.jsx` (`SocialGlyph`) |
| plan | String | No | `free`/`plus`, admin-granted (`POST /api/admin/users/:id/plan`); see admin 7.2 |
| verified / showBadge | Boolean | No / Yes | Admin grants `verified`; the user toggles `showBadge` visibility in Settings |
| avatarStyle | String | Yes | One of 10 presets: Default + My accent (follows the theme token) + 6 solid colors + 2 gradient rings (`AVATAR_STYLE_IDS`) |
| avatarUrl | String | Via upload | Hosted on Appwrite Storage (`PATCH /users/me/avatar`, 4 MB) |
| email | String | No | Read-only |
| role | String | No | `user` or `admin` |

#### 1.7 Avatar & Banner Upload

- Avatar: `PATCH /api/v1/users/me/avatar` — Appwrite Storage, max **4 MB**, types `png/jpeg/webp/gif`, old file deleted on re-upload, removal `DELETE /api/v1/users/me/avatar` (`users.service.js` `deleteAvatar`).
- Banner (Kivo Plus): `PATCH /api/v1/users/me/banner` — same Appwrite bucket, **image/*, max 8 MB** (`users.service.js` `updateBanner`, `PLUS_REQUIRED` if not plus). Curated covers still via `PATCH /users/me` `{ banner: url | "" }`; switching from a custom upload to a curated/empty value retires the Appwrite file (`bannerFileId` cleared).
- Profile effects: `PATCH /api/v1/users/me` `{ profileEffect }` — `none`/`glow`/`gradient-name`/`aura` (`PROFILE_EFFECT_IDS`). Server clamps free users to `none`; downgrade via admin `setUserPlan` also clears.
- Validation in `users.validation.js`: `updateMeSchema` (`statusEmoji` max 8, `profileEffect` enum, `xUsername`/`instagramUsername` regexes, `youtubeUrl`/`websiteUrl` `^https?`, `country` `^[A-Z]{2}$`, `appearance` hex + enum).

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
| Pin / unpin message | `POST /api/v1/messages/:id/pin` | Must be participant |
| List pinned | `GET /api/v1/conversations/:id/pinned` | Must be participant (newest first, max 10) |
| List threads | `GET /api/v1/conversations/:id/threads` | Must be participant (active threads: root + summary) |
| Fetch thread replies | `GET /api/v1/conversations/:id/threads/:threadId/messages` | Must be participant (oldest first) |
| Save / unsave message | `POST /api/v1/messages/:id/save` | Must be participant (non-system, non-deleted) |
| Saved feed | `GET /api/v1/messages/saved` | Own saves across conversations, newest save first |
| Mark read | `PATCH /api/v1/conversations/:id/read` | Must be participant |
| **Receipts ("Seen by")** | **Tap ticks on own message (client)** | Must be participant — floating card shows per-user `Read · time` / `Delivered` (DMs, groups, Space channels); portaled, flip-positioned, `THEME_VARS` capture |

#### 3.4 Message Schema

```
Message {
  conversationId: ObjectId (indexed)
  senderId: ObjectId (indexed)
  content: String (max 4000 chars, blanked on soft-delete)
  replyToMessageId: ObjectId (nullable) — inline quote-reply target
  threadId: ObjectId (nullable) — set when the message is a thread reply; root messages are null
  reactions: [{ userId, emoji, _id }]
  savedBy: [{ userId, savedAt }] — per-user bookmarks (Saved messages)
  deliveredTo: [ObjectId]
  readBy: [{ userId, readAt }]
  forwardedFromId: ObjectId (nullable) — source message when forwarded
  forwardedFromName: String (nullable) — original author's display name
  pinnedAt: Date (nullable) — set when pinned
  pinnedBy: ObjectId (nullable) — who pinned it
  isEdited: Boolean
  isDeleted: Boolean
  createdAt: Date
  updatedAt: Date
}
```

**Indexes:**
- `{ conversationId: 1, createdAt: -1 }` — primary message query (main timeline filters `threadId: null`)
- `{ conversationId: 1, threadId: 1, createdAt: 1 }` — thread panel feed (oldest first)
- `{ senderId: 1, createdAt: -1 }` — moderation/search
- `{ conversationId: 1, pinnedAt: -1 }` — pinned banner query
- `{ savedBy.userId: 1, savedBy.savedAt: -1 }` — Saved feed per user

#### 3.5 Cursor-Based Pagination

- Messages fetched newest-first.
- Client sends `cursor` (message ID) to load older messages.
- Server returns messages before the cursor + `hasMore` flag.
- Frontend implements infinite scroll with `loadMore` on scroll-to-top.

#### 3.6 Optimistic UI

- Messages appear instantly in the UI before server confirmation.
- Failed messages show a retry button.
- Delivery states: sending → sent → delivered → read.

### 3.7 Mark as Unread & New Messages Separator

- Right-clicking a conversation in the sidebar opens a context menu with **Mark as unread**.
- `POST /api/v1/conversations/:id/unread` — with `{ messageId }` marks unread from that message forward; without one it uses the newest others' message as the anchor.
- Unread badges re-appear on the row, and opening the conversation shows a labelled **"New messages"** separator right where the unread run begins.
- The separator auto-clears (marks read) when the user scrolls to the bottom of the chat, or via the existing `PATCH /read` call.
- `message:unread` socket event keeps the sidebar badge in sync live.

---

### 3.8 Group Messaging & Conversation Look

Group chats are private multi-person conversations (2+ members) for friends, college, projects, and gaming squads.

| Action | Endpoint | Authorization |
|---|---|---|
| Create group | `POST /api/v1/conversations/group` | Authenticated (creator = first admin) |
| Update name/avatar | `PATCH /api/v1/conversations/:id` | Group admin |
| Add members | `POST /api/v1/conversations/:id/members` | Group admin |
| Remove member / leave | `DELETE /api/v1/conversations/:id/members/:userId` | Admin, or self-leave |
| Promote to admin | `POST /api/v1/conversations/:id/admins/:userId` | Group admin |
| Demote admin | `DELETE /api/v1/conversations/:id/admins/:userId` | Group admin |
| **Conversation look** | **`PATCH /api/v1/conversations/:id/look`** `{ wallpaper?, bubbleStyle? }` | DM: either participant; Group: admin only; Space channel: 403 `NOT_ALLOWED` |

**Conversation look rules**

- Enum ids `WALLPAPER_OPTIONS` (`none`/`dots`/`grid`/`diagonal`/`bubbles`/`wash`) + `BUBBLE_STYLE_OPTIONS` (`rounded`/`pill`/`squared`/`outline`) validated by `conversationLookSchema`; `null` per field = "Member's own" inheritance.
- `Conversation.appearance` (`wallpaper`, `bubbleStyle`) + `resolveChatLook({ conversationAppearance, spaceAppearance, personalAppearance })` priority: **conversation > Space > personal** per field.
- Partial merges never wipe sibling fields; emit `conversation:updated` so every member repaints instantly. Wallpapers are pure CSS `wallpaperCss()` / `color-mix()`; bubble geometry is `kivo-bubbles-*` on the chat container.

**Rules & constraints**
- A group needs at least **2 other members** (3 total, creator included).
- Creator is seeded as the sole first admin; `admins[]` is participants-only.
- The **last admin cannot be removed or demoted** — the group would be orphaned.
- Membership changes join/leave the live Socket.IO room immediately.
- System info messages are emitted for member joins/leaves ("Admin added X", "Y left the group") and render as centered chips — they never bump unread counts.

### 3.9 Message Replies

- Any message can be replied to via `replyToMessageId` (either in `POST /conversations/:id/messages` or on edit).
- The client renders an inline quote preview of the original message above the reply.
- Soft-deleted source messages keep their row so replies/ordering remain stable.

### 3.10 Forwarding & Pinned Messages

**Forwarding.**

- `POST /conversations/:id/messages` with `{ forwardedFromId }` (no other fields) copies the source message's content into the target conversation.
- The forwarder must be a participant of **both** the source and the target conversation; otherwise 403.
- The copy carries `forwardedFromId` + the source author's display name as `forwardedFromName`; the client renders a "Forwarded from @user" pill.
- Mention overrides are not resolved for forwarded copies (no spurious mention notifications).

**Pinned messages.**

- Any participant can pin/unpin via `POST /messages/:id/pin` `{ pinned }`; the pin is a timestamp, not a separate collection.
- `GET /conversations/:id/pinned` returns pinned messages, newest first, max 10.
- Pinning emits `message:pin-updated`; soft-deleting a pinned message clears its pin.

### 3.11 Threads (side-panel conversations)

**Model.**

- Any message can be a thread root. A thread reply is a normal `Message` with `threadId` = the root's id (roots have `threadId: null`); replies are **excluded from the main timeline** (`listMessages`, cursor/`after`/`around` pages, search, pinned list, and unread counting all filter `threadId: null`).
- Threads are **quiet by default**: replies never create category notifications (no `dm_message`/`group_message`/`space_message` pings) and never bump the conversation unread badge. **@mentions inside a thread still notify** (`mention` type, per the mentions preference).

**API.**

- `POST /conversations/:id/messages` with `{ threadId }` (content required; quoting/forwarding is not allowed inside threads) — the root must be a live non-system message in the same conversation and not itself a thread reply, else 400. Any member may reply in a thread, **including non-admins under announcement posts**.
- `GET /conversations/:id/threads` — active threads (root + `{replyCount, lastReplyAt, participants}`), used for the "N replies" chips.
- `GET /conversations/:id/threads/:threadId/messages` — root + replies, oldest first (cap 500), for the thread panel.
- Thread replies can't be pinned, and inline quote-replies can't target a thread reply (both 400). Reactions, copy, forward, edit (own), and delete (own) all work on thread replies.

**Realtime.**

- Thread replies fan out through the same `message:new`/`message:edited`/`message:deleted`/`message:reaction` room events; clients with the thread open append to the panel, everyone else refreshes chip summaries via `GET /threads`.

### 3.12 Saved Messages (bookmarks)

- Any visible message can be saved — your own, others', and thread replies. `POST /messages/:id/save` `{ saved }` toggles the current user's entry in `Message.savedBy` (membership required; system and soft-deleted messages are rejected).
- Conversation list payloads include a per-user `saved` flag (resolved at read time), so bubble menus render Save vs Unsave correctly without an extra fetch.
- `GET /messages/saved` returns the user's saves across every conversation they're still in, newest save first (cap 200); deleted messages are excluded, so removing a message clears it from the list. The client joins conversation labels/avatars from its own conversation list.
- Saves are purely personal (no notification, no broadcast) and follow the account across devices.

### 3.13 Links, Timeline Polish & Composer Upgrades

**Clickable links + previews.**

- Message text renders URLs as links (`target=_blank rel=noopener`, trailing punctuation and prose parens kept outside the clickable range; `frontend/lib/links.js`).
- The first URL per message unfurls a preview card (og-image, site name, title, 2-line description, domain). Preview data comes from `GET /api/v1/link-preview?url=…` (auth, `30/min` per user): the server fetches the page (8s timeout, 1.5MB cap), parses `og:*`/twitter/`<title>`/meta-description/favicon with relative-URL resolution, and caches per URL for 1h (500-entry cap). Hosts are SSRF-guarded (http(s) only; localhost/private/link-local rejected on the hostname and after DNS resolution, re-checked post-redirect). Pages with no title/description/image return `PREVIEW_EMPTY` and the link stays plain. The client caches previews per page-load (200-entry cap) and hides broken og-images to a text-only card.

**Date dividers + big emoji.**

- The main timeline inserts day pills (`Today` / `Yesterday` / weekday within 7 days / date + year when old; `dayKey`/`formatDayDivider` in `frontend/lib/chat.js`) for normal and system messages; sender grouping breaks across days.
- Messages of 1–3 emoji only (grapheme-aware via `Intl.Segmenter`, so ZWJ sequences, flags, and skin tones count as one; `frontend/lib/emoji.js`) render chromeless (`ghost` bubble) at 44/36/30px. Quotes, forwards, and attachments never go big; previews are suppressed for big-emoji.

**Jump-to-latest pill.**

- The chat auto-scrolls on new messages/typing only while the user is within 120px of the live edge (or for the user's own sends, which always pin). Otherwise a floating pill appears past 200px of scroll-up showing the unread count ("N new") or "Latest"; one tap smooth-scrolls to the bottom (instant under reduced-motion). Conversation switches still land at the bottom; anchor (jump-to-message) sessions still suppress auto-scroll.

**Composer upgrades.**

- Unsent text persists per conversation in `localStorage` (`kivo:drafts:<userId>`, 250ms debounce, 50-chat cap, 4000-char clamp; `frontend/lib/drafts.js`) across switches and reloads; sending clears the entry.
- Pasting an image from the clipboard feeds the existing upload queue directly (MIME-validated, fallback filename); text in the same paste still lands in the box.
- `↑` on an empty composer (mention popup closed) enters edit mode on the user's last own text message.

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
- **Last online** — `lastActiveAt` on the user (and last-seen tracking) drives "active X ago" labels for offline users in DMs and profiles (`frontend/lib/last-active.js`).

#### 4.3 Messaging Events

| Event | Direction | Description |
|---|---|---|
| `message:new` | Server → Room | New message in a conversation |
| `message:edited` | Server → Room | Message content updated |
| `message:deleted` | Server → Room | Message soft-deleted |
| `message:pin-updated` | Server → Room | Message pinned or unpinned |
| `message:new` (thread replies) | Server → Room | Same event as main messages; payload includes `threadId` so clients route to the thread panel / chip refresh |
| `message:reaction` | Server → Room | Reaction added or removed |
| `message:read` | Server → Room | Messages marked as read — payload carries the reader + the `upToMessageId`/`upToCreatedAt` anchor and `readAt`, so clients can stamp precise per-message receipts (group "Seen by") |
| `message:unread` | Server → Room | Conversation marked unread (badge + "New messages" separator) |
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

- 10 built-in themes stored in `lib/theme.js` (single source of truth).
- Theme applied via CSS custom properties at the `:root` level.
- Persisted in `localStorage` under `kivo:theme` (`THEME_STORAGE_KEY`).
- Live switching — no page reload required.
- Geometry (radius + shadow) is global design tokens in `globals.css`, so all themes share the same shape; only colors re-skin.

#### 5.2 Available Themes

| Theme | Family | Canvas |
|---|---|---|
| **Framer** (default) | Dark — Framer-style, blue accent | `#090909` |
| **Midnight** | Dark — deep navy | `#0a0e16` |
| **Graphite** | Dark — cool slate | `#0d0f12` |
| **Espresso** | Dark — rich warm brown | `#130e0a` |
| **Pine** | Dark — deep forest green | `#0a160f` |
| **Plum** | Dark — moody aubergine | `#100a14` |
| **Porcelain** | Light — neutral off-white | `#faf9f7` |
| **Linen** | Light — warm cream | `#f8f4ec` |
| **Mist** | Light — cool blue-gray | `#f5f7fa` |
| **Sage** | Light — soft green | `#f5f7f1` |

#### 5.3 Color Palette ("Framer" Dark)

Framer is the default palette; other themes only vary the canvas/surface hue cast on top of the same family.

| Token | Value (Framer) |
|---|---|
| base (canvas) | `#090909` |
| surface | `#141414` |
| elevated | `#1c1c1c` |
| text-primary | `#ffffff` |
| text-muted | `#999999` |
| border (hairline) | `#262626` |
| accent (blue signal) | `#4ba9e1` |
| online indicator | `#22c55e` |
| scrollbar-thumb | `#2a2a2a` |

#### 5.4 Typography

| Role | Font |
|---|---|
| Display / Headings | Outfit (loaded via `next/font`; styled through `font-goga` / `font-display`) |
| Body | Inter |
| Mono / Labels | System monospace stack (`font-mono`; JetBrains Mono intent) |

#### 5.5 Motion System

- Staggered text reveals, dropdown/panel open/close.
- Modal open/close, tabs sliding pill.
- Chat message entrance animations.
- Custom scrollbars, emoji picker.
- `prefers-reduced-motion` respected throughout.
- Built on `motion` (Framer Motion) + CSS transitions.

#### 5.6 Future Customization (Post-MVP)

> Shipped in the MVP: the **theme studio** — per-user accent + canvas-tint overlay applied over any of the 10 presets, persisted on the user record (`appearance: { accent, tint }`) and returned with every session/login. The engine (`derivePalette` in `lib/theme.js`) washes only the surface family and preserves each token's lightness, so contrast is never broken.

- Per-Space palettes and appearance overrides.
- Custom fonts.
- Advanced message styles.
- Custom emoji/reaction packs.
- Animated profile elements.
- Per-conversation appearance overrides (per-Space palettes are shipped — see the Space palette row above).
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
| Mobile (< 768px) | Stack: conversation list → chat panel → detail panel, with a **bottom tab bar** (Chats / Groups / Spaces / Menu); Profile, Settings and Appearance open as pushed screens from the Menu |
| Desktop (768px+) | Sidebar + chat panel + optional detail panel |
| Desktop XL (1280px+) | Three-column: sidebar + chat + user detail panel |

- `useIsDesktop()` (matchMedia 768px) drives responsive rendering across the shell, modals, and notification center.
- Safe-area insets handled for notch devices on mobile.

#### 6.3 Sidebar

- Conversation list with search/filter.
- Unread badges per conversation.
- Online presence indicators.
- Compose button (start new conversation).
- **Notification bell** with live unread count (opens the notification center).
- Theme switcher dropdown.
- Profile navigation at bottom.
- Collapsible to icon rail on desktop.
- Friend/group "add" buttons, Spaces & channels rail (Discord-style).

#### 6.4 Chat Panel

- Message list with cursor-based pagination.
- Smart auto-scroll (pins only at the live edge) + floating jump-to-latest pill with unread count.
- Day dividers across history; big-emoji bubbles; clickable links with og-image preview cards.
- Composer with per-chat drafts, paste-to-attach, and ↑-to-edit.
- Typing indicator display.
- Emoji picker (9 categories, 270+ emojis).
- Message menu (right-click / long-press): quick-react strip, copy, save, thread, reply, forward, pin, select mode, profile/block; edit & delete on own messages.
- Threaded replies render in a dedicated side panel with a composer (desktop right drawer / mobile full-screen sheet); "N replies" chips under root messages open it.
- Saved messages panel (sidebar bookmark icon): every bookmarked bubble across chats, newest save first; clicking a row jumps to the conversation and highlights the message.
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

### 7. Spaces & Communities

Discord-style community containers built on top of the existing conversation model.

#### 7.1 Concepts

| Concept | Description |
|---|---|
| **Space** | Community container: name, slug, description, category, avatar, banner, owner, **visibility** (`public`/`private`), single rotating **invite code + expiry** (admin-managed) |
| **Member** | A user with a role: `owner` → `admin` → `moderator` → `member` |
| **Channel** | Embedded subdocument in the Space (types: `text`, `announcement`), each backed by a `Conversation` with `type: "space_channel"` |

Role ranks: `owner 4 > admin 3 > moderator 2 > member 1`. Access control is rank-based server-side (`assertSpace`).

#### 7.2 Space Endpoints

| Method | Path | Authz |
|---|---|---|
| POST | `/api/v1/spaces` | Any authenticated user (auto-creates `#general`) |
| GET | `/api/v1/spaces` | Member — own spaces |
| GET | `/api/v1/spaces/discover?q=&category=` | Any authenticated user (lists **public** spaces only) |
| GET | `/api/v1/spaces/:id` | Member (non-member + private → 404, no existence leak) |
| PATCH | `/api/v1/spaces/:id` | Admin+ (incl. `visibility` toggle) |
| DELETE | `/api/v1/spaces/:id` | Owner only (cascades conversations) |
| POST | `/api/v1/spaces/:id/join` | Any authenticated user (**public** spaces; private → 403) |
| POST | `/api/v1/spaces/join/:code` | Any authenticated user with a valid, unexpired code (public or private) |
| GET | `/api/v1/spaces/:id/invite` | Admin+ (invite status; codes never ship in space payloads) |
| POST | `/api/v1/spaces/:id/invite` | Admin+ (create/rotate code, 7-day expiry) |
| DELETE | `/api/v1/spaces/:id/invite` | Admin+ (turn invites off) |

#### 7.3 Membership & Roles

| Method | Path | Authz |
|---|---|---|
| POST | `/api/v1/spaces/:id/members` | Admin+ |
| DELETE | `/api/v1/spaces/:id/members/:userId` | Admin+, or self-leave |
| PATCH | `/api/v1/spaces/:id/members/:userId/role` | Admin+ (owner→admin only by owner) |

**Rules**
- Cannot remove the **last owner**; owner self-leave auto-promotes the highest-ranking remaining member.
- Only the owner can promote to `admin`; `owner` role can't be assigned directly.
- Members are auto-added to / removed from every channel conversation and its live Socket.IO room.
- Public join adds the user as `member` and subscribes them to all channel rooms in real time.
- System messages are emitted into each channel on member join/leave/removal.

#### 7.4 Channels

| Method | Path | Authz |
|---|---|---|
| POST | `/api/v1/spaces/:id/channels` | Admin+ |
| GET | `/api/v1/spaces/:id/channels` | Member |
| PATCH | `/api/v1/spaces/:id/channels/:channelId` | Admin+ |
| DELETE | `/api/v1/spaces/:id/channels/:channelId` | Admin+ (last channel protected) |

- `#general` is auto-created on space creation and cannot be the last remaining channel deleted.
- Slug uniqueness enforced per-space; name synced to the backing `Conversation`.
- `announcement` channels are admin-facing; `text` channels allow all members.

#### 7.5 Discovery

- `GET /api/v1/spaces/discover` lists **public** spaces only (regex name/description search + `category` filter, limit ≤ 50).
- The frontend `SpaceDiscoverModal` provides search, category pills, one-click join, and a **"Have an invite code?"** field.
- **Private Spaces** are hidden from Discover and reject direct joins; joining requires a valid invite code via `POST /spaces/join/:code`.
- **Invite links**: one rotating code per Space (`Space.inviteCode` + `inviteExpiresAt`, 7-day TTL), created/rotated/revoked by owner/admins through Space settings → Privacy & invites. Codes are 12 hex chars, never included in Space payloads, idempotent for existing members, and expire cleanly (`INVITE_EXPIRED`). The frontend deep-links as `/app?join=CODE`; a failed deep link reopens Discover with the code prefilled.

#### 7.6 Realtime Events

`space:updated`, `space:member-added`, `space:member-removed`, `space:member-updated`, `space:channel-created`, `space:channel-updated`, `space:channel-deleted`, `space:joined`, `space:removed`, `space:deleted` — emitted into `space:<id>` rooms (or `emitToUser` for target-only notifications).

---

### 8. Search

#### 8.1 User Search (Friend Discovery)

| Search Type | Status | Notes |
|---|---|---|
| User search | **Complete** | By username, email, displayName; includes friend relationship status |

- Endpoint: `GET /api/v1/users/search?q=`
- Debounced on frontend.

#### 8.2 Global Search (Ctrl+K Command Palette)

Unified search across messages, people, and spaces in a single overlay.

| Search Type | Status | Notes |
|---|---|---|
| Message search | **Complete** | Regex on content, scoped to user's conversations |
| People search | **Complete** | Prefix + substring match on username/displayName |
| Space search | **Complete** | Regex on name, scoped to user's member spaces |

**Endpoint:** `GET /api/v1/search?q=<query>&limit=5` (auth required)

**Response:**
```json
{
  "messages": [{ id, content, senderName, conversationName, ... }],
  "users": [{ id, displayName, username, avatarUrl, ... }],
  "spaces": [{ id, name, category, channelCount, ... }]
}
```

**Rules:**
- Minimum 2 characters (enforced server-side).
- Results capped at 5 per category (default).
- Messages are scoped: only searches conversations the user participates in (DMs, groups, space channels).
- People exclude the requesting user.
- Spaces are scoped to spaces the user is a member of.

**MongoDB indexes:**
- `Message.content` (text index)
- `User.username`, `User.displayName`
- `Space.name`

**Frontend:** Ctrl+K / Cmd+K opens a command-palette overlay. 300ms debounce. Per-category loading states. Click message → jump to conversation + highlight. Click user → profile drawer. Click space → navigate.

#### 8.3 Anchor-Based Message Fetch

Extended `GET /api/v1/conversations/:id/messages` with optional `around=<messageId>` query param.

Returns a page of messages centered around the target message (half older, half newer). Used by jump-to-message from search results.

---

### 8. Notifications

End-to-end notification system covering **in-app** delivery and **web push** for offline users, layered on a PWA.

#### 8.1 Notification Types

| Type | Trigger |
|---|---|
| `dm_message` | New message in a 1:1 DM |
| `group_message` | New message in a group conversation |
| `space_message` | New message in a space channel |
| `friend_request` | A user sends you a friend request |
| `friend_accept` | A user accepts your friend request |
| `space_invite` | Reserved for a future "invite this person" notification (today's Space invites use rotating link codes) |
| `mention` | `@mention` in a message (shipped) |
| `wave` | A user taps **Wave 👋** on your profile (20s per-recipient cooldown) |

#### 8.2 Delivery Model

| Delivery | Condition | Mechanism |
|---|---|---|
| **In-app** | Recipient is online | Socket `notification:new` fanned out to the recipient |
| **Web push** | Recipient is offline | VAPID push to all stored subscriptions (non-blocking; delivery status persisted) |

- **DM-focused suppression** — when a recipient is actively viewing a DM (`io.isUserFocusedOnConversation`), notifications for that conversation are skipped entirely (spec: "when user is on the dm do not send them notification").
- System messages (`type: "system"`) never create notifications, and users are never notified of their own messages.
- For group/space messages, one notification document is fanned out **per recipient** (excluding the sender) via a **single `insertMany`** (batch-loaded prefs in one query) — the old sequential `create` loop is gone.
- `createForMessage` is **fire-and-forget** from `POST /messages`: the sender's response never waits on VAPID HTTP. Online recipients get `notification:new` synchronously; offline push (`sendWebPushToUser`) runs detached and persists `delivery.pushDelivered` afterwards via `persistPushState`.
- Expired push endpoints (HTTP 404/410) are removed automatically; overall push delivery success/error is tracked on the notification's `delivery` field.

#### 8.3 Notification Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/notifications/unread-count` | Yes | Unread notification count (badge) |
| GET | `/api/v1/notifications` | Yes | Cursor-paginated list; `?cursor=&limit=&unreadOnly=` (limit 1–100, default 20) |
| PATCH | `/api/v1/notifications/read` | Yes | `{ ids: [...] }` and/or `{ all: true }` mark read |
| GET | `/api/v1/notifications/preferences` | Yes | Read per-category notification preferences |
| PATCH | `/api/v1/notifications/preferences` | Yes | Update one or more preference toggles |
| POST | `/api/v1/notifications/:id/wave` | Yes | Send a **wave** ping to user `:id` (self-wave / blocked / 20s cooldown guards) |

#### 8.4 Notification Schema

```
Notification {
  recipientId:  ObjectId → User (required, indexed)
  senderId:     ObjectId → User (nullable)
  type:         enum ["dm_message","group_message","space_message",
                      "friend_request","friend_accept","space_invite","mention","wave"]
  conversationId: ObjectId → Conversation (nullable, indexed)
  messageId:    ObjectId → Message (nullable)
  spaceId:      ObjectId → Space (nullable)
  title:        String (required)
  body:         String (default "")
  avatarUrl:    String (nullable)
  read:         Boolean (default false)
  seen:         Boolean (default false)
  delivery: {
    inAppDelivered: Boolean,
    pushDelivered:  Boolean,
    pushError:      String
  }
  createdAt / updatedAt
}
```

**Indexes:** `{ recipientId, createdAt }`, `{ recipientId, read }`, `{ recipientId, type }`.

#### 8.5 UI

- `notification-bell.jsx` — bell icon with a live unread count badge.
- `notification-center.jsx` — dropdown feed with list, cursor-pagination, and mark-read actions.
- Notification **sounds** — per-category cues synthesized in-browser via Web Audio (`lib/sound.js`), with master + per-category toggles and preview buttons in Settings → Sounds (no audio assets).

---

### 9. PWA & Web Push

#### 9.1 Progressive Web App

- `public/manifest.json` — app name, icons (192/512 + apple-touch-icon), standalone display.
- `public/sw.js` — service worker with an **offline shell**: precaches static assets (`offline.html`, `manifest.json`, icons) into `kivo-precache-*`; serves content-hashed `/_next/static/*` **cache-first** (`kivo-runtime-*`); other static destinations (icons/fonts/images) **stale-while-revalidate**; answers navigations **network-first** with the last-known-good cached shell (`kivo-pages-*`) and falls back to the precached `offline.html` when nothing is cached. `/api/*` and `/socket.io/*` are never intercepted (chat data uses the app's IndexedDB cache + outbox). Also handles `push` events and notification click actions (deep-links into the app) and exposes a `KIVO_CLEAR_SHELL_CACHE` message for cache purges.
- Registered via `components/pwa-register.jsx` + `lib/pwa.js` on the app layout.

#### 9.2 Web Push (VAPID)

Backend uses the `web-push` library with VAPID keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`).

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/v1/push/vapid-public-key` | No | Public VAPID key (fetched by the SW before subscribing) |
| POST | `/api/v1/push/subscribe` | Yes | Register a push subscription `{ endpoint, keys: { p256dh, auth }, expirationTime? }` |
| DELETE | `/api/v1/push/unsubscribe` | Yes | Remove a subscription by endpoint |

**Ownership rules**
- Permission is opt-in via explicit user action (`requestPermission()`); no auto-prompt.
- `syncSubscription()` only auto-subscribes when permission is already granted and no subscription exists.
- `PushSubscription` is unique per user + endpoint; one user may hold multiple devices.

#### 9.3 PushSubscription Schema

```
PushSubscription {
  userId:          ObjectId → User (required, indexed)
  endpoint:        String (required, unique)
  keys: { p256dh: String, auth: String }
  expirationTime:  Date (nullable)
  userAgent:       String (nullable)
  createdAt / updatedAt
}
```

**Index:** `{ userId, endpoint }` unique.

---

### 10. File, Image & Voice Attachments

| Type | Status | Notes |
|---|---|---|
| Avatar uploads | **Complete** | Via Appwrite Storage, 4MB max |
| Image attachments | **Complete** | jpg, png, gif, webp — max 30MB each |
| Document attachments | **Complete** | pdf, doc, docx, xlsx, xls, ppt, pptx, txt — max 30MB each |
| Voice messages | **Complete** | webm, ogg, mp3, m4a, aac, wav — max 30MB each; hold-to-record, playback player, duration |

- Multiple attachments per message, mixed types allowed.
- Content (text) becomes optional when attachments are present.
- Server-side MIME validation and 30MB cap per file, enforced via Multer + Appwrite upload.
- Separate `attachments` bucket in Appwrite (public read, server-only write).
- **Voice messages add no backend load**: no transcoding or media pipeline — the recorded file is uploaded once via the existing endpoint, stored as-is, and played back by the browser straight from its Appwrite view URL. The only new state is a `Message.audioDuration` field (seconds, set at record time so bubbles render before the audio loads).
- **Setup note:** the Appwrite `attachments` bucket's allowed-file-extensions list must include the audio extensions (`webm`, `ogg`, `mp3`, `m4a`, `aac`, `wav`) or uploads are rejected — update it in the Appwrite console (Storage → bucket → Settings).
- **Image lightbox** — fullscreen centered modal with arrow-key navigation, download, filename label.
- PDF, document, and text files render as download cards; **voice files render as an inline player** (play/pause, seekable progress bar, duration). One shared `<audio>` element means only one voice message plays at a time.
- Per-file upload progress indicator in the composer.

#### Attachment Schema (on Message)

```
attachments: [{
  fileId:    String (Appwrite file ID)
  bucketId:  String (Appwrite bucket ID)
  fileName:  String (original filename)
  mimeType:  String (MIME type)
  size:      Number (bytes)
  kind:      String (enum: ["image", "document", "audio"])
  url:       String (Appwrite view/preview URL)
}]

audioDuration: Number  // seconds, 0-3600; voice messages only, null otherwise
```

#### Attachment Endpoints

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/attachments/upload` | Yes | Multipart: `{ conversationId, files[] }` (max 10 files, 30MB each) |

Response: `{ attachments: [{ fileId, bucketId, fileName, mimeType, size, kind, url }] }` — `kind` is `"audio"` for voice messages.

#### Message Create (updated)

`POST /api/v1/conversations/:id/messages` body: `{ content?, attachments?, audioDuration?, replyToMessageId? }` — at least one of `content` or `attachments` is required. `audioDuration` (0-3600) is stored on voice messages; forwards copy the source's `audioDuration` and ignore any client-supplied value.

---

### 11. Offline Support

#### 11.1 Message Caching

- Per-conversation cache in IndexedDB (keyed `messages:<conversationId>`), capped to last **50 messages**.
- **Stale-while-revalidate:** on conversation switch, render cached messages instantly, then silently revalidate via REST.
- Cache is updated in real-time during online use: after initial REST fetch, and on every incoming `message:new`, `message:edited`, `message:deleted`, `message:reaction` socket event.
- Cache is cleared on logout via `clearUserCache()`.

#### 11.2 Offline Indicator

- Derives `isOffline` from two signals: `navigator.onLine` (browser events) + Socket.IO connection state.
- User is offline only when **both** signals indicate disconnection (avoids flicker during brief reconnects).
- Shows a persistent "You are offline" banner in the sidebar; the composer stays usable and notes that text will queue.

#### 11.3 Offline Send Queue (Outbox)

- Composer remains enabled offline for **text messages**; attachments are rejected with an inline notice (uploads need a connection).
- Sending offline (or a failed online send) enqueues `{ tempId, conversationId, content, replyToMessageId, createdAt }` into a durable per-user outbox — `outbox:<userId>` in the same IndexedDB store (lib/outbox.js, persistence in lib/cache.js).
- The optimistic bubble carries `status: queued` and survives reloads (chat-panel rehydrates pending entries for the open conversation from the store).
- **Flusher** (`components/outbox/outbox-flusher.jsx`, mounted in the /app layout): pushes pending entries oldest-first via the existing REST create endpoint whenever a connection returns — socket reconnect (`reconnectNonce`), browser `online`, hydration after reload, and a 20 s retry timer while anything is pending.
- On success the entry is marked `sent` with the real server message for one render tick (chat-panel swaps the optimistic bubble and caches the message), then removed. Socket echoes / reconnect gap-fill remain the fallback reconcile paths (their matchers accept `queued` status).
- Failed entries stay marked `failed` with a per-bubble **retry**; duplicate-send risk is limited to an ambiguous timeout-then-retry (same semantics as the pre-queue manual retry).

#### 11.4 Anchor-Based Message Fetch

- Extended `GET /api/v1/conversations/:id/messages` with `around=<messageId>` query param.
- Returns a centered page of messages (half older, half newer) around the target.
- Used by jump-to-message from search results.

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
| POST | `/api/v1/auth/register` | No | No | `{ displayName?, username?, email, password }` (emails verify link) |
| POST | `/api/v1/auth/login` | No | 10/15min | `{ identifier, password }` |
| POST | `/api/v1/auth/refresh-token` | No | 30/60s | Cookie only |
| POST | `/api/v1/auth/logout` | Yes | No | — |
| POST | `/api/v1/auth/logout-all` | Yes | No | — |
| GET | `/api/v1/auth/verify-email` | No | No | `?token=` (24h expiry) |
| POST | `/api/v1/auth/resend-verification` | Yes | 1/min | — |
| POST | `/api/v1/auth/forgot-password` | No | 5/5min | `{ email }` |
| POST | `/api/v1/auth/reset-password` | No | 10/5min | `{ token, newPassword }` |
| GET | `/api/v1/auth/2fa/status` | Yes | — | Current 2FA state (`enabled`, `secret` for QR setup) |
| POST | `/api/v1/auth/2fa/setup` | Yes | 5/5min | `{ code }` — confirm setup code, activates 2FA + returns backup codes |
| POST | `/api/v1/auth/2fa/enable` | Yes | 5/60s | `{ code }` — enable with a TOTP code (alternative to setup confirm) |
| POST | `/api/v1/auth/2fa/disable` | Yes | 5/60s | `{ code }` — disable; requires current authenticator or backup code; invalidates backup codes |
| GET | `/api/v1/auth/oauth/providers` | No | — | Which OAuth providers are configured (`{ google, github }`) |
| GET | `/api/v1/auth/oauth/:provider` | No | oauth-start | Starts OAuth login/signup → 302 to provider |
| POST | `/api/v1/auth/oauth/:provider/link-url` | Yes | oauth-link (10/60s) | `{ }` → `{ url }` for Settings account-linking |
| GET | `/api/v1/auth/oauth/:provider/callback` | No | oauth-callback | Public callback — exchanges code, redirects to frontend |

#### Users

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/api/v1/users/me` | Yes | — |
| PATCH | `/api/v1/users/me` | Yes | `{ displayName?, username?, bio?, status?, avatarStyle? }` |
| PATCH | `/api/v1/users/me/avatar` | Yes | Multipart (max 4MB) |
| DELETE | `/api/v1/users/me/avatar` | Yes | — |
| GET | `/api/v1/users/search?q=` | Yes | — |
| GET | `/api/v1/users/:id` | Yes | — | Public profile fields by user id |
| PATCH | `/api/v1/users/me/banner` | Yes | Plus required | Multipart — custom banner upload (image/*, max 8 MB, Appwrite); Plus-only, free users get `PLUS_REQUIRED` |
| DELETE | `/api/v1/users/me/avatar` | Yes | — | Remove avatar (clears `avatarUrl` + `avatarFileId`) |

#### Conversations

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/conversations` | Yes | `{ participantId }` |
| POST | `/api/v1/conversations/group` | Yes | Multipart: `{ name, participantIds, avatar? }` |
| GET | `/api/v1/conversations` | Yes | — |
| PATCH | `/api/v1/conversations/:id` | Group admin | `{ name?, avatar? }` |
| POST | `/api/v1/conversations/:id/members` | Group admin | `{ userId }` |
| DELETE | `/api/v1/conversations/:id/members/:userId` | Group admin, or self | — |
| POST | `/api/v1/conversations/:id/admins/:userId` | Group admin | — |
| DELETE | `/api/v1/conversations/:id/admins/:userId` | Group admin | — |
| GET | `/api/v1/conversations/:id/messages` | Yes | `?cursor=&limit=&around=` |
| GET | `/api/v1/conversations/:id/pinned` | Yes | Pinned messages, newest first (max 10) |
| GET | `/api/v1/conversations/:id/threads` | Yes | Active threads (root + summary) |
| GET | `/api/v1/conversations/:id/threads/:threadId/messages` | Yes | Thread panel feed (root + replies, oldest first) |
| POST | `/api/v1/conversations/:id/messages` | Yes | `{ content?, attachments?, audioDuration?, replyToMessageId?, threadId?, forwardedFromId? }` (content/attachments, `threadId`, or `forwardedFromId` required; forward copies can't add a caption, thread replies can't quote/forward) |
| PATCH | `/api/v1/conversations/:id/read` | Yes | — |
| POST | `/api/v1/conversations/:id/unread` | Yes | `{ messageId? }` — mark unread from a message (or latest others') forward |
| PATCH | `/api/v1/conversations/:id/look` | Yes | DM: either participant; Group: admin; Space channel: 403 `NOT_ALLOWED` | `{ wallpaper?, bubbleStyle? }` — per-conversation chat look (`conversationLookSchema`; `null` per field = "Member's own" inheritance; priority conversation > Space > personal via `resolveChatLook`) |
| PATCH | `/api/v1/conversations/:id` | Group admin | `{ name?, avatar? }` — group name + avatar (routes file also mounts this for group updates) |
| POST | `/api/v1/conversations/:id/members` | Group admin | `{ userId }` — add members |
| DELETE | `/api/v1/conversations/:id/members/:userId` | Group admin or self | — — remove member / self-leave |
| POST | `/api/v1/conversations/:id/admins/:userId` | Group admin | — — promote to admin |
| DELETE | `/api/v1/conversations/:id/admins/:userId` | Group admin | — — demote admin |

#### Spaces

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/spaces` | Yes | `{ name, description?, category? }` |
| GET | `/api/v1/spaces` | Yes | Own spaces |
| GET | `/api/v1/spaces/discover` | Yes | `?q=&category=` |
| GET | `/api/v1/spaces/:id` | Member | — |
| PATCH | `/api/v1/spaces/:id` | Admin+ | `{ name?, description?, category? }` |
| DELETE | `/api/v1/spaces/:id` | Owner | — |
| POST | `/api/v1/spaces/:id/join` | Yes | Join public space |
| POST | `/api/v1/spaces/join/:code` | Yes | — | Join a space (public or private) with a valid, unexpired invite code |
| GET | `/api/v1/spaces/:id/invite` | Admin+ | — | Invite status (active code + expiry); codes never ship in space payloads |
| POST | `/api/v1/spaces/:id/invite` | Admin+ | — | Create / rotate invite code (7-day expiry) |
| DELETE | `/api/v1/spaces/:id/invite` | Admin+ | — | Turn invites off (clears `inviteCode` + `inviteExpiresAt`) |
| POST | `/api/v1/spaces/:id/members` | Admin+ | `{ userId }` |
| DELETE | `/api/v1/spaces/:id/members/:userId` | Admin+, or self | — |
| PATCH | `/api/v1/spaces/:id/members/:userId/role` | Admin+ | `{ role }` |
| POST | `/api/v1/spaces/:id/channels` | Admin+ | `{ name, type }` |
| GET | `/api/v1/spaces/:id/channels` | Member | — |
| PATCH | `/api/v1/spaces/:id/channels/:channelId` | Admin+ | `{ name?, type? }` |
| DELETE | `/api/v1/spaces/:id/channels/:channelId` | Admin+ | Last channel protected |

#### Messages

| Method | Path | Auth | Body |
|---|---|---|---|
| PATCH | `/api/v1/messages/:id` | Yes | `{ content }` |
| DELETE | `/api/v1/messages/:id` | Yes | — (soft-delete; clears pin) |
| GET | `/api/v1/messages/saved` | Yes | The caller's saved messages (newest save first) |
| POST | `/api/v1/messages/:id/save` | Yes | `{ saved }` — save/unsave (must be participant) |
| POST | `/api/v1/messages/:id/pin` | Yes | `{ pinned }` — pin/unpin (must be participant) |
| POST | `/api/v1/messages/:id/reactions` | Yes | `{ emoji }` |
| DELETE | `/api/v1/messages/:id/reactions/:reactionId` | Yes | — |

#### Attachments

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/attachments/upload` | Yes | Multipart: `{ conversationId, files[] }` (max 10 files, 30MB each) |

#### Friends

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/v1/friends/request` | Yes | `{ usernameOrEmail }` |
| GET | `/api/v1/friends/requests` | Yes | — |
| POST | `/api/v1/friends/requests/:id/accept` | Yes | — |
| POST | `/api/v1/friends/requests/:id/decline` | Yes | — |
| GET | `/api/v1/friends` | Yes | — |
| DELETE | `/api/v1/friends/:id` | Yes | — |

#### Notifications

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/api/v1/notifications/unread-count` | Yes | — |
| GET | `/api/v1/notifications` | Yes | `?cursor=&limit=&unreadOnly=` |
| PATCH | `/api/v1/notifications/read` | Yes | `{ ids: [...], all?: boolean }` |
| GET | `/api/v1/notifications/preferences` | Yes | — | Per-category notification preferences |
| PATCH | `/api/v1/notifications/preferences` | Yes | — | `{ directMessages?, groupMessages?, mentions?, friendRequests?, spaceMessages?, announcements? }` — update one or more toggles |
| POST | `/api/v1/notifications/:id/wave` | Yes | — | Send a **wave** ping to user `:id` (self-wave / blocked / 20 s cooldown guards; `WAVE_COOLDOWN`/`WAVE_BLOCKED` errors; `senderUsername` denormalized; deep-links to `/u/:username` from the notification center) |

#### Push

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/api/v1/push/vapid-public-key` | No | — |
| POST | `/api/v1/push/subscribe` | Yes | `{ endpoint, keys: { p256dh, auth }, expirationTime? }` |
| DELETE | `/api/v1/push/unsubscribe` | Yes | `{ endpoint }` |

#### Link Preview

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/api/v1/link-preview?url=…` | Yes (rate-limited 30/min) | — (returns `{ url, siteName, title, description, image, favicon, domain, cached }`) |

#### Admin (standalone panel at `/admin`)

Admin auth uses a separate JWT cookie (`admin_token`) — never mixed with user auth.

| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/api/admin/login` | No (rate-limited 5/15min) | `{ email, password }` |
| POST | `/api/admin/logout` | Admin cookie | — |
| GET | `/api/admin/verify` | Admin cookie | — |
| GET | `/api/admin/stats` | Admin cookie | — |
| GET | `/api/admin/users` | Admin cookie | `?page=&limit=&q=&banned=` |
| GET | `/api/admin/users/:id` | Admin cookie | — |
| POST | `/api/admin/users/:id/ban` | Admin cookie | `{ reason? }` |
| POST | `/api/admin/users/:id/unban` | Admin cookie | — |
| GET | `/api/admin/groups` | Admin cookie | `?page=&limit=` |
| DELETE | `/api/admin/groups/:id` | Admin cookie | — |
| GET | `/api/admin/spaces` | Admin cookie | `?page=&limit=` |
| DELETE | `/api/admin/spaces/:id` | Admin cookie | — |

**Environment variables:** `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (bcrypt), `ADMIN_JWT_SECRET`, `ADMIN_JWT_TTL`, `ADMIN_COOKIE_NAME`.

**Audit log:** `AdminActionLog` model records every ban/unban/force-logout/delete with `action`, `targetType`, `targetId`, `reason`, `ip`, `performedAt`.

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
| web-push 3.6.7 | VAPID web push notifications |
| nodemailer | Transactional email (verification, password reset) via Gmail SMTP |
| Multer | Multipart file upload handling |
| Appwrite | File & attachment storage (avatars + message attachments) |

**Runtime:** Bun (package manager + runtime for dev).

### Backend Module Structure

```
backend/src/
├── config/
│   ├── db.js              # Mongoose connection
│   ├── env.js             # Environment config with validation
│   └── webpush.js         # VAPID Web Push client
├── lib/
│   ├── appwrite.js        # Appwrite Storage client
│   └── attachments.js     # Attachment upload + validation helpers
├── middleware/
│   ├── auth.js            # JWT verification + role authorization
│   ├── errorHandler.js    # Centralized error + 404 handler
│   └── rateLimiter.js     # In-memory fixed-window rate limiter
├── models/
│   ├── User.js
│   ├── Session.js
│   ├── Conversation.js
│   ├── Message.js
│   ├── FriendRequest.js
│   ├── Space.js
│   ├── Notification.js
│   └── PushSubscription.js
├── modules/
│   ├── auth/              # Register, login, refresh, logout
│   ├── users/             # Profile, avatar, search
│   ├── conversations/     # DM/group creation, list, messages
│   ├── messages/          # Edit, delete, reactions
│   ├── friends/           # Request, accept, decline, list
│   ├── spaces/            # Spaces, channels, moderation, discovery
│   ├── notifications/     # In-app + push notification service
│   ├── push/              # VAPID push subscriptions
│   ├── attachments/       # File/image upload to Appwrite
│   └── admin/             # Force logout, user listing
├── socket/
│   ├── index.js           # Socket.IO init, presence, focus tracking, events
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
  isEmailVerified:   Boolean (default: false)
  emailVerificationTokenHash: String (select: false, nullable)
  emailVerificationExpires:   Date (select: false, nullable)
  passwordResetTokenHash:     String (select: false, nullable)
  passwordResetExpires:       Date (select: false, nullable)
  lastActiveAt:   Date (nullable)   # last-online status
  blockedUsers:   [ObjectId → User]
  isBanned:       Boolean (default: false, indexed)
  bannedAt:       Date (nullable)
  bannedReason:   String (nullable, max 500)
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
  type:           String (enum: ["dm", "group", "space_channel"], default: "dm")
  participants:   [ObjectId → User] (indexed)
  spaceId:        ObjectId → Space (nullable, for space channels)
  name:           String (nullable, for groups/space channels)
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

#### Space
```
{
  name:           String (required)
  slug:           String (unique)
  description:    String
  category:       String (SPACE_CATEGORIES)
  ownerId:        ObjectId → User
  avatar:         String
  banner:         String
  channels:       [{ name, type: "text"|"announcement", slug }] (embedded)
  members:        [{ userId, role: "owner"|"admin"|"moderator"|"member" }]
  createdAt:      Date
  updatedAt:      Date
}
```

#### Notification
```
{
  recipientId:       ObjectId → User (required, indexed)
  senderId:          ObjectId → User (nullable)
  type:              enum ["dm_message","group_message","space_message",
                           "friend_request","friend_accept","space_invite","mention"]
  conversationId:    ObjectId → Conversation (nullable, indexed)
  messageId:         ObjectId → Message (nullable)
  spaceId:           ObjectId → Space (nullable)
  title:             String (required)
  body:              String (default "")
  avatarUrl:         String (nullable)
  read:              Boolean (default false)
  seen:              Boolean (default false)
  delivery: { inAppDelivered: Boolean, pushDelivered: Boolean, pushError: String }
  createdAt:         Date
  updatedAt:         Date
}
```
**Indexes:** `{ recipientId, createdAt }`, `{ recipientId, read }`, `{ recipientId, type }`.

#### PushSubscription
```
{
  userId:           ObjectId → User (required, indexed)
  endpoint:         String (required, unique)
  keys: { p256dh: String, auth: String }
  expirationTime:   Date (nullable)
  userAgent:        String (nullable)
  createdAt:        Date
  updatedAt:        Date
}
```
**Index:** `{ userId, endpoint }` unique.

#### AdminActionLog
```
{
  action:         String (enum: ["ban_user", "unban_user", "force_logout", "delete_group", "delete_space"])
  targetType:     String (enum: ["user", "group", "space"])
  targetId:       ObjectId (required)
  targetName:     String (nullable)
  reason:         String (nullable, max 500)
  ip:             String (nullable)
  performedAt:    Date (indexed)
}
```
**Index:** `{ targetType, targetId }`.

### Frontend Pages

| Route | File | Purpose | Auth |
|---|---|---|---|
| `/` | `app/page.js` | Landing page (hero + navbar) | GuestGate |
| `/login` | `app/(auth)/login/page.jsx` | Login form | GuestGate |
| `/signup` | `app/(auth)/signup/page.jsx` | Signup form | GuestGate |
| `/forgot-password` | `app/(auth)/forgot-password/page.jsx` | Request password reset | GuestGate |
| `/reset-password` | `app/(auth)/reset-password/page.jsx` | Set new password via token | GuestGate |
| `/verify-email` | `app/(auth)/verify-email/page.jsx` | Verify email from emailed link | GuestGate |
| `/app` | `app/app/page.jsx` | Main dashboard | AuthGate |
| `/app/profile` | `app/app/profile/page.jsx` | User profile | AuthGate |
| `/docs` | `app/docs/page.jsx` | How-to-use guide | Anyone |
| `/admin` | `app/admin/page.jsx` | Admin login | Admin cookie |
| `/admin/dashboard` | `app/admin/dashboard/page.jsx` | Admin dashboard | Admin cookie |

### Frontend Component Tree

```
components/
├── auth-guard.jsx            # GuestGate + AuthGate
├── socket-provider.jsx       # Socket.IO context
├── theme-provider.jsx        # Theme context
├── pwa-register.jsx          # Service worker/PWA registration
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
├── notifications/
│   ├── notification-bell.jsx # Bell with unread badge
│   └── notification-center.jsx # Notification feed dropdown
├── dashboard/
│   ├── dashboard-shell.jsx   # Main dashboard orchestrator
│   ├── sidebar.jsx           # Conversation list + controls
│   ├── chat-panel.jsx        # Active chat view
│   ├── message-bubble.jsx    # Individual message bubble
│   ├── avatar.jsx            # Avatar with initials fallback
│   ├── emoji-picker.jsx      # 9-category emoji picker
│   ├── friends-modal.jsx     # Friends management modal
│   ├── group-create-modal.jsx # Group creation modal
│   ├── group-settings-panel.jsx # Group member/admin management
│   ├── profile-edit-modal.jsx # Profile editing modal
│   └── user-panel.jsx        # Right-hand detail panel
├── chat/
│   ├── attachments.jsx       # Image grid, lightbox, PDF/doc download cards
│   └── chat-bubble.jsx       # Reusable chat bubble
├── spaces/
│   ├── space-sidebar.jsx     # Space channel list
│   ├── space-settings-panel.jsx # Space moderation panel
│   ├── space-discover-modal.jsx # Discover public spaces
│   ├── space-create-modal.jsx # Create space modal
│   ├── space-card.jsx        # Space card for discovery
│   └── channel-list.jsx      # Channels within a space
├── docs/
│   └── docs-screen.jsx       # In-app how-to-use guide
└── ui/
    ├── button.jsx            # shadcn Button
    └── bubble.jsx            # shadcn Bubble primitive
```

**Note:** `lib/` also includes `push.js` (web push helpers), `sound.js` (notification sounds), `pwa.js`, `banners.js` (animated GIF profile banners), `avatar-styles.js`, `use-file-upload.js` (attachment upload hook), and `chat.js` (message send helpers).

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

- Report/submission moderation queue (user blocking is shipped).
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
| Storage | Appwrite Storage | Avatars + message attachments (separate buckets) |
| Push | Web Push (VAPID) | Shipped — offline web push delivery |
| Push (future) | Appwrite Messaging | Planned for FCM/APNs native push |

### Environment Variables

**Server-side (never exposed to browser):**
- `MONGODB_URI`
- `PORT`
- `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` (+ optional `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `REFRESH_COOKIE_SAMESITE`)
- `APPWRITE_ENDPOINT`
- `APPWRITE_PROJECT_ID`
- `APPWRITE_API_KEY`
- `APPWRITE_BUCKET_ID` (avatars)
- `APPWRITE_ATTACHMENTS_BUCKET_ID` (message attachments)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` (transactional email — password reset, verification resend)
- `EMAIL_FROM` (From header for outgoing mail)
- `FRONTEND_URL` (base URL for email verify/reset links)
- `CORS_ALLOWED_ORIGINS`
- `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH` / `ADMIN_JWT_SECRET` / `ADMIN_JWT_TTL` / `ADMIN_COOKIE_NAME`
- `NODE_ENV`

**Client-side (explicitly prefixed):**
- `NEXT_PUBLIC_*` (no secrets)

Maintain `.env.example` in both frontend and backend.

---

## Out of Scope for MVP

- Slack-style work-management features
- Full voice channels / video calls / screen sharing (not started — no backend or UI)
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
- Group chats (create, manage members, admins).
- Spaces & Channels with moderation and discovery.
- End-to-end notification system (in-app + web push via PWA).
- `@mention` feature with autocomplete + mention notifications.
- Mobile UX (bottom tab bar, responsive panels) + IndexedDB offline caching.
- File & image attachments (images, PDFs, docs) with lightbox & inline previews.
- **Voice messages** (hold-to-record mic, inline playback, duration) — attachments extended with an `audio` kind, no transcoding.
- **Email verification** (instant signup — no OTP; `/verify-email` link + resend API) and **password reset** (forgot/reset via email).
- **Last online status**, **Mark as unread / New messages separator**, and **reconnect gap-fill**.
- **Global search (Ctrl+K)**, **admin panel**, **public profiles** (`/u/:username`, badges, GitHub graphs), **blocking**, **notification preferences**, and **rate limiting**.

### Phase 1.5 — Voice Foundations

- DM & group voice calls (no backend or frontend yet).
- Voice channel frontend.
- Automatic verification email at signup / in-app resend banner.

### Phase 2 — Enhanced Messaging

- Per-conversation mutes & quiet hours (beyond the shipped per-category preferences).
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
- Marketplace themes & theme sharing.

---

## Success Criteria

The MVP is successful when:

1. Users can reliably communicate in realtime (DMs, typing, presence, read receipts).
2. Conversation loading is fast with cursor-based pagination.
3. Mobile and desktop UX both feel polished.
4. Customization is visibly deeper than ordinary chat apps (10 themes — 6 dark + 4 light — plus a per-user theme studio for accent & canvas color, account-synced).
5. Permissions and security are enforced server-side.
6. The architecture can support future voice/video/community features without rewriting.

---

## Visual Direction

Design source of truth: `frontend/Design.md`

- **Canvas:** `#090909` (near-black)
- **Surface:** `#141414` / **Elevated:** `#1c1c1c`
- **Accent:** `#4ba9e1` (blue signal)
- **Text:** `#ffffff` / muted `#999999`
- **Border (hairline):** `#262626`

Design ratio: **85% minimal / 15% personality**.

Personality comes from product UI, customization previews, reactions, and micro-interactions — not from excessive gradients, glow, 3D decoration, or animation.

### Design Principles

- Near-black canvas.
- Hairline borders.
- Generous whitespace.
- Minimal shadows.
- Strong geometric headings (Goga).
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
