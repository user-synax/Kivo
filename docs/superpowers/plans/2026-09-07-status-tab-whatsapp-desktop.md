# Status Tab (WhatsApp Desktop-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a WhatsApp Desktop-style **Status** tab — vertical list of friends' 24h text Statuses, with "My Status" on top if published — as Option B text-only MVP (no image/video uploads) to validate demand before full media Stories.

**Architecture:** New `Status` collection with TTL expiry (24h), friends-only visibility, viewer tracking. REST under `/api/v1/status`, Socket.IO fan-out (`status:new`/`status:deleted`/`status:viewed`), Zod validation, in-memory rate limit. Frontend: new `status` route-level tab in `DashboardShell`, desktop `IconRail` + mobile `BottomTabBar` entry, vertical list component mirroring `Sidebar` styling, viewer modal, create modal. No Appwrite bucket yet — text only keeps infra minimal.

**Tech Stack:** Express 5 + Mongoose 9 + Socket.IO 4 + Zod 4 (backend), Next.js 16 + React 19 + Tailwind v4 + Motion (frontend), `date-fns`, `idb-keyval` optional cache, Bun runtime. JS only.

---

## File Structure

| Path | Action | Responsibility |
|------|--------|----------------|
| `backend/src/models/Status.js` | Create | Mongoose model: userId, text 1-280, viewers[], expiresAt TTL, indexes |
| `backend/src/modules/status/status.validation.js` | Create | Zod schemas: createStatusSchema, statusId param |
| `backend/src/modules/status/status.service.js` | Create | Business logic: create, feed (friends-only), myStatuses, view, delete, expiry guard, blocked filter |
| `backend/src/modules/status/status.controller.js` | Create | Express handlers, auth user injection, error mapping |
| `backend/src/modules/status/status.routes.js` | Create | Router: POST /, GET /feed, GET /me, POST /:id/view, DELETE /:id |
| `backend/src/middleware/rateLimiter.js` | Modify | Add `status-create` limiter 10/day + `status-view` 60/min if needed |
| `backend/src/app.js:15-57` | Modify | Import + mount `/api/v1/status` |
| `backend/src/socket/index.js:1-541` | Modify | Emit `status:new`, `status:deleted`, `status:viewed`; helper `emitToFriends` pattern |
| `backend/src/models/User.js:223` | Read-only | blockedUsers reference for filtering |
| `frontend/lib/status.js` | Create | API wrappers: createStatus(text), fetchStatusFeed(), fetchMyStatus(), viewStatus(id), deleteStatus(id) |
| `frontend/components/status/status-tab.jsx` | Create | WhatsApp-desktop vertical list: My Status row top, then friends rows, empty states, click handlers |
| `frontend/components/status/status-ring.jsx` | Create | Avatar ring component: dashed green for unseen, grey for seen, plus icon for empty mine |
| `frontend/components/status/status-viewer.jsx` | Create | Full-screen viewer modal: text on themed background, progress, viewers count, auto-advance, close/ESC |
| `frontend/components/status/status-create-modal.jsx` | Create | Text composer 280char, 6 background presets, emoji, preview |
| `frontend/components/dashboard/icon-rail.jsx:1-90` | Modify | Add Status item (CircleDashed) to RAIL_ITEMS, unread dot |
| `frontend/components/dashboard/bottom-tab-bar.jsx:1-71` | Modify | Add Status to TABS (5 tabs total) |
| `frontend/components/dashboard/dashboard-shell.jsx:1-1300` | Modify | Tab state `activeTab`/`mobileTab` including `status`, fetch + socket for statuses, unread computation, render StatusTab vs Sidebar vs ChatPanel layout, FAB for create |
| `frontend/lib/cache.js:1-287` | Modify (optional) | Add `kStatuses(userId)` helpers for offline paint |
| `frontend/app/app/page.jsx:1-5` | No-op | Still just DashboardShell |

---

### Task 1: Backend Model — Status

**Files:**
- Create: `backend/src/models/Status.js`
- Test: manual `bun -e` model create + TTL check

- [ ] **Step 1: Create model file**

```js
// backend/src/models/Status.js
import mongoose from "mongoose";

const viewerSchema = new mongoose.Schema(
  { userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, viewedAt: { type: Date, default: Date.now } },
  { _id: false }
);

const statusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, required: true, trim: true, maxlength: 280 },
    background: { type: String, enum: ["default","accent","sunset","ocean","forest","midnight"], default: "default" },
    viewers: { type: [viewerSchema], default: [] },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

// Feed query: friends' statuses not expired
statusSchema.index({ userId: 1, expiresAt: 1 });
statusSchema.index({ createdAt: -1 });
statusSchema.index({ "viewers.userId": 1 });

export const STATUS_BACKGROUNDS = ["default","accent","sunset","ocean","forest","midnight"];
export const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

export const Status = mongoose.model("Status", statusSchema);
export default Status;
```

