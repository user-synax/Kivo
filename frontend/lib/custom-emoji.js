"use client";

import { createStore, get, set, del } from "idb-keyval";
import { apiGet } from "./api";

let emojiStore = null;
function getStore() {
  if (typeof window === "undefined") return undefined;
  if (emojiStore) return emojiStore;
  try {
    emojiStore = createStore("kivo-cache", "kivo-cache");
  } catch {
    emojiStore = undefined;
  }
  return emojiStore;
}

function cacheKey(spaceId) {
  return `kivo:emoji:${spaceId || "global"}`;
}
function personalCacheKey(userId) {
  return `kivo:emoji:personal:${userId || "mine"}`;
}

// Fetch from network and update cache
async function fetchAndStore(spaceId, key) {
  const store = getStore();
  const qs = spaceId ? `?spaceId=${encodeURIComponent(spaceId)}` : "";
  const data = await apiGet(`/api/v1/emoji${qs}`);
  const list = Array.isArray(data) ? data : [];
  // Build a tiny JSON: [{id, name, url, animated, ownerId}]
  const toCache = list.map((e) => ({
    id: e.id,
    name: e.name,
    url: e.url,
    animated: Boolean(e.animated),
    spaceId: e.spaceId || null,
    ownerId: e.ownerId || null,
  }));
  try {
    if (store) await set(key, { emojis: toCache, cachedAt: Date.now() }, store);
  } catch {}
  return toCache;
}

async function fetchPersonalAndStore(userId, key) {
  const store = getStore();
  const data = await apiGet(`/api/v1/emoji/personal`);
  const list = Array.isArray(data) ? data : [];
  const toCache = list.map((e) => ({
    id: e.id,
    name: e.name,
    url: e.url,
    animated: Boolean(e.animated),
    spaceId: e.spaceId || null,
    ownerId: e.ownerId || null,
  }));
  try {
    if (store) await set(key, { emojis: toCache, cachedAt: Date.now() }, store);
  } catch {}
  return toCache;
}

function revalidateInBackground(spaceId, key) {
  // fire-and-forget
  fetchAndStore(spaceId, key).catch(() => {});
}

/**
 * Get custom emojis for a space (or global if spaceId falsy).
 * Implements stale-while-revalidate: returns IndexedDB instantly if present,
 * revalidates in background. Caller gets an array.
 */
export async function getCustomEmojis(spaceId) {
  const key = cacheKey(spaceId);
  try {
    const store = getStore();
    if (store) {
      const cached = await get(key, store);
      if (cached && Array.isArray(cached.emojis)) {
        revalidateInBackground(spaceId, key);
        return cached.emojis;
      }
    }
  } catch {}
  // no cache: fetch live
  return await fetchAndStore(spaceId, key);
}

/**
 * Get global + space emojis merged (global first, space overrides on name collision).
 * Returns array and Map by name.
 * For spaceId, the backend's ?spaceId= already returns global+space merged in one request,
 * so we just fetch that. For global-only, fetch global.
 */
export async function getMergedEmojis(spaceId) {
  try {
    if (spaceId) {
      const list = await getCustomEmojis(spaceId);
      const arr = Array.isArray(list) ? list : [];
      const nameMap = new Map();
      for (const e of arr) nameMap.set(e.name, e);
      return { list: arr, map: nameMap, byId: new Map(arr.map((e) => [e.id, e])) };
    }
    const list = await getCustomEmojis(null);
    const arr = Array.isArray(list) ? list : [];
    const nameMap = new Map();
    for (const e of arr) nameMap.set(e.name, e);
    return { list: arr, map: nameMap, byId: new Map(arr.map((e) => [e.id, e])) };
  } catch {
    return { list: [], map: new Map(), byId: new Map() };
  }
}

export async function invalidateEmojiCache(spaceId) {
  const store = getStore();
  if (!store) return;
  try {
    const key = cacheKey(spaceId);
    await del(key, store);
    if (spaceId) {
      // space invalidation also should clear global? no, keep global separate
    }
  } catch {}
}

export async function invalidatePersonalCache(userId) {
  const store = getStore();
  if (!store) return;
  try {
    await del(personalCacheKey(userId), store);
  } catch {}
}

export async function getPersonalEmojis(userId) {
  const key = personalCacheKey(userId);
  try {
    const store = getStore();
    if (store) {
      const cached = await get(key, store);
      if (cached && Array.isArray(cached.emojis)) {
        // revalidate in background
        fetchPersonalAndStore(userId, key).catch(() => {});
        return cached.emojis;
      }
    }
  } catch {}
  return await fetchPersonalAndStore(userId, key);
}

export async function invalidateAllEmojiCaches() {
  const store = getStore();
  if (!store) return;
  try {
    // Clear global and enumerate all emoji keys (space + personal)
    const { keys } = await import("idb-keyval");
    try {
      const allKeys = await keys(store);
      const emojiKeys = allKeys.filter((k) => typeof k === "string" && k.startsWith("kivo:emoji:"));
      await Promise.all(emojiKeys.map((k) => del(k, store).catch(() => {})));
    } catch {
      await del(cacheKey(null), store);
    }
  } catch {}
}

// Pure, memoizable parser — O(n) over content, no network
// Returns array of { type: 'text', value } | { type: 'emoji', name, emoji }
// Unknown shortcodes degrade to text.
const SHORTCODE_RE = /:[a-z0-9_]{2,32}:/g;

export function parseCustomEmoji(content, emojiMap) {
  if (!content || typeof content !== "string") return [{ type: "text", value: content || "" }];
  if (!emojiMap || emojiMap.size === 0) return [{ type: "text", value: content }];
  const parts = content.split(/(:[a-z0-9_]{2,32}:)/g);
  return parts.map((token) => {
    if (token.startsWith(":") && token.endsWith(":") && token.length >= 4) {
      const name = token.slice(1, -1);
      const emoji = emojiMap.get(name);
      if (emoji) return { type: "emoji", name, emoji };
    }
    return { type: "text", value: token };
  });
}

// For reaction storage: "custom:<emojiId>"
export function customReactionKey(emojiId) {
  return `custom:${emojiId}`;
}

export function isCustomReaction(emoji) {
  return typeof emoji === "string" && emoji.startsWith("custom:");
}

export function customReactionId(emoji) {
  return isCustomReaction(emoji) ? emoji.slice(7) : null;
}
