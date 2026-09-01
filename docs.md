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
# backend
cd backend && bun install && bun run dev

# frontend (separate terminal)
cd frontend && bun install
# set NEXT_PUBLIC_API_URL=http://localhost:4000 in frontend/.env.local
bun run dev
```

Backend env template: `backend/.env.example` (MongoDB, JWT secrets, Appwrite for avatars, VAPID keys for web push).

---

## Pages

| URL | Who can open it | What it is |
|-----|-----------------|------------|
| `/` | Anyone | Landing page (Features, Customization, Security, Roadmap). Logged-in users are sent to `/app`. |
| `/login` | Guests | Log in with email **or** username + password. |
| `/signup` | Guests | Create an account. |
| `/app` | Signed-in users | Main chat: sidebar, conversations, Spaces. |
| `/app/profile` | Signed-in users | Read-only profile summary and **Log out**. |
| `/docs` | Anyone | In-app "How to use Kivo" guide. |

---

## 1. Create an account

**Where:** `/signup`

1. Enter **display name**, **username**, **email**, **password**, and **confirm password**.
2. Submit. You are signed in and taken to `/app`.

**Rules**

- Password: at least 8 characters.
- Username: 3–30 characters; letters, numbers, and underscores only. Unique.
- Email: unique, valid format.
- Login is rate-limited (10 attempts per 15 minutes).

---

## 2. Log in and log out

**Log in** (`/login`)

1. Enter your **email or username** and password.
2. Submit. You go to `/app`.

Sessions use a short-lived access token plus an httpOnly refresh cookie. The app refreshes the access token automatically before it expires.

**Log out**

1. Open the dashboard sidebar and click your **profile** (bottom of the sidebar) to edit, then open the full profile, **or** go to `/app/profile`.
2. Click **Log out**.

That ends the current session. There is also a server endpoint to log out of **all** devices (`POST /api/v1/auth/logout-all`); it is not exposed as a button in the UI yet.

---

## 3. Dashboard layout

After login you see three regions (on a wide screen):

1. **Left sidebar** — DMs, groups, Spaces, search, compose, theme, profile.
2. **Center chat** — the open conversation or channel.
3. **Right panel** (XL desktop, DMs) — the other person’s profile. For groups and Spaces, a **settings drawer** can slide in from the right.

**Mobile:** On a phone, Kivo shows a **bottom tab bar** with three sections — **Chats**, **Spaces**, and **Profile** — so navigation feels native. Open a chat to see messages; use **Back** in the chat header to return to the list. Group/Space settings open as a full-height drawer. Safe-area insets are handled on notched devices.

**Collapse the sidebar:** use the panel icon in the sidebar header (desktop). Collapsed state is remembered.

**Remember last chat & instant paint:** the last selected conversation is restored after refresh. Your conversations, Spaces, friends, and friend requests are cached in the browser (IndexedDB), so the list paints instantly while fresh data loads.

---

## 4. Friends

**Open:** sidebar **+** (New) menu → **Friends**, or the people / compose control that opens the friends modal.

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

**Note:** Unfriend exists on the API (`DELETE /api/v1/friends/:id`) but is not in the friends UI yet.

---

## 5. Direct messages (1:1)

### Start a DM

- From **Friends** → **Message**, or  
- From **Add** search results, **Message** (if they are already a friend).

DMs are unique per pair: starting chat again reuses the existing conversation.

### Find a conversation

- Sidebar lists **Direct** chats, newest activity first.
- Use the **search** field in the sidebar to filter friends/conversations by name.
- Unread count shows as a badge on the row.
- A green dot on the avatar means the other person is **online** (DMs only; groups do not show a single online dot).

### Open a chat

Click the conversation. On mobile, that replaces the list with the chat panel.

---

## 6. Messaging (DMs, groups, and Space channels)

The same composer and message actions work in every conversation type, with a few Space-channel extra rules (see Spaces).

### Send a message

1. Type in **Type a message…**
2. Press **Enter** to send, or click send.
3. **Shift+Enter** inserts a new line.

Max length: **4000** characters. Empty messages are rejected.

Messages appear immediately (optimistic UI). If send fails, use **retry** on that bubble.

### Reply (quote)

1. Right-click (or long-press / context menu) a message → **Reply**.
2. A quote preview appears above the composer.
3. Send as usual, or cancel the reply with the **X** on the preview.

The original message is shown as an inline quote on the new message. Deleted originals stay as a placeholder so the thread order stays stable.

### React with emoji

1. Context menu on a message → **React**, **or** use the reaction chips under a message.
2. Pick an emoji. Clicking the same reaction again removes yours.

You can also open the **emoji picker** next to the composer (smile button) to insert emoji into the text you are typing. The picker has multiple categories (smileys, people, nature, food, activity, travel, objects, symbols, flags) — 270+ emojis.

### Edit your message

1. Context menu → **Edit** (your own messages only).
2. Change the text. **Enter** saves, **Escape** cancels.
3. Edited messages show an **edited** label.

### Delete your message

1. Context menu → **Delete** (your own messages only).
2. The message is **soft-deleted**: content is cleared, the row remains so replies stay in place.

You cannot edit or delete other people’s messages.

### Mentions (`@username`)

1. In the composer, type **`@`** then the start of a display name or username.
2. An autocomplete list of **participants in this conversation** appears.
3. **Arrow keys** to move, **Enter** or **Tab** to insert, or click a person.
4. The mention is stored as `@username` and highlighted in the bubble (with online status on the token when available).

Mentioned people get a **mention** notification (title like “X mentioned you”) instead of a generic message notification.

Mentions only resolve to people who are in that DM, group, or channel.

### Load older messages

Scroll **up**. History loads in pages (cursor pagination, newest-first). Keep scrolling for more.

### Delivery and read receipts (your messages)

On your own bubbles:

- Single check: **sent**
- Double check: **delivered**
- Filled / read state: the other participant(s) **read** it

The chat is marked read when you have it open. System messages (e.g. “Admin added X”) do not bump unread counts.

### Typing indicator

When someone else is typing in the open conversation, you see a typing line. Your typing is broadcast while you type and stops after you pause or send.

### Failed / sending states

A message that has not confirmed yet shows as sending. On failure, retry from the bubble.

---

## 7. Group chats

Private groups for a small set of people (friends, class, squad). Not a Space.

### Create a group

1. Sidebar **+** → **New group**, or the **+** next to the Groups section header.
2. Name the group (required, max 50 characters).
3. Optionally upload a group avatar (image, max 4MB).
4. Select **at least two friends** (the group will have you + those people — at least three people total).
5. Create.

You become the first **admin**.

### Chat in a group

Open the group in the sidebar (under **Groups**). Messaging works like DMs (reply, react, edit, delete, mentions).

### Group settings

Open the group, then click **Group settings** in the chat header (gear / people icon). On XL screens the panel sits on the right; on smaller screens it is a drawer.

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
- Membership changes show as centered **system** chips (“Admin added X”, “Y left the group”) and update live for everyone.

---

## 8. Spaces and channels

Spaces are community containers (like Discord servers). Each Space has channels. Each channel is its own message thread.

### Create a Space

1. Sidebar **+** → create Space, or **+** next to **Spaces**.
2. Set **name** (required), optional **description**, **category**, **banner** (preset GIFs), and **avatar** (image, max 4MB).
3. Create.

A **`#general`** text channel is created automatically. You are the **owner**.

