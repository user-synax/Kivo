"use client";

import { createStore, del, get, set } from "idb-keyval";

// Single IndexedDB database `kivo-cache` with one key-value store.
// We use an explicit store so the DB name is `kivo-cache` as spec'd,
// instead of the idb-keyval default `keyval-store`.
let cacheStore = null;
function getStore() {
  if (typeof window === "undefined") return undefined;
  if (cacheStore) return cacheStore;
  try {
    cacheStore = createStore("kivo-cache", "kivo-cache");
  } catch {
    cacheStore = undefined;
  }
  return cacheStore;
}

function kConversations(userId) {
  return `conversations:${userId}`;
}
function kSpaces(userId) {
  return `spaces:${userId}`;
}
function kFriends(userId) {
  return `friends:${userId}`;
}
function kFriendRequests(userId) {
  return `friend-requests:${userId}`;
}

export async function getCachedConversations(userId) {
  if (!userId) return null;
  try {
    const store = getStore();
    const data = await get(kConversations(userId), store);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function setCachedConversations(userId, data) {
  if (!userId) return;
  try {
    const store = getStore();
    await set(kConversations(userId), data, store);
  } catch {
    // IDB failures must never throw or block UI
  }
}

export async function getCachedSpaces(userId) {
  if (!userId) return null;
  try {
    const store = getStore();
    const data = await get(kSpaces(userId), store);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function setCachedSpaces(userId, data) {
  if (!userId) return;
  try {
    const store = getStore();
    await set(kSpaces(userId), data, store);
  } catch {
    // ignore
  }
}

export async function getCachedFriends(userId) {
  if (!userId) return null;
  try {
    const store = getStore();
    const data = await get(kFriends(userId), store);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function setCachedFriends(userId, data) {
  if (!userId) return;
  try {
    const store = getStore();
    await set(kFriends(userId), data, store);
  } catch {
    // ignore
  }
}

export async function getCachedFriendRequests(userId) {
  if (!userId) return null;
  try {
    const store = getStore();
    const data = await get(kFriendRequests(userId), store);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function setCachedFriendRequests(userId, data) {
  if (!userId) return;
  try {
    const store = getStore();
    await set(kFriendRequests(userId), data, store);
  } catch {
    // ignore
  }
}

export async function clearUserCache(userId) {
  if (!userId) return;
  try {
    const store = getStore();
    await Promise.all([
      del(kConversations(userId), store).catch(() => {}),
      del(kSpaces(userId), store).catch(() => {}),
      del(kFriends(userId), store).catch(() => {}),
      del(kFriendRequests(userId), store).catch(() => {}),
    ]);
  } catch {
    // ignore
  }
}

function kFinishedRace(matchId) {
  return `finished-race:${matchId}`;
}

export async function getCachedFinishedRace(matchId) {
  if (!matchId) return null;
  try {
    const store = getStore();
    const data = await get(kFinishedRace(matchId), store);
    return data ?? null;
  } catch {
    return null;
  }
}

export async function setCachedFinishedRace(matchId, data) {
  if (!matchId || !data) return;
  // Only cache completed races — guard caller, double-check here
  if (data.status !== "completed") return;
  try {
    const store = getStore();
    await set(kFinishedRace(matchId), data, store);
  } catch {
    // ignore
  }
}

export async function getCachedFinishedRaces(matchIds) {
  if (!Array.isArray(matchIds) || matchIds.length === 0) return {};
  try {
    const store = getStore();
    const entries = await Promise.all(
      matchIds.map(async (id) => {
        const v = await get(kFinishedRace(id), store).catch(() => null);
        return [id, v];
      }),
    );
    const map = {};
    for (const [id, v] of entries) if (v) map[id] = v;
    return map;
  } catch {
    return {};
  }
}