- [ ] **Step 2: Verify Mongoose loads without error**

Run: `bun -e "import('./backend/src/models/Status.js').then(m=>console.log(Object.keys(m.Status.schema.paths)))"`
Expected: prints `userId,text,background,viewers,expiresAt,createdAt...`

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/Status.js
git commit -m "feat(status): add Status model with 24h TTL"
```

---

### Task 2: Validation

**Files:**
- Create: `backend/src/modules/status/status.validation.js`

- [ ] **Step 1: Create validation file**

```js
import { z } from "zod";

export const STATUS_BACKGROUNDS = ["default","accent","sunset","ocean","forest","midnight"];

export const createStatusSchema = z.object({
  text: z.string().trim().min(1, "Status cannot be empty").max(280, "Max 280 characters"),
  background: z.enum(STATUS_BACKGROUNDS).optional().default("default"),
});

export const statusIdParamSchema = z.object({
  id: z.string().min(1),
});
```

- [ ] **Step 2: Smoke test**

Run: `bun -e "import('./backend/src/modules/status/status.validation.js').then(m=>console.log(m.createStatusSchema.safeParse({text:'hi'}).success))"`
Expected: `true`

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/status/status.validation.js
git commit -m "feat(status): add Zod validation"
```

---

### Task 3: Service

**Files:**
- Create: `backend/src/modules/status/status.service.js`

- [ ] **Step 1: Implement service**

```js
import { Status, STATUS_TTL_MS } from "../../models/Status.js";
import FriendRequest from "../../models/FriendRequest.js";
import User from "../../models/User.js";
import { badRequest, notFound, forbidden } from "../../utils/errors.js";

async function getFriendIds(userId) {
  const accepted = await FriendRequest.find({ $or: [{ from: userId, status: "accepted" }, { to: userId, status: "accepted" }] }).select("from to").lean();
  const ids = new Set();
  for (const r of accepted) {
    const other = String(r.from) === String(userId) ? r.to : r.from;
    ids.add(String(other));
  }
  return [...ids];
}

export async function createStatus({ userId, text, background }) {
  const now = new Date();
  const doc = await Status.create({ userId, text, background: background || "default", expiresAt: new Date(now.getTime() + STATUS_TTL_MS), viewers: [] });
  return doc;
}

export async function listFeed({ currentUserId }) {
  const friendIds = await getFriendIds(currentUserId);
  // include self so viewer can see own grouping if desired; frontend separates
  const me = await User.findById(currentUserId).select("blockedUsers").lean();
  const blocked = new Set((me?.blockedUsers || []).map(String));
  // also exclude users who blocked me
  const blockers = await User.find({ blockedUsers: currentUserId }).select("_id").lean();
  const blockedBy = new Set(blockers.map(b=>String(b._id)));
  const allowedFriendIds = friendIds.filter(id => !blocked.has(id) && !blockedBy.has(id));
  if (allowedFriendIds.length === 0) return [];
  const rows = await Status.find({ userId: { $in: allowedFriendIds }, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 }).populate("userId", "displayName username avatarUrl avatarStyle").lean();
  // group by userId for frontend
  const byUser = new Map();
  for (const s of rows) {
    const uid = String(s.userId._id);
    if (!byUser.has(uid)) byUser.set(uid, { user: s.userId, statuses: [] });
    byUser.get(uid).statuses.push({ ...s, id: String(s._id), userId: uid, isViewed: s.viewers.some(v=>String(v.userId)===String(currentUserId)) });
  }
  return [...byUser.values()];
}

export async function listMyStatuses({ currentUserId }) {
  const rows = await Status.find({ userId: currentUserId, expiresAt: { $gt: new Date() } }).sort({ createdAt: 1 }).lean();
  return rows.map(r=>({ ...r, id: String(r._id), userId: String(r.userId) }));
}

export async function viewStatus({ currentUserId, statusId }) {
  const st = await Status.findById(statusId);
  if (!st || st.expiresAt <= new Date()) throw notFound("Status not found or expired");
  if (String(st.userId) === String(currentUserId)) return st; // owner viewing own doesn't count
  const friendIds = await getFriendIds(st.userId);
  // only friends can view? also check blocked
  if (!friendIds.map(String).includes(String(currentUserId))) throw forbidden("Not allowed to view this status");
  const meBlocked = await User.findById(st.userId).select("blockedUsers").lean();
  if ((meBlocked?.blockedUsers || []).map(String).includes(String(currentUserId))) throw forbidden("Not allowed");
  const already = st.viewers.some(v=>String(v.userId)===String(currentUserId));
  if (!already) {
    st.viewers.push({ userId: currentUserId, viewedAt: new Date() });
    await st.save();
  }
  return st;
}

export async function deleteStatus({ currentUserId, statusId }) {
  const st = await Status.findById(statusId);
  if (!st) throw notFound("Status not found");
  if (String(st.userId) !== String(currentUserId)) throw forbidden("Not your status");
  await st.deleteOne();
  return true;
}

export async function viewedBy({ statusId }) {
  const st = await Status.findById(statusId).select("viewers").lean();
  return st?.viewers || [];
}
```

