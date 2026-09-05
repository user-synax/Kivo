# Kivo — Features & How to Use

**Kivo** is a realtime chat app: WhatsApp-style DMs and groups plus Discord-style Spaces and channels. This guide covers every shipped feature and how to use it in the product.

Related docs: [`README.md`](./README.md) (setup) · [`PRD.md`](./PRD.md) (spec & API) · [`TECH-STACK.md`](./TECH-STACK.md) (architecture)

---

## Quick start

1. Open the site (local default: [http://localhost:3000](http://localhost:3000)).
2. Sign up or log in.
3. You land on **`/app`** — the chat dashboard.

If you are already logged in, `/login` and `/signup` send you to `/app`. If you are not logged in, `/app` sends you to `/login`.

**Local development** (Bun):

```bash
# backend (terminal 1)
cd backend && bun install
cp .env.example .env   # then fill in MongoDB/Appwrite/VAPID/Gmail values
bun run dev            # http://localhost:4000

# frontend (terminal 2)
cd frontend && bun install
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
bun run dev            # http://localhost:3000
```

Next.js rewrites proxy `/api/*` and `/socket.io` to the backend (see `BACKEND_URL`), so REST calls stay same-origin; the Socket.IO client connects straight to `NEXT_PUBLIC_API_URL`.

---

## Pages

| URL | Who can open it | What it is |
|-----|-----------------|------------|
| `/` | Anyone | Landing page (Features, Customization, Security, Roadmap). Logged-in users are sent to `/app`. |
| `/login` | Guests | Log in with email **or** username + password. |
| `/signup` | Guests | Create an account. |
| `/forgot-password` / `/reset-password?token=…` | Anyone | Reset a forgotten password via emailed link. |
| `/verify-email?token=…` | Anyone | Validate an email-verification link. |
| `/app` | Signed-in users | Main chat: conversation lists, Spaces, Settings. |
| `/app/profile` | Signed-in users | Read-only profile summary and **Log out**. |
| `/u/:username` | Anyone | **Public profile** — shareable page for any user (badge, country, GitHub graph, actions). |
| `/docs` | Anyone | In-app "How to use Kivo" guide. |
| `/admin`, `/admin/dashboard` | Admins | Standalone admin panel (separate login). |

---

## 1. Create an account

**Where:** `/signup`

1. Enter **display name**, **username**, **email**, and **password** (at least 8 characters, with a confirm field).
2. Submit. **You are signed in immediately and taken to `/app`** — there is no OTP or verification wall, so you can start chatting right away.

**Rules**

- Password: at least 8 characters.
- Username: 3–30 characters; letters, numbers, and underscores only. Unique.
- Email: unique, valid format.
- Email verification is a link-based flow on the backend (`/verify-email?token=…`, resend API). Signup currently does **not** email a verification link automatically and there is no in-app resend banner — nothing blocks chat either way.
- Registration is rate-limited (5 per hour per IP), login 10 per 15 minutes.

### Sign up with Google or GitHub

You can also create an account (or log in) with **Google** or **GitHub** — no password needed.

1. On `/signup` (or `/login`), click **Sign up with Google** or **Sign up with GitHub**.
2. You are taken to the provider's consent screen. Authorize Kivo.
3. If this is a new Kivo account, one is created for you automatically (your email is pre-verified, a username is generated from your profile/email, and your provider avatar is used if available).
4. You land in `/app` immediately.

**What happens behind the scenes**

- If you already have a Kivo account with that email (local password account or another provider), the provider is **auto-linked** to your existing account — you keep your conversations and friends, and your email becomes verified instantly.
- If the same provider account (Google `sub` / GitHub `id`) is already linked to a *different* Kivo account, you get a clear error and cannot double-link.
- Some accounts are **OAuth-only** — they have no password. If you try to log in with email+password on such an account you are told to continue with the provider instead.

**Provider badges**

When you sign up or link a provider, your public profile (`/u/username`) shows a **Google Verified** or **GitHub Verified** chip. Linking **both** providers earns you the native **Kivo Verified** badge (admin-granted `verified` is not required).

Rate limits: OAuth start is rate-limited separately from password login (`oauth-start`), the callback is rate-limited (`oauth-callback`), and the account-linking step is rate-limited (`oauth-link`, 10 per 60 s).

> **Setup note:** Google and GitHub OAuth require provider credentials on the server (see `GOOGLE_CLIENT_ID/SECRET` and `GITHUB_CLIENT_ID/SECRET` in `backend/.env.example`). If a provider is not configured, the buttons redirect back with an `OAUTH_NOT_CONFIGURED` message.

---

## 2. Log in and log out

**Log in** (`/login`)

1. Enter your **email or username** and password, then submit.
2. Or click **Continue with Google** / **Continue with GitHub** for passwordless sign-in.
3. If two-factor authentication is enabled on the account, you'll be asked for an authenticator or backup code next (see §21) — then you go to `/app`.

Sessions use a short-lived access token plus an httpOnly refresh cookie. The app refreshes the access token automatically before it expires (single-flight, 60 s before expiry).

**OAuth-only accounts** — some accounts were created via Google or GitHub and have no password. If you try to log in with email+password on one of these, you are told to continue with the provider button instead.

**Forgot your password?**

1. On the login page, click **Forgot password** (→ `/forgot-password`).
2. Enter your account email. Kivo sends a **reset link** (expires in 1 hour).
3. Open the link (→ `/reset-password`), choose a new password, and submit.
4. All your existing sessions are signed out — log in again with the new password.

**Log out**

Open the **Profile** tab (mobile) or click your avatar in the rail (desktop), then the full profile **or** go to `/app/profile`, and click **Log out**.

That ends the current session. There is also a server endpoint to log out of **all** devices (`POST /api/v1/auth/logout-all`); it is not exposed as a button in the UI yet.

---

## 3. Dashboard layout

### Desktop & tablet (md+)

A **icon rail** on the far left switches between four panels — **Chats**, **Groups**, **Spaces**, and **Settings** — with your **avatar at the bottom** for the profile editor. Unread dots appear on the rail icons whenever a category has unread activity.

Inside the active panel:

- **Header** — the notification **bell**, the **global search** button (Ctrl+K), and per-tab actions (the **New** menu in Chats; **New group** in Groups; **Discover** + **New** in Spaces).
- A **scoped search field** filters the current tab (chats / groups / spaces).
- The list shows DMs or groups as rows (with last message, time, unread badge, and online dot for DMs) or Spaces as expandable cards listing their channels.
- The **"You are offline"** banner appears here when disconnected.

### Center chat

The open conversation or channel. For DMs on very wide screens a **right panel** shows the other person's profile; group/Space settings open as a **drawer** or a persistent side column.

### Mobile

On a phone, Kivo shows a **bottom tab bar** with four destinations — **Chats**, **Groups**, **Spaces**, and **Menu** — so navigation feels native. The **Menu** tab opens your profile, **Appearance** (a full-screen theme page), and **Settings** as pushed screens with a back button to the Menu. Open a chat to see messages; use **Back** (header or edge-swipe) to return to the list. Safe-area insets are handled on notched devices.

**Remembered state & instant paint:** the last open conversation is restored after refresh, Space expand state is saved, and your conversations, Spaces, friends, and friend requests are cached in the browser (IndexedDB), so lists paint instantly while fresh data loads. The latest 50 messages of each chat are cached too.

---

## 4. Friends

**Open:** the **New** menu (Chats panel) → **Friends** — or, in the app, the people control that opens the friends modal.

The modal has three tabs: **Requests**, **Friends**, **Add**.

### Add a friend

1. Open **Friends** → **Add**.
2. Search by **username**, **email**, or **display name** (search is debounced).
3. Click **Add** on a result.

You cannot friend yourself or send a duplicate request. If they already requested you, accepting makes you friends immediately.

### Incoming requests

1. Open **Friends** → **Requests**.
2. **Accept** or **Decline**.

The other person gets an in-app (and possibly push) notification.

### Start a DM from a friend

On the **Friends** tab, click **Message**. That opens or creates a 1:1 conversation.

### Remove a friend

Open the person's profile (public page `/u/username` or the in-app profile drawer) and click **Unfriend**.

---

## 5. Direct messages (1:1)

### Start a DM

- From **Friends** → **Message**, or from a profile page/drawer → **Message**.

DMs are unique per pair: starting chat again reuses the existing conversation.

### Find a conversation

- The **Chats** panel lists **Direct Messages**, newest activity first.
- Use the **search** field at the top of the panel to filter by name.
- Unread count shows as a badge on the row.
- A green dot on the avatar means the other person is **online** (DMs only; groups do not show a single online dot). Offline people show **"active X ago"** instead.

### Open a chat

Click the conversation. On mobile, that replaces the list with the chat panel.

### Blocking a person

From the chat header / right-hand profile panel (or any profile page) choose **Block**. Blocking removes the friendship and hides the conversation; the person cannot message you. A blocked conversation shows a clear state instead of the composer.

**Manage who you've blocked:** open **Settings → Blocked users**. Every person you've blocked is listed with their name and avatar; **Unblock** removes them (and re-enables any open DM with them immediately). Unblocking is also possible from the same chat/profile places as blocking.

---

## 6. Messaging (DMs, groups, and Space channels)

The same composer and message actions work in every conversation type, with a few Space-channel extra rules (see Spaces).

### Send a message

1. Type in **Type a message…**
2. Press **Enter** to send, or click send.
3. **Shift+Enter** inserts a new line.

Max length: **4000** characters. Empty messages are rejected.

Messages appear immediately (optimistic UI). If send fails, use **retry** on that bubble.

### Composer drafts

Unsent text is saved **per conversation** automatically. Switch chats (or reload the page) and your half-typed message is still there when you come back. Sending clears the draft.

### Paste images to attach

Copy a screenshot or photo and **paste it straight into the composer** — it joins the attachment queue with a preview chip, same as picking it through the paperclip button. Any text in the same paste still lands in the message box normally.

### Message menu (right-click / long-press)

Every bubble has a menu — right-click on desktop, **press and hold** on mobile:

- On **other people's messages**: React · **Copy** · **Save message** · **View profile** · **Block** · Reply · **Thread** · **Forward** · **Pin** · Mark as unread · **Select**
- On **your own messages**: React · **Copy** · **Save message** · **Forward** · **Pin** · **Thread** · Reply · Edit · Delete · **Select**
- A **quick-reaction strip** of common emoji sits at the top of the menu so long-press → one-tap react works on mobile.
- **Select** switches the chat into multi-select mode — tick several bubbles, then use the floating bar to **copy**, **forward**, or **delete** (your own) them.
- **View profile** opens the person's profile; **Block** blocks them (their messages in this chat are then hidden behind the blocked banner).

### Reply (quote)

1. Context menu (right-click / long-press) on a message → **Reply**.
2. A quote preview appears above the composer.
3. Send as usual, or cancel the reply with the **X** on the preview.

The original message is shown as an inline quote on the new message. Deleted originals stay as a placeholder so the thread order stays stable.

### React with emoji

1. Context menu → **React**, or use the reaction chips under a message.
2. Pick an emoji. Clicking the same reaction again removes yours.

Quick like: **double-click** (or long-press) a message to react with ❤️.

You can also open the **emoji picker** next to the composer (smile button) to insert emoji into the text you are typing. The picker has 9 categories — Smileys, People, Hearts, Animals, Food, Activity, Travel, Objects, Symbols — 270+ emojis.

### Edit your message

1. Context menu → **Edit** (your own messages only) — or press **↑** with an empty composer to jump straight into editing your last message.
2. Change the text. **Enter** saves, **Escape** cancels.
3. Edited messages show an **edited** label.

### Delete your message

1. Context menu → **Delete** (your own messages only).
2. The message is **soft-deleted**: content is cleared, the row remains so replies stay in place.

You cannot edit or delete other people's messages.

### Copy a message

1. Context menu → **Copy**.
2. Text messages copy their content; attachment bubbles copy the file name and link.
3. On phones, **Share…** (when the browser supports it) opens the native share sheet with the message text.

### Forward a message

1. Context menu → **Forward**.
2. Pick a destination from the conversation picker — DMs, groups, and Space channels you belong to.
3. A copy is sent there with a **"Forwarded from @user"** pill naming the original author. The copy never notifies the original chat, and you can't add a caption.

You can only forward a message you can already see: membership of the source conversation is checked server-side.

### Pin a message

1. Context menu → **Pin** (or **Unpin**). Any member of the chat can pin.
2. Pinned messages appear in a **banner under the chat header**, newest first (up to 10).
3. Unpinning or deleting the message clears it from the banner; changes sync in real time to everyone in the chat.

### Save a message (bookmarks)

1. Context menu (right-click / long-press) on any message → **Save message** (your own, other people's, and thread replies all work). The row flips to **Unsave** once saved.
2. Open the **Saved** panel from the bookmark icon next to Search in the sidebar — every message you saved across chats is listed, newest save first.
3. Click any entry to **jump to that conversation** and highlight the message (same as search results).
4. Unsave from the bubble menu again, or delete the message — deleted messages leave the Saved list automatically.

Saves are personal: no one else sees them, and they follow your account across devices.

### Threads (reply in a side panel)

A **thread** is a discussion attached to one message. Replies live in their own panel instead of the main timeline — useful for going deeper on one topic without flooding the chat.

1. Context menu (right-click / long-press) on a message → **Thread**. Your own and others' messages can be threaded, including announcements.
2. Once a thread has replies, a **"N replies" chip** appears under that message — click it to open the thread.
3. Reply at the bottom of the thread panel. Everyone in the chat can join, react, copy, forward, and (for their own) delete thread replies.
4. On wide screens the thread opens as a **right-hand panel**; on mobile it takes over the screen. **Escape** or the **X** closes it.

How threads behave:

- **Quiet by design** — thread replies do **not** appear in the main timeline, do **not** bump the chat's unread badge, and do **not** ring the notification bell. If you're **@mentioned inside a thread**, that still notifies you (bell + push, per your preferences).
- Deleting a thread reply removes it from the thread; if the last reply is deleted the chip disappears (the message stays threadable).
- Quote-replies (menu → Reply) still render inline in the chat — that's separate from threads.

### Mentions (`@username`)

1. In the composer, type **`@`** then the start of a display name or username.
2. An autocomplete list of **participants in this conversation** appears.
3. **Arrow keys** to move, **Enter** or **Tab** to insert, or click a person.
4. The mention is stored as `@username` and highlighted in the bubble (with online status on the token when available).

Mentioned people get a **mention** notification (title like "X mentioned you"). Mentions **override muted categories** — they arrive even if you muted that conversation type, as long as the Mentions preference is on.

Mentions only resolve to people who are in that DM, group, or channel.

### Links & link previews

Links in messages are **clickable** (open in a new tab). The first link in a message also unfurls a **preview card** with the page's title, description, and preview image, fetched safely through the Kivo server (the target site never sees your browser). If a page offers nothing previewable, the link simply stays a plain link.

### Date dividers & big emoji

Long histories are split by **day dividers** — "Today", "Yesterday", a weekday, or a date — so you can scan across days at a glance. A message that is nothing but **1–3 emoji** renders large with no bubble, WhatsApp-style.

### Jump to latest

Reading old history no longer yanks you to the bottom when new messages arrive. Instead a floating pill appears — **"N new"** with the unread count, or **"Latest"** — and one tap scrolls you back to the live edge.

### Load older messages

Scroll **up**. History loads in pages (cursor pagination, newest-first). Keep scrolling for more.

### Delivery and read receipts (your messages)

On your own bubbles:

- Single check: **sent**
- Double check: **delivered** (to at least one recipient)
- Accent double check: **everyone read it**

Tap the **ticks** on any sent message (check / double-check) to open **Seen by** — a floating card portaled above the chat so the list never gets clipped. It works in **DMs, groups, and Space channels**:

- **Read** rows show avatar, name, and `Read · 10:42 AM` (the server-stamped `readAt` for that message, not the current time).
- **Delivered** rows show who received but hasn't read yet.
- Header counts like `Read · 2 of 3` so you know how many are still pending.
- The card flips above the bubble if there is no room below, dismisses on **outside click, Escape, or any scroll**, and reuses the chat's own theme tokens so it matches your palette.

The chat is marked read when you have it open. System messages (e.g. "Admin added X") do not bump unread counts.

### Mark a conversation unread

Right-click (or long-press on mobile) a conversation → **Mark as unread**. The unread badge returns to that row, and when you reopen the chat a labelled **"New messages"** line shows where your unread messages begin. The separator clears automatically once you scroll to the latest messages (the chat is then marked read again).

### Typing indicator

When someone else is typing in the open conversation, you see a typing line. Your typing is broadcast while you type and stops after you pause or send. The bubble list itself is **memoized** (`React.memo` `MessageRows`): keystrokes, scroll-pill toggles, and presence updates no longer re-render every bubble — only messages, thread chips, unread dividers, selections, and viewport size re-drive the list. Reply targets are resolved via an O(1) `byId` map instead of `find()` inside the loop.

### Swipe to reply (mobile)

On touch devices, **swipe a bubble right** (horizontal lock, ~45 px threshold) to reply — a reply affordance slides in from the left; release to set the quote. Left swipes are ignored. The gesture co-exists with vertical scroll via a direction lock.

### Failed / sending states

A message that has not confirmed yet shows as sending. On failure, retry from the bubble.

### After a reconnect

If your connection drops and comes back, Kivo automatically **gap-fills**: the conversation list refreshes, and the open chat fetches anything newer than the last message you saw — you don't have to scroll to catch up.

---

## 7. Group chats

Private groups for a small set of people (friends, class, squad). Not a Space.

### Create a group

1. In the **Groups** panel click **New group** (or the **New** menu → **Group**).
2. Name the group (required, max 50 characters).
3. Optionally upload a group avatar (image, max 4MB).
4. Select **at least two friends** (the group will have you + those people — at least three people total).
5. Create.

You become the first **admin**.

### Chat in a group

Open the group in the sidebar (under **Groups**). Messaging works like DMs (reply, react, edit, delete, forward, pin, threads, mentions).

### Group settings

Open the group, then click **Group settings** in the chat header. On wide screens the panel sits on the right; on smaller screens it is a drawer.

**Admins can:**

- Rename the group and change the avatar
- Add members (from friends)
- Remove members
- Promote a member to **admin**
- Demote an admin

**Anyone can:**

- Leave the group (remove yourself)

**Rules**

- The **last admin cannot be removed or demoted** (the group would have no owner).
- Membership changes show as centered **system** chips ("Admin added X", "Y left the group") and update live for everyone.

---

## 8. Spaces and channels

Spaces are community containers (like Discord servers). Each Space has channels. Each channel is its own message thread.

### Create a Space

1. In the **Spaces** panel click **New** (or the **New** menu → **Space**).
2. Set **name** (required), optional **description**, **category**, **banner** (preset GIFs), and **avatar** (image, max 4MB).
3. Create.

A **`#general`** text channel is created automatically. You are the **owner**.

**Categories:** Technology, Design, Education, Business, Gaming, Community, Art, Music, Lifestyle, Other.

### Browse your Spaces

In the **Spaces** panel, each Space is a card you expand to reveal its channels (that expand state is saved). Click a channel (hash = text, megaphone = announcement) to open it.

### Discover and join public Spaces

1. In the **Spaces** panel click **Discover** (or the **New** menu → **Discover Spaces**).
2. Search by name/description and/or filter by **category**.
3. Click **Join** on a Space.

You join as **member** and get every channel. You can leave later from Space settings and rejoin via Discover.

**Public vs private Spaces:** public Spaces appear in Discover and accept one-click joins. **Private** Spaces are hidden from Discover and can only be joined through an **invite link** — owner/admins create a rotating link in **Space settings → Privacy & invites** (7-day expiry; "New link" invalidates the old one, "Turn off" closes invites). Invite links deep-link into the app (`/app?join=CODE`) and auto-join when you're signed in; from Discover, the **"Have an invite code?"** field joins the same way (and is where a deep link lands if the join fails).

### Channel types

| Type | Who can post |
|------|----------------|
| **Text** (`#`) | All members |
| **Announcement** (megaphone) | **Admins and owner** only |

### Create, rename, delete channels

In **Space settings** (open a Space channel, then the settings control in the header):

- **Admin+** can add a channel: name, optional description, type (text or announcement).
- **Admin+** can rename channels.
- **Admin+** can delete a channel. You **cannot delete the last remaining channel**.

### Roles

Rank (highest first): **owner → admin → moderator → member**.

| Action | Who |
|--------|-----|
| Edit Space name, description, category, banner, avatar | Admin+ |
| Add/remove members, change roles (member ↔ moderator) | Admin+ |
| Promote someone to **admin** | **Owner only** |
| Delete the Space | **Owner only** |
| Leave the Space | Any member (owner leave auto-promotes the highest remaining member; you cannot remove the last owner) |
| Post in announcement channels | Admin+ |

You cannot assign the **owner** role directly. You cannot remove the last owner.

### Space settings (members)

- Change a member's role (within what your rank allows).
- Remove a member (or leave yourself).
- Join/leave and role changes emit system messages into channels and update live.

### Space look (owners & admins)

A Space can carry its own **look**: an accent + canvas tone (the same theme-studio controls as Settings), a **chat wallpaper** (the pattern behind messages in its channels), and a **bubble style**. Open **Space settings → Space look**, pick any of the four controls — a live mini-preview shows a mock chat with your colors, wallpaper, and bubble shapes — and **Save look**. The look rides on the Space record, so **every member sees it automatically**: while viewing that Space's channels, the chat view is scoped to the Space's colors/wallpaper/bubble style while the rest of the app (sidebar, lists) keeps each member's own theme. Each field can also stay on **"Member's own"** so that control keeps following each member's personal choice. **Reset to default** puts members back on their personal themes. Members without edit rights can view the current state but not change it.

### Delete a Space

Owner only, from Space settings. Confirm the prompt. This cannot be undone and removes the Space, its channel conversations, and their messages.

---

## 9. Profile and appearance

### Edit profile

On desktop click your **avatar** in the icon rail; on mobile open the **Profile** tab → **Edit profile**.

You can set:

| Field | Limit / notes |
|-------|----------------|
| Display name | Shown in chats. Max 50 characters. |
| Username | Unique handle for search and `@mentions`. 3–30 chars, letters/numbers/underscores only. |
| Bio | Max 280 characters. |
| Custom status | Max 60 characters, with an optional **emoji chip** (8-char max, 32 curated emoji in the picker: 😀 😎 🥳 🎮 🎧 📚 💼 🌙 ⚡ 🔥 …). One-tap **vibe presets** set chip + text together: 🎮 Gaming, 🎧 Vibing, 😴 Away, 📚 Studying, 💼 Working, 🌙 Sleepy. |
| Avatar photo | PNG, JPEG, WebP, or GIF; max **4MB** (Appwrite). Replace or remove. |
| Avatar frame | 10 presets: Default, **My accent** (follows your theme color), Lime, Blue, Rose, Amber, Violet, Ocean, Sunset, Aurora |
| Banner | **Free:** preset animated GIF covers (grid of curated covers, plus "None"). **Kivo Plus:** upload your own image/GIF up to **8 MB** (`PATCH /api/v1/users/me/banner`) — stored in Appwrite, old custom file auto-deleted when you switch to a curated cover or remove it. |
| Profile effects | **Kivo Plus only:** `none` (default), `glow` (soft avatar halo), `gradient-name` (animated color-shift on the display name), or `aura` (both). Previewed live in the editor. Free users are forced to `none` server-side and see a locked state with a Crown badge — downgrading from Plus resets to `none` automatically. |
| Country | Optional ISO 3166 alpha-2 code; rendered as a **flag** on your profile (`flagcdn.com`). |
| GitHub | Optional username (max 39, letters/numbers/hyphens). Renders a **contribution graph** on your public profile. |
| X | Optional username (max 60, letters/numbers/underscores). |
| Instagram | Optional username (max 60, letters/numbers/dots/underscores). |
| YouTube | Optional full URL (`https://…`, max 500). |
| Website | Optional full URL (`https://…`, max 500). |

The four social-link fields plus GitHub render as **icon chips** on your public profile (GitHub/X/Instagram build URLs from handles, YouTube/website use the full URL). Each chip links out safely (`target=_blank rel=noopener`). Save to apply. Email is **not** editable here. Username validation re-checks uniqueness server-side and the `plan` field is never accepted from clients.

### Account verification (Google / GitHub)

Under **Settings → Account verification**, you can link Google or GitHub to your account to earn provider verification badges.

1. Click **Verify with Google** or **Verify with GitHub**.
2. You are taken to the provider's consent screen (you are already signed in, so this is account *linking*, not a new signup).
3. Authorize. You are redirected back and the provider badge appears on your public profile.

Linking **both** providers earns the native **Kivo Verified** badge automatically — no admin action needed. Provider badges (Google Verified, GitHub Verified) render as chips on your public profile alongside the verified badge.

You can link a provider only if it is not already linked to another Kivo account. The link step is rate-limited (10 per 60 s).

### Your full profile page

From the edit modal open the full profile, or go to **`/app/profile`**.

Shows banner, avatar, display name, username, email, status, and role. **Log out** is here.

### Verification badge

Verified accounts (a status granted by admins) can show a **verified badge** next to their name. If you're verified, **Settings → Verification badge** toggles whether it is visible on your public profile.

### Public profile (`/u/username`)

Every user gets a **public profile page** at `/u/<username>` — no login required to view. It shows the banner, avatar, name, `@handle`, verified badge, **country flag**, status (+ **emoji chip** inside a pill chip), bio, and join date — plus **social link chips** (GitHub, X, Instagram, YouTube, website, each with a brand glyph that matches lucide-style icons) and a **GitHub contribution graph** when a GitHub username is set. The contribution graph renders a 7-day calendar with a total count and legend, styled to the page's own palette.

**Plus flourishes** render automatically: if the user has a Kivo Plus **profileEffect** (`glow` / `gradient-name` / `aura`), the avatar halo and/or animated name Gradient show on their public page (CSS in `globals.css` `.kivo-pfx-*`, reduced-motion safe).

The page **wears the owner's theme**: if the account has custom colors (accent + canvas tint from the theme studio), the public page renders in *those* colors instead of the default palette (`frontend/lib/profile-skin.js` maps the derived palette back onto legacy `--canvas` tokens so the profile subtree re-skins without component edits).

A **Share** button in the top bar opens a share sheet with a **QR code** (scan to open the profile on Kivo — canvas-rendered, light/dark-aware, with error-correction and Kivo mark), **copy link**, and native **Share** (mobile Web Share API when available). The sheet is a slide-over on mobile and a dialog on desktop.

What you can do there depends on your relationship:

- Signed out: a "Join Kivo" prompt appears after a moment.
- Friends: **Message** (opens the DM).
- Not friends: **Add friend** (or **Accept** if they already requested you) and **Message** if you're friends.
- Anyone you're connected to: **Block / Unblock** and, for friends, **Unfriend**.
- Anyone (not blocked, not self): **Wave 👋** — sends a one-tap ping notification. The **Wave** button lives among the primary actions (Hand icon) with a live countdown (`Waved · 12s`) while the **20 s per-recipient cooldown** is active. The server enforces the cooldown authoritatively (`WAVE_COOLDOWN_SECONDS = 20`, `WAVE_COOLDOWN` error with `cooldownSeconds`/`lastWaveAt`), rejects self-waves and blocked-user waves (`WAVE_BLOCKED`), and delivers as a `wave` notification (in-app if the recipient is online, web-push if offline — clicking it opens the sender's profile). The notification center deep-links waves to `/u/username`.

Search results that point at a person open this same profile in a drawer inside the app.

---

## 10. Themes

**Where:** the **Appearance** page — full screen. Desktop: Settings column → **Appearance** row. Mobile: Menu tab → **Appearance**.

**Ten** live palettes (no page reload). Your base-theme choice is stored in the browser (`localStorage`, key `kivo:theme`); custom colors below are saved to your account so they follow you across devices.

| Theme | Family | Feel |
|-------|--------|------|
| **Framer** (default) | Dark | Near-black canvas, white text, blue accent |
| **Midnight** | Dark | Deep navy canvas |
| **Graphite** | Dark | Cool slate, premium metallic depth |
| **Espresso** | Dark | Rich warm brown, deep tonal ramp |
| **Pine** | Dark | Deep forest green |
| **Plum** | Dark | Moody aubergine |
| **Porcelain** | Light | Neutral off-white canvas |
| **Linen** | Light | Warm cream canvas |
| **Mist** | Light | Cool blue-gray canvas |
| **Sage** | Light | Soft green-tinted canvas |

### Theme studio (custom colors)

Below the palette in **Settings → Appearance** is the theme studio. It layers **your colors** on top of whichever base theme is active:

- **Accent** — recolor links, buttons, badges, unread dots, and selection. Pick a preset or open the color picker for any hex.
- **Canvas tone** — wash all surfaces (background, sidebars, borders, bubbles) with a hue. *Neutral* keeps the theme's own colors.

Every click applies **live** to the whole app — no preview modal, no reload. The wash preserves each surface's original lightness, so text contrast is never broken (the engine only shifts hue, never ink). **Save to my account** persists the pair to your profile (`appearance` on the user record); log in anywhere and your colors come with you. **Remove my colors** clears it and falls back to the preset palette.

### Chat look (wallpaper & bubble style)

Below the studio, **Settings → Appearance → Chat look** styles the chat surface itself (applies to your DMs and groups; Spaces can override per-field with their own look):

- **Wallpaper** — a subtle pattern behind the message list: **Plain** (`none`), **Dots**, **Grid**, **Lines** (`diagonal` — thin diagonals), **Bubbles** (two dot scales at `5%` / `7%` ink), or **Wash** (a soft accent gradient at `5%` / `2%`). Patterns are painted with `color-mix()` over `var(--text-primary)` / `var(--accent)`, so they stay faint on both dark and light canvases and re-tint automatically when a Space palette is active. **Plain** keeps the flat background. Helpers: `frontend/lib/chat-style.js` (`WALLPAPER_OPTIONS`, `wallpaperCss`).
- **Bubble style** — **Rounded** (default, 12px), **Pill** (extra-round airy corners), **Squared** (tight corners), or **Outlined (mine)**: your messages become accent-outlined bubbles with a transparent fill. Helpers: `BUBBLE_STYLE_OPTIONS`, `chatLook()`. Both enums are stored as `appearance.wallpaper` / `appearance.bubbleStyle` on the User and Space (and validated via `appearance` / `conversationLookSchema`).

Changes save to your account (`appearance.wallpaper` / `appearance.bubbleStyle`), follow you across devices, and apply to the main chat **and** thread panel (wallpaper is a fixed CSS layer behind the scrolling list; bubble geometry is a single container-scoped class `kivo-bubbles-*`, so no prop drilling). Wallpapers are pure CSS — a fixed layer behind the scrolling messages — so they cost nothing to paint or scroll.

### Chat look per conversation (DMs & groups)

Each DM or group can carry its **own** wallpaper + bubble style, seen by everyone in that chat. Tap the **palette icon** in the chat header → **Chat look** (a modal with 6 wallpapers + 4 bubble styles, each "Member's own" option inherits). Either person in a DM can set it; in a group only admins can (everyone else sees a read-only note). Backend: `PATCH /api/v1/conversations/:id/look` (`conversationLookSchema`, `updateConversationLook` — space channels rejected with `NOT_ALLOWED`). Values layer on top of the personal look — priority is **conversation look > Space look (in its channels) > member's own** via `resolveChatLook()` — and each field can stay on **"Member's own"** to inherit. Partial updates merge (a color reset never wipes the chat look and vice versa). Saves emit `conversation:updated` and apply instantly to everyone viewing the chat.

All themes share the same layout and elevation; only colors change — plus the optional bubble geometry and wallpaper you pick above. If your OS asks for reduced motion, animations stay minimal.

---

## 11. File, image & voice attachments

You can send files, images, and voice messages in any DM, group, or Space channel.

### Attach a file

1. In the chat composer, click the **paperclip** button — or **paste** an image straight from your clipboard.
2. Pick one or more files from your device (**up to 10 files**).
3. Each file shows a **preview chip** with name, size, and a progress bar while uploading.
4. Type an optional caption, then **Enter** to send.
5. The message appears with the files below your text.

**Allowed types:**
- **Images:** JPG, PNG, GIF, WebP — max 30 MB each
- **Documents:** PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT — max 30 MB each
- **Audio:** WebM, OGG, MP3, M4A, AAC, WAV — max 30 MB each

Multiple files of mixed types can be sent in a single message.

### Record a voice message

1. **Press and hold** the **mic** button (next to the paperclip) in the composer.
2. While holding, a red recording bar shows a **live timer** and "Release to send · slide up to cancel".
3. **Release** to send immediately — the message uploads and appears as a voice bubble.
4. To discard instead, **slide your finger/pointer up** (the hint turns red, "Release to cancel") and release, or tap the **X** button.
5. The first time you record, your browser asks for **microphone permission** — allow it.

Voice messages need a connection (they upload like any attachment); while offline the mic shows a notice and text messages keep queuing as usual.

### Play a voice message

- Voice bubbles show a **play/pause button**, a **progress bar**, and the **duration** (recorded at send time, so it's visible before the audio loads).
- Tap play to hear it; tapping another voice message stops the first (one player at a time).
- Click or drag on the progress bar to **seek**; arrow keys skip ±5 seconds when focused.
- Voice messages can be **forwarded** (the audio + duration carry over with the "Forwarded from" pill), **saved**, and **deleted** like any message.

### View images

- Click any image thumbnail in chat to open the **fullscreen lightbox**.
- The image opens centered on screen with a dark backdrop.
- Use the **left/right arrows** or **keyboard arrows** to navigate between images in the same message.
- Click the **download** button (top right) to save the image.
- Press **Escape** or click the backdrop to close.

### View documents

- PDF, DOC, XLS, PPT, and TXT files show as **download cards** with an icon, filename, and file size.
- Click the card to open the file in a new tab (or download it directly from Appwrite).

---

## 12. Notifications

### In-app bell

The **bell** sits in the panel header (Chats, Groups, and Spaces panels). The badge is the unread count.

1. Click the bell to open the **notification center**.
2. Click an item to open the related chat (DM, group, or Space channel) and mark it read. Friend-request items open the Friends modal.
3. Scroll down to load older notifications.
4. **Mark all read** clears the badge.

**Escape** or click outside / the backdrop closes the center.

**Types you may see**

- New **DM** message
- New **group** message
- New **Space channel** message (incl. announcements)
- Someone **@mentioned** you (overrides muted categories if your Mentions pref is on)
- **Friend request**
- Friend request **accepted**
- **Wave 👋** — someone waved at your profile (per-recipient 20 s cooldown)
- **Space invite** (reserved for future invite notifications; today invites use rotating link codes)

You are never notified of your **own** messages. **System** messages (joins/leaves) do not create notifications.

**Quiet when you are already in a DM:** if that DM is open and focused, the server **does not** send a notification for it. Group/Space notifications still fan out to other members.

**Notification preferences (Settings → Notification preferences):** choose which categories you receive — Direct Messages, Group Messages, Mentions, Friend Requests, Space Messages, and Announcements. Space Messages are **off by default**; `@mentions` override a muted category (but still respect your Mentions toggle). Friend requests/acceptances are gated on `friendRequests`; lightweight pings like **Waves** flow ungated with their own 20 s server cooldown. Toggles apply to both in-app (`notification:new`) and push delivery.

**Sound cues (Settings → Sounds):** every category has its own audio toggle — Direct Messages, Mentions, Group Messages, Space Messages, and Friend Requests — under a master **Notification sounds** switch, each with a **▶ preview** button so you can hear a cue before enabling it. Cues fire only when a message/request deserves attention: DMs chime when the tab is hidden or that DM isn't focused; **@mentions** chime when the conversation isn't focused (they override the group/space categories, like the server preferences); group and Space messages only chime while the tab is in the background; friend requests/acceptances chime unless the notification center is open. Cues are synthesized in-browser with the Web Audio API (no audio assets), and preferences live in `localStorage["kivo:sounds"]` — the old `kivo:sound` flag is migrated into the master switch on first read.

**Under the hood (performance):** message fan-out now groups recipients in one `insertMany` (~1 DB round-trip) instead of sequential creates, batch-loads per-recipient preferences in one query, and fire-and-forgets web-push so the sender's `POST /messages` never waits on VAPID HTTP. Offline push results are persisted asynchronously (`delivery.pushDelivered / pushError`), expired endpoints (404/410) are pruned, and DM-focused suppression (`isUserFocusedOnConversation`) still skips notifications for the DM you are actively viewing.

### Browser / lock-screen push (offline)

The first time you **open the notification bell**, if the browser has not asked yet, Kivo requests **Notification permission**. If you **Allow**, this device is subscribed for **web push**.

Then, when you are **offline** or the tab is closed, you can still get native notifications for DMs, groups, Space messages, mentions, and friend events (if VAPID is configured on the server).

Clicking a push notification opens the app and jumps to the relevant conversation.

Permission is **opt-in**. There is no auto-prompt on first page load.

---

## 13. Install as an app (PWA)

Kivo is installable:

- **Chrome / Edge (desktop):** browser install icon in the address bar, or menu → **Install Kivo**.
- **Android:** Add to Home Screen / Install app.
- **iOS Safari:** Share → **Add to Home Screen**.

It opens in **standalone** mode starting at `/app`. Icons and name come from `frontend/public/manifest.json`. A service worker provides an **offline shell**: static assets (icons, manifest, the offline page) are precached, content-hashed build files are served from cache, and page navigations try the network first, then fall back to the last-known-good cached page, and finally to a styled **"You are offline"** page when nothing is cached. The service worker also handles push and notification clicks. On top of that, Kivo caches your conversation, Space, friend, friend-request lists, and the **latest 50 messages per chat** in IndexedDB so they paint instantly on reload — and **text you send while offline is queued** and delivered when you're back (see §20). Full offline history of *older* pages is still not available — those need the network.

---

## 14. Presence and live updates

While you are connected:

- Friends and DM partners can see you as **online** (green indicator).
- When someone is offline, Kivo shows how long ago they were **last active** (e.g. "active 12 min ago"), in DMs and on profiles, instead of a bare offline state.
- New messages, edits, deletes, reactions, and receipts appear **without refresh**.
- Group and Space membership, channel list, and settings updates stream in live.
- New notifications arrive over the same realtime connection.

If the connection drops, Kivo reconnects automatically; on reconnect it **gap-fills** the conversation list and the open chat so nothing you missed is lost. History still loads from the server.

---

## 15. Keyboard and accessibility

| Action | Shortcut |
|--------|----------|
| Open global search | **Ctrl+K** / **Cmd+K** |
| Send message | **Enter** |
| New line in composer | **Shift+Enter** |
| Confirm mention from autocomplete | **Enter** or **Tab** |
| Move mention highlight | **Arrow up / down** |
| Save edited message | **Enter** |
| Edit your last message (empty composer) | **↑** |
| Cancel edit | **Escape** |
| Close modal / notification center | **Escape** |
| Navigate lightbox images | **← / →** |

Interactive controls use visible **focus** styles. Modals have labels for assistive tech. **Reduced motion** is respected.

---

## 16. Landing page (marketing)

On `/` (logged out):

- Hero and chat mockup
- Nav: Features, Customization, Security, Roadmap
- **Log in** / **Sign up**

Use this to explain the product; actual chat is only after signup.

---

## 17. Global search (Ctrl+K)

**Open:** press **Ctrl+K** (or **Cmd+K** on Mac), or click the search icon in the panel header.

A command-palette overlay opens with a single search field.

### What you can search

| Category | What it matches | Click behavior |
|----------|-----------------|----------------|
| **Messages** | Content of messages in conversations you belong to | Opens the conversation and jumps to that message |
| **People** | Username or display name | Opens the person's profile (in-app drawer) |
| **Spaces** | Space names you are a member of | Opens a channel of the Space |

- Search is **debounced** (300ms) and results load independently per category.
- Minimum **2 characters** required.
- Results are capped at **5 per category**.

### Jump to message

Clicking a message result closes the overlay, opens the conversation, and **scrolls directly to that message** with a brief highlight flash. (Server-side, this uses an anchor fetch `around=<messageId>`.)

The sidebar also has a per-panel **filter field** for chats/groups/spaces — that's quick name filtering, separate from global search.

---

## 18. Other people's profiles

### In a DM (right panel)

On a wide desktop (XL), the **right column** shows the other user: banner, avatar, name, username, verified badge, online/offline + last active, status, bio, and member-since. It is hidden on smaller screens.

### Profile drawer / public page

Open a person's profile from search results or any avatar shortcut. The same profile content powers the public page at `/u/<username>`. From it you can Wave 👋, Message, Add friend / accept, Unfriend, or Block/Unblock.

---

## 19. Admin panel

Kivo has a standalone admin panel at **`/admin`** — completely independent of the regular user app.

### Access

1. Go to `/admin`.
2. Enter the admin **email** and **password** (configured via environment variables, not a DB user account).
3. You land on the admin dashboard.

The admin panel uses a separate JWT cookie (`admin_token`) that is never accepted by the regular user auth system.

### Dashboard tabs

| Tab | What it shows |
|-----|---------------|
| **Overview** | Total users, banned users, groups, spaces, messages |
| **Users** | Paginated user table with search, ban status filter, ban/unban, **plan (Kivo Plus) grant/revoke**, and detail drawer (conversation/group/space counts) |
| **Groups** | All group conversations with member count, admins, delete action |
| **Spaces** | All spaces with member/channel count, owner, delete action |

### User management

- **Ban a user**: Sets `isBanned` on the user document (does not delete it — the email stays locked). Immediately disconnects their sockets and revokes all sessions. The user is also rejected at login.
- **Unban a user**: Clears the ban fields so they can log in again.
- **Kivo Plus grant**: `POST /api/admin/users/:id/plan` `{ plan: "plus" | "free" }`. Admin-only; users can never self-grant. Granting Plus unlocks custom banner uploads and profile effects; **revoking** (`free`) also resets `profileEffect` to `none` automatically. Every grant/revoke is logged (`grant_plus` / `revoke_plus`).

### Group & space management

- **Delete** a group or space for moderation — this is a hard delete (removes the conversation/space and all its messages).

### Security

- Rate-limited to **5 login attempts per 15 minutes** per IP.
- Admin cookie is `httpOnly`, `SameSite=Lax`, `Path=/`.
- Every moderation action (ban, unban, force-logout, delete) is logged with IP and timestamp (`AdminActionLog`).

### Environment variables

```
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=<bcrypt hash>
ADMIN_JWT_SECRET=<random secret>
ADMIN_JWT_TTL=30m
ADMIN_COOKIE_NAME=admin_token
```

Generate the password hash with:
```bash
node -e "const b=require('bcryptjs');b.hash('your-password',12).then(h=>console.log(h))"
```

---

## 20. Offline support

### Message caching

Messages are cached in IndexedDB (per conversation, latest 50 messages). On load or conversation switch, cached messages render **instantly** while a background revalidation fetches fresh data from the server.

Cache is updated in real-time during online use:
- After initial REST fetch
- On every incoming `message:new`, `message:edited`, `message:deleted`, `message:reaction` socket event
- After a reconnect gap-fill

The whole cache (lists + messages) is cleared on logout.

### Reconnect gap-fill

On every successful socket reconnect the app refreshes the conversation list (unread counts, previews) and fetches messages newer than the newest known message in the open chat, merging them into the local cache — so a blip in connectivity doesn't lose anything.

### Offline indicator

A small **"You are offline"** banner appears in the sidebar when both signals indicate disconnection:
- `navigator.onLine` (browser online/offline events)
- Socket.IO connection state

### Queued sends (outbox)

While offline the composer stays usable for **text messages**: hitting send stores the message in a per-account **outbox** (IndexedDB) and shows it as a bubble with a clock note — *"queued · will send when online"*. The bubble survives a page reload, because the queue is durable.

When a connection comes back the app **flushes the outbox automatically** (on socket reconnect, the browser `online` event, or a slow retry timer), oldest message first, in the order you wrote them. Each success swaps the queued bubble for the real message; failures stay visible with a **failed · retry** affordance.

What does **not** queue: file/photo attachments (uploads need a live connection) — the app shows a notice instead of sending. There is still **no full offline message history** (older pages need the network), but everything you write while offline is never lost.

---

## 21. Two-factor authentication (2FA)

### Enabling 2FA

- Open **Settings → Security** (desktop: gear icon → Settings; mobile: Menu tab → Settings).
- Click **Enable two-factor authentication** — the app generates a secret and shows a QR code plus a manual entry code.
- Scan the QR with any authenticator app (Google Authenticator, Authy, 1Password, …) or enter the secret manually, then type the 6-digit code to confirm. Nothing is enabled until this step verifies.
- Once enabled, Kivo shows **one-time backup codes** — save them somewhere safe. Each code can be used once to sign in if you lose access to your authenticator.

### Signing in with 2FA

- Login is a two-step flow: enter email + password first; if 2FA is enabled the app then asks for a code before any session is created.
- Enter the 6-digit code from your authenticator app, or one of your backup codes (dashes and spaces are ignored, case doesn't matter). A used backup code is consumed and can't be reused.

### Turning 2FA off

- In **Settings → Security → Turn off two-factor authentication**, confirm with your current authenticator code (or a backup code). Backup codes are invalidated on disable.

---

## What is not in the product yet

Do not expect these in the current MVP:

- **Voice / video calls** — no backend wiring and no call UI
- Automatic verification email on signup / in-app resend banner (the link-based verify flow remains on the API)
- Self-serve Stripe/payment for Kivo Plus — Plus is admin-granted only (`free` → `plus`); no checkout UI
- Theme template sharing (per-Space palettes are built; sharing them as saved templates is not)
- Full offline **message** history in the PWA (lists + last 50 messages are cached; full history still needs the network)
- Video attachments (voice messages are built; video is not)

---

## Feature checklist (shipped)

| Feature | How you use it |
|---------|----------------|
| Sign up / log in / session refresh | `/signup`, `/login`; instant signup, stay on `/app` |
| Log out | Menu → Profile / `/app/profile` |
| Friends: add, accept, decline, list, search, remove | New menu → Friends; Unfriend on profiles |
| Open DM from a friend | Friends → **Message** |
| Send / reply / react / edit / delete / copy / forward / pin messages | Chat panel + bubble menu (double-click = ❤️) |
| Threaded replies (side panel) | Message menu → Thread, or click the "N replies" chip under a message |
| Save messages for later | Message menu → Save message; sidebar bookmark icon opens the Saved panel |
| Emoji in text | Composer smile button (9 categories, 270+) |
| @mentions | Type `@` in the composer |
| Typing, presence, read receipts | Automatic while connected |
| Group create / members / admins | Groups panel → New group + group settings |
| Spaces, channels, roles, Discover | Spaces panel + Discover + Space settings |
| Profile, avatar, frame, banner, bio, status, country, GitHub | Icon-rail avatar (desktop) / Menu → Profile (mobile) |
| Public profile & verified badge | `/u/:username` (badge toggle in Settings) |
| Block users + manage the list | DM header, profile drawer, public profile, Settings → Blocked users |
| Ten themes + custom accent/canvas (theme studio) | Appearance page → Save to my account (desktop: Settings → Appearance row; mobile: Menu → Appearance) |
| Chat wallpapers + bubble styles (personal + per-Space + per-chat) | Appearance page → Chat look · Space settings → Space look · chat header → palette icon (`PATCH /conversations/:id/look`) |
| Custom banners + profile effects (Kivo Plus) | Profile editor (8 MB banner upload, 4 effects) · admin panel grants Plus (`POST /api/admin/users/:id/plan`) |
| Social link chips + GitHub graph + Wave | Profile editor → public `/u/username` chips + graph; Wave button on any profile (20 s cooldown, `POST /notifications/:id/wave`) |
| Share profile + QR code | Share button on `/u/username` / drawer → QR + copy + native Share |
| Verification badge | `/u/:username` badge toggle in Settings → Verification badge |
| Read receipts — "Seen by" panel | Tap ticks on your own message → floating card with avatars, Read · time / Delivered (DMs, groups, Space channels) |
| Notification preferences | Settings → Notification preferences (DMs, groups, mentions, friend reqs, Space msgs off by default, announcements; mentions override) |
| In-app notifications + Wave | Bell in panel header; Waves appear with sender username + deep-link to profile |
| Web push | Allow notifications when opening the bell (`web-push` VAPID) |
| Install PWA | Browser install / Add to Home Screen |
| Mobile bottom tab bar (Chats/Groups/Spaces/Menu) + full-screen Appearance page | On phone-sized screens; swipe-to-reply on bubbles |
| Offline list + message caching | Automatic via IndexedDB (last 50 per chat; conversation list via single aggregation) |
| Reconnect gap-fill | Automatic after socket reconnect (`after=` catch-up) |
| File & image attachments (images, PDFs, docs) | Paperclip button in composer |
| Voice messages (hold-to-record) | Mic button in composer → hold → release to send |
| Image lightbox (fullscreen, arrows, download) | Click any image in chat |
| Global search (Ctrl+K) | Ctrl+K or search icon in panel header |
| Admin panel | `/admin` — standalone dashboard (Plus grant/revoke, ban/unban, deletes + audit log) |
| Offline indicator | "You are offline" banner in sidebar |
| Forgot / reset password | `/forgot-password` → emailed link → `/reset-password` |
| Last online status | "active … ago" in DMs & profiles when offline |
| Mark as unread | Right-click conversation → Mark as unread |
| Clickable links + link preview cards | Links open in a new tab; first link unfurls title/description/image (`GET /api/v1/link-preview?url=…`) |
| Date dividers + big emoji | Day pills across history; 1–3 emoji-only messages render large, bubble-free |
| Jump-to-latest pill | Floating "N new" / "Latest" button when scrolled up; no auto-scroll yank while reading |
| Composer drafts | Unsent text saved per conversation, survives switches + reloads |
| Paste images to attach | Clipboard screenshots/photos join the attachment queue directly |
| Up-arrow to edit | Empty composer + ↑ edits your last message |
| Chat performance | Memoized `MessageRows`, O(1) reply map, throttled like/anim, bulk notification `insertMany` |
| Health check (ops) | `GET /health` on the API |

For endpoint-level detail, see **API Reference** in [`PRD.md`](./PRD.md).
