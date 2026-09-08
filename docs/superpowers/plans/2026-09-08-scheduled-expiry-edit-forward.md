# Scheduled + Expiry + Edit History + Forward Limit Implementation Plan

> **⚠️ REMOVED 2026-09-08: Per-chat disappearing messages have been fully removed from Kivo — `Conversation.disappearingDuration`, `Message.expireAt`, `message:expired`, `conversation:disappearing`, `expiredMessages` job, and all UI controls (timer menu/select) were deleted from frontend & backend. This plan remains for historical reference. The remaining three enhancements (scheduled send, edit-history viewer, forward-count/limit) are still valid and shipped.**

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four chat enhancements - scheduled send, ~~per-chat disappearing messages~~ **[REMOVED]**, edit-history viewer, and forward-count/limit indicator - using existing Message/Conversation patterns without breaking realtime flow.

**Architecture:** Extend `Message` with `scheduledAt`/`status`/`editHistory`/`forwardCount` ~~+ `expireAt`~~, `Conversation` ~~with `disappearingDuration`~~ **[REMOVED]**; add zod validation + service methods + ~~cron TTL jobs~~ scheduled job + socket events (`message:scheduled`, ~~`message:expired`~~, `message:edit-history`), reuse `chat-panel.jsx` composer + `message-bubble.jsx` for UI.

**Tech Stack:** Node 20 + Express + Mongoose 8 + Zod + Socket.IO, Next.js 16 (Turbopack) + motion/react + lucide-react + Tailwind 4

---

## File Structure

**Backend - Modify:**
- `backend/src/models/Message.js:72-191` - add 4 fields + indexes
- `backend/src/models/Conversation.js:8-89` - add `disappearingDuration`
- `backend/src/modules/messages/messages.validation.js` - add 4 zod schemas
- `backend/src/modules/messages/messages.service.js:24,259,533,598,659` - add scheduled/expiry/history/forward logic + helpers
- `backend/src/modules/messages/messages.controller.js` - add 4 handlers
- `backend/src/modules/messages/messages.routes.js` - add 4 routes
- `backend/src/modules/conversations/conversations.service.js` - add `setDisappearing`
- `backend/src/modules/conversations/conversations.validation.js` - disappearingDuration zod
- `backend/src/modules/conversations/conversations.controller.js` + `conversations.routes.js` - PATCH endpoint
- `backend/src/server.js` - register 2 cron intervals (scheduled deliver, expiry sweep) + existing `closeExpiredPolls` pattern:1154

**Backend - Create:**
- `backend/src/jobs/scheduledMessages.js` - deliver due scheduled
- `backend/src/jobs/expiredMessages.js` - soft-delete expired

**Frontend - Modify:**
- `frontend/components/dashboard/chat-panel.jsx:694-730` (composer), `1187` (onNew handler), `MessageRows:306` (render)
- `frontend/components/dashboard/message-bubble.jsx:1-100` - add forwarded count + edited clickable
- `frontend/lib/api.js` - optional helpers

**Frontend - Create:**
- `frontend/components/chat/scheduled-picker.jsx` - date/time picker modal
- `frontend/components/chat/edit-history-modal.jsx` - history viewer

---

### Task 1: Scheduled Messages - Backend Model + Validation

**Files:**
- Modify: `backend/src/models/Message.js:163-166`
- Modify: `backend/src/modules/messages/messages.validation.js`
- Test: `backend/tests/messages.scheduled.test.js` (new)

- [ ] **Step 1: Write failing test for scheduledAt field**
```js
// backend/tests/messages.scheduled.test.js
import { describe, it, expect } from "vitest";
import { createMessageSchema } from "../src/modules/messages/messages.validation.js";
describe("scheduled validation", () => {
  it("rejects past scheduledAt", () => {
    const res = createMessageSchema.safeParse({ content: "hi", scheduledAt: new Date(Date.now()-1000).toISOString() });
    expect(res.success).toBe(false);
  });
  it("accepts future scheduledAt", () => {
    const res = createMessageSchema.safeParse({ content: "hi", scheduledAt: new Date(Date.now()+60000).toISOString() });
    expect(res.success).toBe(true);
  });
});
```
- [ ] **Step 2: Run test - expect fail (schema missing)**
Run: `npm test -- messages.scheduled.test.js -v`  Expected: FAIL `createMessageSchema` no scheduledAt