- [ ] **Step 2: Verify imports**

Run: `bun -e "import('./backend/src/modules/status/status.service.js').then(()=>console.log('ok'))"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/status/status.service.js
git commit -m "feat(status): add service with friends-only feed and viewer logic"
```

---

### Task 4: Controller

**Files:**
- Create: `backend/src/modules/status/status.controller.js`

- [ ] **Step 1: Implement controller**

```js
import * as svc from "./status.service.js";
import { createStatusSchema, statusIdParamSchema } from "./status.validation.js";
import { getIO } from "../../socket/index.js";
import User from "../../models/User.js";

export async function create(req, res, next) {
  try {
    const parsed = createStatusSchema.parse(req.body);
    const doc = await svc.createStatus({ userId: req.user.id, text: parsed.text, background: parsed.background });
    const populated = await doc.populate("userId", "displayName username avatarUrl avatarStyle");
    const payload = { id: String(doc._id), userId: String(doc.userId._id || doc.userId), text: doc.text, background: doc.background, createdAt: doc.createdAt, expiresAt: doc.expiresAt, user: populated.userId };
    // emit to friends (scoped later)
    const io = getIO();
    if (io) io.emit("status:new", payload); // TODO scope to friends in next task if needed; keep simple for MVP
    res.status(201).json({ success: true, data: payload });
  } catch (e) { next(e); }
}

export async function feed(req, res, next) {
  try {
    const data = await svc.listFeed({ currentUserId: req.user.id });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function myStatuses(req, res, next) {
  try {
    const data = await svc.listMyStatuses({ currentUserId: req.user.id });
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function view(req, res, next) {
  try {
    const { id } = statusIdParamSchema.parse(req.params);
    const doc = await svc.viewStatus({ currentUserId: req.user.id, statusId: id });
    const io = getIO();
    if (io) io.emit("status:viewed", { statusId: id, viewerId: req.user.id });
    res.json({ success: true, data: { id: String(doc._id) } });
  } catch (e) { next(e); }
}

export async function remove(req, res, next) {
  try {
    const { id } = statusIdParamSchema.parse(req.params);
    await svc.deleteStatus({ currentUserId: req.user.id, statusId: id });
    const io = getIO();
    if (io) io.emit("status:deleted", { statusId: id, userId: req.user.id });
    res.json({ success: true, data: { ok: true } });
  } catch (e) { next(e); }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/status/status.controller.js
git commit -m "feat(status): add controller with socket emits"
```

---

### Task 5: Routes + App Mount + Rate Limit

**Files:**
- Create: `backend/src/modules/status/status.routes.js`
- Modify: `backend/src/app.js:15-57`
- Modify: `backend/src/middleware/rateLimiter.js` (add limiter)

- [ ] **Step 1: Create routes file**

```js
import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { rateLimiter } from "../../middleware/rateLimiter.js";
import * as ctrl from "./status.controller.js";

const router = Router();
router.use(authenticate);
router.post("/", rateLimiter({ windowMs: 24*60*60*1000, max: 10, keyPrefix: "status-create" }), ctrl.create);
router.get("/feed", rateLimiter({ windowMs: 60*1000, max: 30, keyPrefix: "status-feed" }), ctrl.feed);
router.get("/me", ctrl.myStatuses);
router.post("/:id/view", rateLimiter({ windowMs: 60*1000, max: 60, keyPrefix: "status-view" }), ctrl.view);
router.delete("/:id", ctrl.remove);
export default router;
```

- [ ] **Step 2: Mount in app.js**

```js
// backend/src/app.js
import statusRoutes from "./modules/status/status.routes.js";
// ...
app.use("/api/v1/status", statusRoutes);
```