**Categories:** Technology, Design, Education, Business, Gaming, Community, Art, Music, Lifestyle, Other.

### Browse your Spaces

In the sidebar, **Spaces** lists spaces you belong to. Click a Space name to expand/collapse its channels (that expand state is saved). Click a channel (hash = text, megaphone = announcement) to open it.

### Discover and join public Spaces

1. Sidebar **+** → **Discover Spaces**.
2. Search by name/description and/or filter by **category**.
3. Click **Join** on a Space.

You join as **member** and get every channel. You can leave later from Space settings and rejoin via Discover.

All Spaces currently appear in Discover (there is no private/unlisted Space flag in the UI).

Invite links are **not** used; joining is Discover or an admin adding you.

### Channel types

| Type | Who can post |
|------|----------------|
| **Text** (`#`) | All members |
| **Announcement** (megaphone) | **Admins and owner** only |

### Create, rename, delete channels

In **Space settings** (open a Space channel, then settings in the header):

- **Admin+** can add a channel: name, optional description, type (text or announcement).
- **Admin+** can rename channels.
- **Admin+** can delete a channel. You **cannot delete the last remaining channel**.

### Roles

Rank (highest first): **owner → admin → moderator → member**.

| Action | Who |
|--------|-----|
| Edit Space name, description, category, banner, avatar | Admin+ |
| Add/remove members, change roles | Admin+ |
| Promote someone to **admin** | **Owner only** |
| Delete the Space | **Owner only** |
| Leave the Space | Any member (owner leave auto-promotes the highest remaining member; you cannot leave the Space empty of owners in a broken way) |
| Post in announcement channels | Admin+ |