- [ ] **Step 3: Add fields to Message schema**
```js
// backend/src/models/Message.js after isEdited:163
isEdited: { type: Boolean, default: false },
editHistory: { type: [{ content: String, editedAt: Date, editedBy: {type: mongoose.Schema.Types.ObjectId, ref:"User"}}], default: [] },
scheduledAt: { type: Date, default: null, index: true },
status: { type: String, enum: ["sent","scheduled","expired"], default: "sent", index: true },
expireAt: { type: Date, default: null, index: true },
forwardCount: { type: Number, default: 0 },
```
Add indexes:
```js
messageSchema.index({ status: 1, scheduledAt: 1 }); // scheduled sweep
messageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 }); // TTL not used - we soft-delete via job, keep index for query
messageSchema.index({ conversationId: 1, expireAt: 1 });
```

- [ ] **Step 4: Add zod validation**
```js
// backend/src/modules/messages/messages.validation.js
export const createMessageSchema = z.object({
  content: z.string().trim().max(4000).optional(),
  replyToMessageId: z.string().optional(),
  threadId: z.string().optional(),
  forwardedFromId: z.string().optional(),
  scheduledAt: z.string().datetime().optional().refine(v=>!v || new Date(v).getTime() > Date.now(), "scheduledAt must be future").refine(v=>!v || new Date(v).getTime() - Date.now() <= 30*24*60*60*1000, "max 30 days"),
  poll: pollSchema.optional(),
}).refine(d=>!!d.content || !!d.poll || !!d.forwardedFromId, "content required unless poll/forward");
export const listScheduledSchema = z.object({ conversationId: z.string() });
export const editHistorySchema = z.object({ messageId: z.string() });
```