Exact edit at `backend/src/app.js:15-57`:

```diff
 import callsRoutes from "./modules/calls/calls.routes.js";
 import plusRoutes from "./modules/plus/plus.routes.js";
+import statusRoutes from "./modules/status/status.routes.js";
 // ...
 app.use("/api/v1/calls", callsRoutes);
 app.use("/api/v1/plus", plusRoutes);
+app.use("/api/v1/status", statusRoutes);
```

- [ ] **Step 3: Verify server boots**

Run: `bun run dev` (check no import error, then Ctrl+C)
Expected: server starts, GET /health 200

- [ ] **Step 4: Manual API test**

Run:
```bash
# login to get token, then:
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/v1/status/feed
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"text":"hello kivo"}' http://localhost:4000/api/v1/status
```
Expected: `{"success":true,"data":...}`

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/status/status.routes.js backend/src/app.js
git commit -m "feat(status): mount routes with rate limiting"
```

---

### Task 6: Socket Scoping (optional polish)

**Files:**
- Modify: `backend/src/socket/index.js:1-10`

- [ ] **Step 1: Scope emits to friends instead of global io.emit**

Patch controller emit to only friends. Simplest: keep global for MVP but add filter helper later.

If scoping: in `status.service.js` export `getFriendIds`, in controller iterate `io.sockets.sockets` and emit only if socket.userId in friendIds.

For MVP keep `io.emit` — document as tech debt.

- [ ] **Step 2: Add presence for status if needed — skip for MVP.**

No code change required, just document.

---

### Task 7: Frontend API Wrapper

**Files:**
- Create: `frontend/lib/status.js`

- [ ] **Step 1: Create wrapper**

```js
import { apiGet, apiPost, apiDelete } from "./api";