You cannot assign the **owner** role directly. You cannot remove the last owner.

### Space settings (members)

- Change a member’s role (within what your rank allows).
- Remove a member (or leave yourself).
- Join/leave and role changes emit system messages into channels and update live.

### Delete a Space

Owner only, from Space settings. Confirm the prompt. This cannot be undone and removes the Space and its channel conversations.

---

## 9. Profile and appearance

### Edit profile (quick)

Click your **avatar / name** at the bottom of the sidebar.

You can set:

| Field | Limit / notes |
|-------|----------------|
| Display name | Shown in chats |
| Username | Unique handle for search and `@mentions` |
| Bio | Max 280 characters |
| Custom status | Max 60 characters |
| Avatar photo | PNG, JPEG, WebP, or GIF; max **4MB** (Appwrite). Replace or remove. |
| Avatar frame | Presets: Default, Lime, Blue, Rose, Amber, Violet, Ocean, Sunset, Aurora |
| Banner | Preset animated GIF covers |

Save to apply. Email is **not** editable here.

### Full profile page

From the edit modal, open the full profile, or go to **`/app/profile`**.

Shows banner, avatar, display name, username, email, status, and role. **Log out** is here.

### Other person’s profile (DMs)

On a wide desktop (XL), the **right column** shows the other user: banner, avatar, name, username, online/offline, status, bio, and member-since. It is hidden on smaller screens.

---

## 10. Themes

**Where:** bottom of the sidebar, **theme** control (palette).

Five live palettes (no page reload). Choice is stored in the browser (`localStorage`).

| Theme | Feel |
|-------|------|
| **Framer** (default) | Near-black canvas, white text, blue accent |
| **Cloud** | Cool, slightly blue-tinted dark |
| **Sand** | Warm, slightly brown-tinted dark |
| **Ink** | Neutral near-black |
| **Midnight** | Deep navy canvas |

All themes share the same layout and corner radius; only colors change. If your OS asks for reduced motion, animations stay minimal.

---

## 11. File & image attachments

You can send files and images in any DM, group, or Space channel.

### Attach a file

1. In the chat composer, click the **paperclip** button.
2. Pick one or more files from your device.
3. Each file shows a **preview chip** with name, size, and a progress bar while uploading.
4. Type an optional caption, then **Enter** to send.
5. The message appears with the files below your text.

**Allowed types:**
- **Images:** JPG, PNG, GIF, WebP — max 30 MB each
- **Documents:** PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT — max 30 MB each

Multiple files of mixed types can be sent in a single message.

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

## 13. Notifications

### In-app bell

The **bell** is on the dashboard (near the chat header / shell). The badge is the unread count.

1. Click the bell to open the **notification center**.
2. Click an item to open the related chat (DM, group, or Space channel) and mark it read.
3. Scroll down to load older notifications.
4. **Mark all read** clears the badge.

**Escape** or click outside / the backdrop closes the center.

**Types you may see**

- New **DM** message  
- New **group** message  
- New **Space channel** message  
- Someone **@mentioned** you  
- **Friend request**  
- Friend request **accepted**

You are never notified of your **own** messages. **System** messages (joins/leaves) do not create notifications.

**Quiet when you are already in a DM:** if that DM is open and focused, the server **does not** send a notification for it. Group/Space notifications still fan out to other members.

**Sound:** a short sound can play for new DMs while the app is open.

### Browser / lock-screen push (offline)

The first time you **open the notification bell**, if the browser has not asked yet, Kivo requests **Notification permission**. If you **Allow**, this device is subscribed for **web push**.