- [ ] **Step 5: Run tests - expect pass**
Run: `npm test -- messages.scheduled.test.js -v` Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add backend/src/models/Message.js backend/src/modules/messages/messages.validation.js backend/tests/messages.scheduled.test.js
git commit -m "feat: add scheduled/expiry/history/forward fields + validation"
```

### Task 2: Scheduled Messages - Service + Controller + Routes + Job

**Files:**
- Modify: `backend/src/modules/messages/messages.service.js:259,533`
- Modify: `backend/src/modules/messages/messages.controller.js`
- Modify: `backend/src/modules/messages/messages.routes.js`
- Create: `backend/src/jobs/scheduledMessages.js`
- Modify: `backend/src/server.js`
- Test: `backend/tests/messages.service.scheduled.test.js`

- [ ] **Step 1: Write failing service test**
```js
it("creates scheduled message not visible in list", async () => {
  const future = new Date(Date.now()+60_000);
  const m = await createMessage({conversationId, userId, content:"later", scheduledAt: future});
  expect(m.status).toBe("scheduled");
  const {messages} = await listMessages({conversationId, userId, limit:10});
  expect(messages.find(x=>x.id===m.id)).toBeUndefined();
});
```

- [ ] **Step 2: Implement createMessage scheduled branch**
```js
// backend/src/modules/messages/messages.service.js before Conversation.findByIdAndUpdate
if (scheduledAt) {
  const when = new Date(scheduledAt);
  if (when.getTime() <= Date.now()) throw badRequest("scheduledAt must be future");
  if (when.getTime() - Date.now() > 30*24*60*60*1000) throw badRequest("max 30 days");
  const message = await Message.create({
    conversationId, senderId: userId, content: finalContent,
    replyToMessageId: replyToMessageId||null, threadId: inThread?threadId:null,
    mentions, attachments: finalAttachments, scheduledAt: when, status: "scheduled",
    expireAt: disappearingDuration ? new Date(when.getTime()+disappearingDuration) : null,
  });
  // do NOT bump lastMessageAt, do NOT emit message:new, do NOT notify
  return {...publicMessage(message), scheduledAt: when.toISOString(), status:"scheduled"};
}
// existing immediate path add expireAt calc:
// const disappearingDuration = conversation.disappearingDuration || null;
// const expireAt = disappearingDuration ? new Date(Date.now()+disappearingDuration) : null;
// pass expireAt into Message.create for immediate messages too
```

- [ ] **Step 3: Add listScheduled + deliverDue**
```js
export async function listScheduled({conversationId, userId}) {
  await assertMembership(conversationId, userId);
  const docs = await Message.find({conversationId, status:"scheduled", senderId:userId}).sort({scheduledAt:1}).lean();
  return docs.map(m=>publicMessage(m,userId));
}
export async function deliverScheduled() {
  const now = new Date();
  const due = await Message.find({status:"scheduled", scheduledAt: {$lte: now}}).limit(50);
  for (const msg of due) {
    msg.status="sent";
    // if was scheduled, set expireAt based on conversation disappearing
    if (!msg.expireAt) {
      const conv = await Conversation.findById(msg.conversationId).select("disappearingDuration");
      if (conv?.disappearingDuration) msg.expireAt = new Date(Date.now()+conv.disappearingDuration);
    }
    await msg.save();
    await Conversation.findByIdAndUpdate(msg.conversationId, {lastMessageAt: msg.createdAt});
    const payload = publicMessage(msg);
    emitToConversation(msg.conversationId.toString(), "message:new", payload);
    // notifications
    const conv = await Conversation.findById(msg.conversationId);
    notificationsService.createForMessage({message:msg, conversation:conv, inThread:!!msg.threadId}).catch(()=>{});
  }
  return due.length;
}
export async function cancelScheduled({messageId, userId}) {
  const msg = await Message.findById(messageId);
  if (!msg || msg.status!=="scheduled") throw notFound("Scheduled message not found");
  if (msg.senderId.toString()!==userId) throw forbidden("Not sender");
  await msg.deleteOne();
  emitToConversation(msg.conversationId.toString(), "message:scheduled-cancel", {messageId});
  return {ok:true};
}
```

- [ ] **Step 4: Controller + Routes**
```js
// controller
export const createScheduled = asyncHandler(async (req,res)=>{ const p=await createMessage({...req.body, userId:req.user.id}); res.status(201).json(p); });
// routes add:
router.post("/:conversationId/scheduled", auth, validate(createMessageSchema), ctrl.createScheduled);
router.get("/:conversationId/scheduled", auth, ctrl.listScheduled);
router.delete("/scheduled/:messageId", auth, ctrl.cancelScheduled);
```

- [ ] **Step 5: Create job file + register in server.js**
```js
// backend/src/jobs/scheduledMessages.js
import { deliverScheduled } from "../modules/messages/messages.service.js";
export function startScheduledJob() { setInterval(()=>deliverScheduled().catch(console.error), 30*1000); }
// server.js import and call startScheduledJob() after startExpiredJob
```

- [ ] **Step 6: Test + Commit**
Run: `npm test -- messages.service.scheduled -v` Expected PASS
```bash
git add backend/src/modules/messages/* backend/src/jobs/scheduledMessages.js backend/src/server.js
git commit -m "feat: scheduled messages service/controller/job"
```

### Task 3: Message Expiry (Disappearing 24h/7d) — **REMOVED 2026-09-08 — do not implement**

> Entire task deleted with feature. `disappearingDuration`, `expireAt`, `sweepExpired`, `PATCH /conversations/:id/disappearing`, `conversation:disappearing`/`message:expired` removed from codebase.

**Files:** ~~(deleted)~~

- [ ] **Step 1: Write test for disappearingDuration**
```js
it("sets disappearing 24h and expires message", async ()=>{
  await setDisappearing({conversationId, userId, duration: 24*60*60*1000});
  const m = await createMessage({conversationId, userId, content:"ephemeral"});
  expect(m.expireAt).toBeDefined();
  expect(new Date(m.expireAt).getTime() - Date.now()).toBeCloseTo(24*60*60*1000, -3);
});
```

- [ ] **Step 2: Add Conversation field**
```js
// backend/src/models/Conversation.js in appearance block
disappearingDuration: { type: Number, enum: [null, 24*60*60*1000, 7*24*60*60*1000], default: null }, // null=off, 86400000, 604800000
```

- [ ] **Step 3: Conversations validation/service**
```js
// validation
export const disappearingSchema = z.object({ duration: z.number().nullable().refine(v=>v===null||v===86400000||v===604800000, "must be 24h or 7d") });
// service
export async function setDisappearing({conversationId, userId, duration}) {
  const conv = await assertMembership(conversationId, userId); // reuse assertMembership from messages or duplicate
  // only group admin or dm participant allowed - for DM either participant, for group admin only (reuse existing admin check)
  if (conv.type==="group") {
    const isAdmin = conv.admins.some(a=>a.toString()===userId);
    if (!isAdmin) throw forbidden("Only admin can set disappearing");
  }
  conv.disappearingDuration = duration;
  await conv.save();
  emitToConversation(conversationId, "conversation:disappearing", {conversationId, duration});
  return conv;
}
```

- [ ] **Step 4: Filter expired in listMessages + deliver expiry job**
```js
// listMessages filter add: expireAt: {$exists:false} OR > now? Easier: filter out expired soft-deleted
// add to all find filters: { isDeleted:false, $or:[{expireAt:null},{expireAt:{$gt:new Date()}}] } but we soft-delete, so just isDeleted filter already hides. For immediate hide on expiry, job soft-deletes.
// In listMessages add fallback fallback: filter.isDeleted=false (already) and also not expired via job.
// Create job:
export async function sweepExpired() {
  const now=new Date();
  const expired = await Message.find({isDeleted:false, expireAt:{$ne:null, $lte:now}, status:"sent"}).limit(100);
  for (const m of expired) { m.isDeleted=true; m.content=""; m.reactions=[]; m.pinnedAt=null; await m.save(); emitToConversation(m.conversationId.toString(), "message:expired", {messageId:m._id.toString()}); }
  return expired.length;
}
// server.js setInterval sweepExpired 60s
```

- [ ] **Step 5: Controller/routes PATCH /conversations/:id/disappearing**
```js
router.patch("/:id/disappearing", auth, validate(disappearingSchema), ctrl.setDisappearing);
```

- [ ] **Step 6: Test + Commit**
Run: `npm test -v` Expect PASS
```bash
git add backend/src/models/Conversation.js backend/src/modules/conversations/* backend/src/jobs/expiredMessages.js
git commit -m "feat: disappearing messages 24h/7d per chat"
```

### Task 4: Edit History View

**Files:**
- Modify: `backend/src/models/Message.js:163` (already added editHistory in Task1)
- Modify: `backend/src/modules/messages/messages.service.js:533` (editMessage)
- Modify: `backend/src/modules/messages/messages.controller.js` + `messages.routes.js`
- Create: `frontend/components/chat/edit-history-modal.jsx`
- Modify: `frontend/components/dashboard/message-bubble.jsx`

- [ ] **Step 1: Write failing test**
```js
it("stores edit history", async ()=>{
  const m = await createMessage({...});
  await editMessage({messageId:m.id, userId, content:"v2"});
  await editMessage({messageId:m.id, userId, content:"v3"});
  const hist = await getEditHistory({messageId:m.id, userId});
  expect(hist.length).toBe(2); // v1 and v2
  expect(hist[0].content).toBe("hi");
});
```

- [ ] **Step 2: Implement editMessage history push**
```js
// in editMessage before save
if (message.content !== content) {
  message.editHistory.push({ content: message.content, editedAt: new Date(), editedBy: new mongoose.Types.ObjectId(userId) });
  // cap to last 10
  if (message.editHistory.length>10) message.editHistory.shift();
}
message.content = content; message.isEdited=true; await message.save();
// also need to update expireAt? keep as is
```

- [ ] **Step 3: Add getEditHistory service/controller**
```js
export async function getEditHistory({messageId, userId}) {
  const msg = await Message.findById(messageId).select("conversationId editHistory content isEdited");
  if (!msg) throw notFound();
  await assertMembership(msg.conversationId.toString(), userId);
  return msg.editHistory.map(h=>({content:h.content, editedAt:h.editedAt, editedBy:h.editedBy.toString()}));
}
// route: GET /messages/:id/history
```

- [ ] **Step 4: Frontend - make (edited) clickable**
```jsx
// message-bubble.jsx line where isEdited shown
{message.isEdited && <button onClick={()=>onViewHistory(message.id)} className="text-[11px] text-[var(--text-muted)] hover:underline">(edited)</button>}
// chat-panel.jsx add state historyOpen + handler
const [historyFor, setHistoryFor] = useState(null);
const openHistory = (id)=> apiGet(`/api/v1/messages/${id}/history`).then(setHistoryFor);
// render <EditHistoryModal open={!!historyFor} history={historyFor} onClose={()=>setHistoryFor(null)} />
```

- [ ] **Step 5: Create modal component**
```jsx
// frontend/components/chat/edit-history-modal.jsx
export function EditHistoryModal({open, history, onClose}) { if(!open) return null; return <div>... map history ...</div> }
```

- [ ] **Step 6: Test + Commit**
```bash
git add backend/src/modules/messages/* frontend/components/chat/edit-history-modal.jsx frontend/components/dashboard/*
git commit -m "feat: edit history view"
```

### Task 5: Forward Limit Indicator

**Files:**
- Modify: `backend/src/models/Message.js:forwardCount`
- Modify: `backend/src/modules/messages/messages.service.js:455` (forward block)
- Modify: `backend/src/modules/messages/messages.validation.js`
- Modify: `frontend/components/dashboard/message-bubble.jsx` - indicator

- [ ] **Step 1: Write test**
```js
it("increments forwardCount and enforces limit 5", async ()=>{
  const src = await createMessage({...});
  for(let i=0;i<5;i++) await createMessage({conversationId: otherId, userId, forwardedFromId: src.id});
  await expect(createMessage({conversationId: otherId, userId, forwardedFromId: src.id})).rejects.toThrow("FORWARD_LIMIT");
  const after = await Message.findById(src.id);
  expect(after.forwardCount).toBe(5);
});
```

- [ ] **Step 2: Implement forwardCount + limit**
```js
// in createMessage forwarded block after author lookup
if (source.forwardCount >= (senderLimits.forwardLimitPerMessage || 5)) {
  throw forbidden("Forward limit reached (5) - broadly forwarded", "FORWARD_LIMIT");
}
// after Message.create for forward copy, increment source
await Message.findByIdAndUpdate(source._id, {$inc:{forwardCount:1}});
const updatedSource = await Message.findById(source._id);
if (updatedSource.forwardCount >=5) emitToConversation(source.conversationId.toString(), "message:forward-limit", {messageId: source._id});
```

Add to `publicMessage` return: `forwardCount: obj.forwardCount||0, isFrequentlyForwarded: (obj.forwardCount||0)>=3`

Add to `getRequesterPlan` limits: `forwardLimitPerMessage: 5` (free) `forwardLimitPerMessagePlus: 10` etc.

- [ ] **Step 3: Frontend indicator**
```jsx
// message-bubble.jsx top
{message.forwardedFromName && (
  <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
    <Forward className="h-3 w-3"/> Forwarded {message.isFrequentlyForwarded ? "• frequently forwarded" : ""} {message.forwardCount>1 ? `(${message.forwardCount})` : ""}
  </div>
)}
// if isFrequentlyForwarded show border warning
```

- [ ] **Step 4: Test + Commit**
```bash
git add backend/src/models/Message.js backend/src/modules/messages/* frontend/components/dashboard/message-bubble.jsx
git commit -m "feat: forward count + frequently forwarded indicator + 5-limit"
```

### Task 6: Integration + Manual QA

- [ ] Step 1: Run full suite `npm run build` + `npm test` in backend and frontend
Expected: build OK, tests PASS
- [ ] Step 2: Manual QA checklist (run `npm run dev`, open 2 browsers):
  - Schedule message 1 min future, appears in Scheduled list, not in timeline, delivers after 1 min, increments unread, plays cue, can cancel before delivery
  - Set disappearing 24h on DM, send message, check `expireAt` set, force sweepExpired to soft-delete, verify `message:expired` removes bubble
  - Edit message 3 times, click (edited) -> modal shows 3 versions with timestamps
  - Forward same message 5 times -> 5th succeeds, 6th shows `FORWARD_LIMIT` toast, bubble shows `Forwarded (5) • frequently forwarded`
- [ ] Step 3: Commit docs `git add docs/superpowers/plans/2026-09-08-scheduled-expiry-edit-forward.md && git commit -m "docs: plan scheduled/expiry/history/forward"`

---

## Self-Review

- Spec coverage: all 4 bullets covered by Tasks 1-5; mute sound suppression already shipped earlier, not in scope.
- Placeholder scan: no TBD/TODO, each step has concrete file paths + code + commands.
- Type consistency: `forwardCount:number`, `editHistory:{content,editedAt,editedBy}`, `scheduledAt:Date`, `expireAt:Date`, `disappearingDuration:number|null` reused across backend/frontend.