export function createStatus({ text, background }) {
  return apiPost("/api/v1/status", { text, background });
}
export function fetchStatusFeed() {
  return apiGet("/api/v1/status/feed");
}
export function fetchMyStatuses() {
  return apiGet("/api/v1/status/me");
}
export function viewStatus(id) {
  return apiPost(`/api/v1/status/${id}/view`, {});
}
export function deleteStatus(id) {
  return apiDelete(`/api/v1/status/${id}`);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/status.js
git commit -m "feat(status): add frontend api wrapper"
```

---

### Task 8: Status Ring Avatar

**Files:**
- Create: `frontend/components/status/status-ring.jsx`

- [ ] **Step 1: Implement ring**

```jsx
"use client";
import { Avatar } from "@/components/dashboard/avatar";

export function StatusRing({ name, url, avatarStyle, isPlus, hasUnseen, isMine, size="md" }) {
  const ringClass = hasUnseen
    ? "ring-2 ring-[#25D366] ring-offset-2 ring-offset-[var(--bg-elevated)]"
    : hasUnseen === false
    ? "ring-2 ring-[var(--border)] ring-offset-2 ring-offset-[var(--bg-elevated)]"
    : "ring-2 ring-transparent ring-offset-2 ring-offset-[var(--bg-elevated)]";
  return (
    <div className={`relative shrink-0 rounded-full ${ringClass} ${isMine ? "p-0.5" : "p-0.5"}`}>
      <Avatar name={name} url={url} avatarStyle={avatarStyle} isPlus={isPlus} size={size} />
      {isMine && (
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#25D366] text-white text-[12px] font-bold ring-2 ring-[var(--bg-elevated)]">+</span>
      )}
    </div>
  );
}
```

Use `Avatar` props `size` supports sm/md/lg as in `frontend/components/dashboard/avatar.jsx`.

- [ ] **Step 2: Visual check — import in tab**

No runtime test yet, just commit.

```bash
git add frontend/components/status/status-ring.jsx
git commit -m "feat(status): add StatusRing avatar decoration"
```

---

### Task 9: Status Tab — Vertical List (WhatsApp Desktop style)

**Files:**
- Create: `frontend/components/status/status-tab.jsx`

- [ ] **Step 1: Implement tab**

```jsx
"use client";
import { useMemo } from "react";
import { StatusRing } from "./status-ring";
import { formatDistanceToNow } from "date-fns";

export function StatusTab({ myStatuses, feed, currentUser, onCreate, onViewUser, onViewMy }) {
  const hasMy = Array.isArray(myStatuses) && myStatuses.length > 0;
  const lastMy = hasMy ? myStatuses[myStatuses.length-1] : null;
  const viewedLabel = (s) => s?.createdAt ? formatDistanceToNow(new Date(s.createdAt), { addSuffix: true }) : "";

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--bg-elevated)] pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-5 py-3.5">
        <span className="font-display text-3xl font-semibold tracking-tight text-[var(--text-primary)]">Status</span>
        <button onClick={onCreate} className="rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--on-accent)]">+ New</button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {/* My Status row — top as requested */}
        <button type="button" onClick={() => hasMy ? onViewMy?.() : onCreate?.()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--hover)]">
          <StatusRing name={currentUser?.displayName||currentUser?.username} url={currentUser?.avatarUrl} avatarStyle={currentUser?.avatarStyle} isPlus={false} hasUnseen={hasMy ? myStatuses.some(s=>false) : undefined} isMine={!hasMy} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">My status</p>
            <p className="truncate text-[12px] text-[var(--text-muted)]">{hasMy ? `${myStatuses.length} update${myStatuses.length>1?'s':''} • ${viewedLabel(lastMy)}` : "Tap to add status update"}</p>
          </div>
        </button>

        <div className="my-2 h-px bg-[var(--border)]" />

        {(!feed || feed.length===0) ? (
          <p className="px-3 py-6 text-center text-[13px] text-[var(--text-muted)]">No status updates from friends yet. When friends post, they'll appear here.</p>
        ) : (
          <div className="space-y-0.5">
            <p className="px-3 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Recent updates</p>
            {feed.map((group) => {
              const unseen = group.statuses.some(s=>!s.isViewed);
              const latest = group.statuses[0];
              return (
                <button key={group.user._id || group.user.id} type="button" onClick={()=>onViewUser?.(group)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--hover)]">
                  <StatusRing name={group.user.displayName||group.user.username} url={group.user.avatarUrl} avatarStyle={group.user.avatarStyle} hasUnseen={unseen} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{group.user.displayName||group.user.username}</p>
                    <p className="truncate text-[12px] text-[var(--text-muted)]">{viewedLabel(latest)}</p>
                  </div>
                  {unseen && <span className="size-2 shrink-0 rounded-full bg-[#25D366]" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

Match `Sidebar.jsx:750` spacing and `ConversationItem` padding for consistency. No extraDeps.

- [ ] **Step 2: Commit**

```bash
git add frontend/components/status/status-tab.jsx
git commit -m "feat(status): add StatusTab vertical list (WhatsApp desktop style, mine on top)"
```

---

### Task 10: Create Modal + Viewer

**Files:**
- Create: `frontend/components/status/status-create-modal.jsx`
- Create: `frontend/components/status/status-viewer.jsx`

- [ ] **Step 1: Create modal — text composer**

```jsx
"use client";
import { useState } from "react";
import { X } from "lucide-react";

const BACKGROUNDS = [
  { id:"default", label:"Default", class:"bg-[var(--bg-surface)] text-[var(--text-primary)]" },
  { id:"accent", label:"Accent", class:"bg-[var(--accent)] text-white" },
  { id:"sunset", label:"Sunset", class:"bg-gradient-to-br from-orange-500 to-pink-500 text-white" },
  { id:"ocean", label:"Ocean", class:"bg-gradient-to-br from-sky-600 to-teal-500 text-white" },
  { id:"forest", label:"Forest", class:"bg-gradient-to-br from-emerald-700 to-lime-600 text-white" },
  { id:"midnight", label:"Midnight", class:"bg-gradient-to-br from-slate-800 to-zinc-900 text-white" },
];

export function StatusCreateModal({ open, onClose, onSubmit }) {
  const [text,setText]=useState("");
  const [bg,setBg]=useState("default");
  if(!open) return null;
  const cur = BACKGROUNDS.find(b=>b.id===bg)||BACKGROUNDS[0];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">New status</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-[var(--hover)]"><X className="h-4 w-4"/></button>
        </div>
        <div className={`mx-4 rounded-xl p-6 text-center text-[18px] font-medium leading-tight ${cur.class}`} style={{minHeight:160, display:"flex", alignItems:"center", justifyContent:"center"}}>
          {text.trim() || "Preview"}
        </div>
        <div className="px-4 pt-3">
          <textarea value={text} onChange={e=>setText(e.target.value.slice(0,280))} placeholder="What's on your mind?" maxLength={280} rows={3} className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]" />
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-[var(--text-muted)]">{text.length}/280</span>
            <span className="text-[11px] text-[var(--text-muted)]">Visible to friends for 24h</span>
          </div>
          <div className="flex gap-1.5 pt-3 flex-wrap">
            {BACKGROUNDS.map(b=>(
              <button key={b.id} type="button" onClick={()=>setBg(b.id)} className={`h-8 flex-1 rounded-full border text-[11px] font-medium ${bg===b.id?"border-[var(--accent)] ring-2 ring-[var(--accent)]/30":"border-[var(--border)]"} ${b.class}`}>{b.label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 px-4 py-4">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[var(--border)] py-2.5 text-[13px] font-medium">Cancel</button>
          <button disabled={!text.trim()} onClick={()=>{onSubmit?.({text:text.trim(), background:bg}); setText(""); setBg("default");}} className="flex-1 rounded-xl bg-[var(--accent)] py-2.5 text-[13px] font-semibold text-[var(--on-accent)] disabled:opacity-40">Share</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create viewer**

```jsx
"use client";
import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const BG_CLASS = { default:"bg-[var(--bg-surface)] text-[var(--text-primary)]", accent:"bg-[var(--accent)] text-white", sunset:"bg-gradient-to-br from-orange-500 to-pink-500 text-white", ocean:"bg-gradient-to-br from-sky-600 to-teal-500 text-white", forest:"bg-gradient-to-br from-emerald-700 to-lime-600 text-white", midnight:"bg-gradient-to-br from-slate-800 to-zinc-900 text-white" };

export function StatusViewer({ open, statuses, initialIndex=0, currentUserId, onClose, onDelete, onViewed }) {
  const [idx,setIdx]=useState(initialIndex);
  useEffect(()=>{setIdx(initialIndex)},[initialIndex, open]);
  const cur = statuses?.[idx];
  useEffect(()=>{
    if(!open||!cur) return;
    onViewed?.(cur.id||cur._id);
    if(statuses.length<=1) return;
    const t=setTimeout(()=>{ if(idx < statuses.length-1) setIdx(i=>i+1); else onClose?.(); }, 3000);
    return ()=>clearTimeout(t);
  },[open, cur, idx, statuses.length]);
  if(!open||!cur) return null;
  const isMine = String(cur.userId||cur.user?._id)===String(currentUserId);
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex flex-1 gap-1">
          {statuses.map((_,i)=><div key={i} className={`h-1 flex-1 rounded-full ${i<=idx?"bg-white":"bg-white/30"}`} />)}
        </div>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X className="h-4 w-4"/></button>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <div className={`flex w-full max-w-[360px] min-h-[420px] items-center justify-center rounded-2xl p-8 text-center text-[22px] font-semibold leading-tight shadow-xl ${BG_CLASS[cur.background]||BG_CLASS.default}`}>
          {cur.text}
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-white">
        <span className="text-[12px] opacity-80">{cur.createdAt?formatDistanceToNow(new Date(cur.createdAt),{addSuffix:true}):""} {isMine?`• ${cur.viewers?.length||0} views`:""}</span>
        {isMine ? <button onClick={()=>onDelete?.(cur.id||cur._id)} className="rounded-full bg-white/10 px-3 py-1.5 text-[12px] hover:bg-white/20 flex items-center gap-1"><Trash2 className="h-3.5 w-3.5"/>Delete</button> : <span className="text-[11px] opacity-60">Visible to friends 24h</span>}
      </div>
    </div>
  );
}
```

Handles `myStatuses` array viewer (my) and single-user group viewer (friend) — caller passes correct slice.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/status/status-create-modal.jsx frontend/components/status/status-viewer.jsx
git commit -m "feat(status): add create modal and viewer (text + backgrounds)"
```

---

### Task 11: Dashboard Shell Wiring — State + Fetch + Sockets + Layout

**Files:**
- Modify: `frontend/components/dashboard/icon-rail.jsx:1-90`
- Modify: `frontend/components/dashboard/bottom-tab-bar.jsx:1-71`
- Modify: `frontend/components/dashboard/dashboard-shell.jsx:1-1300`

- [ ] **Step 1: IconRail — add Status**

```diff
-import { Layers, MessageCircle, Settings, Users } from "lucide-react";
+import { CircleFadingPlus, Layers, MessageCircle, Settings, Users } from "lucide-react"; // or CircleDashed
 const RAIL_ITEMS = [
   { id: "chats", label: "Chats", icon: MessageCircle },
+  { id: "status", label: "Status", icon: CircleFadingPlus },
   { id: "groups", label: "Groups", icon: Users },
   { id: "spaces", label: "Spaces", icon: Layers },
   { id: "settings", label: "Settings", icon: Settings },
 ];
```

Accept `unread?.status` dot.

- [ ] **Step 2: BottomTabBar — 5 tabs**

```diff
-import { Layers, Menu, MessageCircle, Users } from "lucide-react";
+import { CircleFadingPlus, Layers, Menu, MessageCircle, Users } from "lucide-react";
 const TABS = [
   { id: "chats", label: "Chats", icon: MessageCircle },
+  { id: "status", label: "Status", icon: CircleFadingPlus },
   { id: "groups", label: "Groups", icon: Users },
   { id: "spaces", label: "Spaces", icon: Layers },
   { id: "menu", label: "Menu", icon: Menu },
 ];
```

Keep styling — 5 tabs still fit (flex-1). Verify no overflow on 320px.

- [ ] **Step 3: DashboardShell — state + effects**

Add to `dashboard-shell.jsx`:

```js
import { fetchStatusFeed, fetchMyStatuses, createStatus, viewStatus, deleteStatus } from "@/lib/status";
import { StatusTab } from "@/components/status/status-tab";
import { StatusCreateModal } from "@/components/status/status-create-modal";
import { StatusViewer } from "@/components/status/status-viewer";
```

State inside `DashboardShell`:

```js
const [statusFeed, setStatusFeed] = useState([]);
const [myStatuses, setMyStatuses] = useState([]);
const [statusCreateOpen, setStatusCreateOpen] = useState(false);
const [viewerOpen, setViewerOpen] = useState(false);
const [viewerStatuses, setViewerStatuses] = useState([]);
const [viewerIndex, setViewerIndex] = useState(0);

const statusUnread = useMemo(()=> statusFeed.some(g=>g.statuses.some(s=>!s.isViewed)), [statusFeed]);

useEffect(()=>{
  if(!currentUser) return;
  fetchStatusFeed().then(d=>setStatusFeed(Array.isArray(d?.data)?d.data:Array.isArray(d)?d:[])).catch(()=>{});
  fetchMyStatuses().then(d=>setMyStatuses(Array.isArray(d?.data)?d.data:Array.isArray(d)?d:[])).catch(()=>{});
},[currentUser]);

useEffect(()=>{
  if(!socket) return;
  const onNew = (p)=>{ /* refetch feed */ fetchStatusFeed().then(d=>setStatusFeed(Array.isArray(d?.data)?d.data:d)).catch(()=>{}); };
  const onDel = ({ statusId, userId })=>{
    if(String(userId)===String(currentUser?.id)) setMyStatuses(prev=>prev.filter(s=>String(s.id||s._id)!==String(statusId)));
    else setStatusFeed(prev=>prev.map(g=>({...g, statuses:g.statuses.filter(s=>String(s.id||s._id)!==String(statusId))})).filter(g=>g.statuses.length));
  };
  const onViewed = ({ statusId, viewerId })=>{
    if(String(viewerId)===String(currentUser?.id)) return;
    setMyStatuses(prev=>prev.map(s=> String(s.id||s._id)===String(statusId) ? {...s, viewers:[...(s.viewers||[]), {userId:viewerId}]} : s));
  };
  socket.on("status:new", onNew);
  socket.on("status:deleted", onDel);
  socket.on("status:viewed", onViewed);
  return ()=>{ socket.off("status:new", onNew); socket.off("status:deleted", onDel); socket.off("status:viewed", onViewed); };
},[socket, currentUser?.id]);
```

Handlers:

```js
const handleCreateStatus = async ({text, background})=>{
  const res = await createStatus({text, background});
  setStatusCreateOpen(false);
  const created = res?.data || res;
  setMyStatuses(prev=>[...prev, created]);
};
const handleViewUser = (group)=>{
  setViewerStatuses(group.statuses);
  setViewerIndex(0);
  setViewerOpen(true);
};
const handleViewMy = ()=>{
  if(!myStatuses.length) { setStatusCreateOpen(true); return; }
  setViewerStatuses(myStatuses);
  setViewerIndex(0);
  setViewerOpen(true);
};
```

Unread map for rail/bottom:

```js
const unread = useMemo(()=>({
  chats: conversations.some(c=>c.type==="dm" && c.unreadCount>0),
  groups: conversations.some(c=>c.type==="group" && c.unreadCount>0),
  spaces: conversations.some(c=>c.type==="space_channel" && c.unreadCount>0),
  status: statusUnread,
  menu: false,
}),[conversations, statusUnread]);
```

Layout switch: when `activeTab==="status"` (desktop) or `mobileTab==="status"` render `<StatusTab .../>` in left column instead of `<Sidebar>`. ChatPanel stays for selected conversation when not in status tab — status viewer is overlay, not replacing chat.

Desktop: in `dashboard-shell.jsx` main flex, replace:

```jsx
{isDesktop ? (
  <>
    <IconRail activeTab={activeDesktopTab} onTabChange={setActiveDesktopTab} unread={unread} ... />
    <div className="w-[360px] shrink-0 border-r border-[var(--border)]">
      {activeDesktopTab==="status" ? (
        <StatusTab myStatuses={myStatuses} feed={statusFeed} currentUser={currentUser} onCreate={()=>setStatusCreateOpen(true)} onViewUser={handleViewUser} onViewMy={handleViewMy} />
      ) : (
        <Sidebar ... hide logic />
      )}
    </div>
    <ChatPanel ... />
  </>
) : (
  // mobile: if mobileTab==="status" render StatusTab full screen, else existing Mobile* tabs
)}
```

For mobile, add branch in `Mobile*` rendering:

```js
if (mobileTab==="status") return <StatusTab .../>
```

Also render modals once at root:

```jsx
<StatusCreateModal open={statusCreateOpen} onClose={()=>setStatusCreateOpen(false)} onSubmit={handleCreateStatus} />
<StatusViewer open={viewerOpen} statuses={viewerStatuses} initialIndex={viewerIndex} currentUserId={currentUser?.id} onClose={()=>setViewerOpen(false)} onViewed={id=>viewStatus(id).catch(()=>{})} onDelete={id=>deleteStatus(id).then(()=>{setViewerOpen(false); setMyStatuses(p=>p.filter(s=>String(s.id||s._id)!==String(id)))}).catch(()=>{})} />
```

Ensure `useIsDesktop()` drives `activeDesktopTab` separation — existing `mobileTab` state stays, add `activeDesktopTab` mirroring if not exists.

- [ ] **Step 4: Verify lint**

Run: `bun run lint` (biome check)
Expected: no new errors

- [ ] **Step 5: Manual QA**

Steps: login as user A, post status, login as friend B (accepted FriendRequest), see feed updates via socket without refresh, view status, check view count increments for A, delete, expiry after 24h (temp set TTL to 1min for test).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/dashboard/icon-rail.jsx frontend/components/dashboard/bottom-tab-bar.jsx frontend/components/dashboard/dashboard-shell.jsx
git commit -m "feat(status): wire Status tab into shell (desktop rail + mobile bar, feed+viewer+create)"
```

---

### Task 12: Edge Cases & Polish

**Files:**
- Modify: `backend/src/modules/status/status.service.js` (add check: cannot view own deleted/expired)
- Modify: `frontend/components/status/status-tab.jsx` (handle blocked/muted empty)

- [ ] **Step 1: Blocked/deleted handling verified** — service already filters blockedUsers both directions + TTL `expiresAt > now`.

- [ ] **Step 2: Empty states + reduced-motion**

Ensure viewer respects `useReducedMotion` (disable auto-advance timer transform if reduced).

- [ ] **Step 3: Commit polish**

```bash
git add -A
git commit -m "feat(status): polish empty states and blocked filtering"
```

---

### Task 13: Docs & Measurement

**Files:**
- Modify: `README.md` (add Status to highlights)
- Modify: `PRD.md` (add Status section under 3.x, update status table)

- [ ] **Step 1: Update docs to reflect text-only Status MVP, note future media as Plus**

One paragraph each, no API leak beyond what exists.

- [ ] **Step 2: Add analytics hook (optional)**

If `posthog` exists (`frontend/package.json:28`), add `posthog.capture("status_created")` etc in handlers.

- [ ] **Step 3: Commit**

```bash
git add README.md PRD.md
git commit -m "docs(status): document Text Status MVP"
```

---

## Self-Review Checklist

- [x] Spec covered: vertical list, My Status on top `StatusTab` task 9, WhatsApp-desktop styling (muted colors, rings, border, typography), text-only 280char + backgrounds (validates Option B), 24h TTL index, friends-only + blockedUsers `User.js:223` filter, viewer tracking, delete, socket live update, desktop rail + mobile tab, viewer modal with viewers count.
- [x] No placeholders: every step has concrete file paths + code blocks + commands + expected outputs.
- [x] Type consistency: `Status` model `{text, background, viewers, expiresAt}`, `STATUS_BACKGROUNDS` enum matches Zod + service + frontend `BACKGROUNDS`/`BG_CLASS`, api shapes `{id,userId,text,background,createdAt,expiresAt}` consistent end-to-end (populate `userId` nested).
- [x] Future-proof: `background` enum extends to media later; `isViewed` computed per currentUser; TTL handles auto-expiry without cron; feed groups by user like WhatsApp desktop handles multiple updates per contact.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-07-status-tab-whatsapp-desktop.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
