"use client";

// Persistent outbox for messages the user composed but the server has not
// confirmed yet. This is the durable half of offline sending:
//
//   - The queue lives in IndexedDB (via cache.js) keyed per user, so pending
//     sends survive a reload — reopening the conversation re-shows them.
//   - A lightweight in-memory mirror + pub/sub keeps chat-panel and the
//     flusher in sync without a global context.
//   - Entries carry a client tempId. When the server confirms a send the
//     entry transitions to "sent" with the real message attached for one
//     render tick (so the open chat can swap the optimistic bubble), then is
//     dropped. "sent" state is never persisted.
//
// Statuses: "queued" (composed while offline), "sending" (in flight),
// "failed" (last attempt errored — will retry on reconnect/manual retry).

import { getOutboxEntries, saveOutboxEntries } from "./cache";

let activeUserId = null;
let hydrated = false;
// Pending entries, oldest first. Order is preserved by pushes; flusher sends
// oldest-first to keep conversation order sane.
let entries = [];
// Stable snapshot handed to subscribers (useSyncExternalStore requires the
// reference to change only when the data changes).
let snapshot = [];
const listeners = new Set();

function publish() {
  snapshot = entries.map((e) => ({ ...e }));
  for (const fn of listeners) fn();
}

function persist() {
  if (!activeUserId) return Promise.resolve();
  return saveOutboxEntries(activeUserId, entries);
}

// Load the queue for `uid` from IndexedDB (once per session/user).
export async function initOutbox(uid) {
  if (!uid || (hydrated && uid === activeUserId)) return;
  activeUserId = uid;
  hydrated = true;
  entries = (await getOutboxEntries(uid).catch(() => null)) ?? [];
  publish();
}

// Forget everything (logout / user switch). IndexedDB cleanup happens in
// cache.clearUserCache — this only resets the in-memory mirror.
export function resetOutbox() {
  activeUserId = null;
  hydrated = false;
  entries = [];
  publish();
}

export function subscribeOutbox(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Stable array snapshot — safe for useSyncExternalStore.
export function getOutboxSnapshot() {
  return snapshot;
}

export function getPendingOutbox() {
  return entries;
}

function normalize(item) {
  return {
    tempId: item.tempId,
    conversationId: item.conversationId,
    content: item.content || "",
    replyToMessageId: item.replyToMessageId || null,
    createdAt: item.createdAt || new Date().toISOString(),
    status: item.status || "queued",
  };
}

export async function enqueueOutbox(item) {
  const entry = normalize(item);
  entries.push(entry);
  await persist().catch(() => {});
  publish();
  return entry.tempId;
}

export async function setOutboxStatus(tempId, status) {
  const e = entries.find((x) => x.tempId === tempId);
  if (!e || e.status === status) return;
  e.status = status;
  await persist().catch(() => {});
  publish();
}

// Mark an entry as confirmed by the server. The real message rides along so
// the open conversation can swap the optimistic bubble immediately. The entry
// is kept (unpersisted) for a short window so chat-panel can reconcile, then
// pruned — callers may also removeOutbox() it right away after reconciling.
export async function completeOutbox(tempId, serverMessage) {
  const e = entries.find((x) => x.tempId === tempId);
  if (!e) return;
  e.status = "sent";
  e.serverMessage = serverMessage || null;
  publish();
  setTimeout(() => {
    const i = entries.findIndex((x) => x.tempId === tempId);
    if (i >= 0 && entries[i].status === "sent") {
      entries.splice(i, 1);
      persist().catch(() => {});
      publish();
    }
  }, 5000);
}

export async function removeOutbox(tempId) {
  const i = entries.findIndex((x) => x.tempId === tempId);
  if (i < 0) return;
  entries.splice(i, 1);
  await persist().catch(() => {});
  publish();
}