Then, when you are **offline** or the tab is closed, you can still get native notifications for DMs, groups, Space messages, mentions, and friend events (if VAPID is configured on the server).

Clicking a push notification opens the app (typically `/app` or the relevant conversation).

Permission is **opt-in**. There is no auto-prompt on first page load.

---

## 14. Install as an app (PWA)

Kivo is installable:

- **Chrome / Edge (desktop):** browser install icon in the address bar, or menu → **Install Kivo**.
- **Android:** Add to Home Screen / Install app.
- **iOS Safari:** Share → **Add to Home Screen**.

It opens in **standalone** mode starting at `/app`. Icons and name come from `frontend/public/manifest.json`. A service worker handles push. Kivo caches your conversation, Space, friend, and friend-request **lists** in IndexedDB so they paint instantly on reload, but there is **no full offline message cache** yet (you still need the network to send/receive messages and see full history).

---

## 15. Presence and live updates

While you are connected:

- Friends and DM partners can see you as **online** (green indicator).
- New messages, edits, deletes, reactions, and receipts appear **without refresh**.
- Group and Space membership, channel list, and settings updates stream in live.
- New notifications arrive over the same realtime connection.

If the connection drops, reconnect when the network returns; history still loads from the server.

---

## 16. Keyboard and accessibility

| Action | Shortcut |
|--------|----------|
| Send message | **Enter** |
| New line in composer | **Shift+Enter** |
| Confirm mention from autocomplete | **Enter** or **Tab** |
| Move mention highlight | **Arrow up / down** |
| Save edited message | **Enter** |
| Cancel edit | **Escape** |
| Close modal / notification center | **Escape** |

Interactive controls use visible **focus** styles. Modals have labels for assistive tech. **Reduced motion** is respected.

---

## 17. Landing page (marketing)

On `/` (logged out):

- Hero and chat mockup  
- Nav: Features, Customization, Security, Roadmap  
- **Log in** / **Sign up**

Use this to explain the product; actual chat is only after signup.

---

## 18. Admin (operators)

If a user’s `role` is **`admin`** (set in the database, not in the profile editor):

- `GET /api/v1/admin/users` — list users  
- `POST /api/v1/admin/users/:id/force-logout` — revoke that user’s sessions  

There is **no admin UI** in the app today; these are API-only.

---

## What is not in the product yet

Do not expect these in the current MVP:

- WhatsApp/Discord-style **search** inside messages, conversations, or Spaces (user search only)  
- **Threads**, pinned messages, saved messages  
- **Voice / video** — phase 1 backend is wired but no call UI yet  
- **2FA** (two-factor authentication)  
- Unfriend button in the UI  
- Custom user-created themes  
- Invite links for private Spaces  
- Full offline **message** history in the PWA (chat lists are cached; messages still need the network)  
- Video/audio attachments (images and documents only in this pass)  

---

## Feature checklist (shipped)

| Feature | How you use it |
|---------|----------------|
| Sign up / log in / session refresh | `/signup`, `/login`; stay on `/app` |
| Log out | `/app/profile` |
| Friends: add, accept, decline, list, search | Sidebar → Friends |
| Open DM from a friend | Friends → **Message** |
| Send / reply / react / edit / delete messages | Chat panel + context menu |
| Emoji in text | Composer smile button |
| @mentions | Type `@` in the composer |
| Typing, presence, read receipts | Automatic while connected |
| Group create / members / admins | New group + group settings |
| Spaces, channels, roles, Discover | Sidebar Spaces + Discover + Space settings |
| Profile, avatar, frame, banner, bio, status | Sidebar profile |
| Five Framer-style themes | Sidebar theme switcher |
| In-app notifications | Bell |
| Web push | Allow notifications when opening the bell |
| Install PWA | Browser install / Add to Home Screen |
| Mobile bottom tab bar (Chats / Spaces / Profile) | On phone-sized screens |
| Offline list caching (conversations, Spaces, friends) | Automatic via IndexedDB |
| File & image attachments (images, PDFs, docs) | Paperclip button in composer |
| Image lightbox (fullscreen, arrows, download) | Click any image in chat |
| Health check (ops) | `GET /health` on the API |

For endpoint-level detail, see **API Reference** in [`PRD.md`](./PRD.md).
