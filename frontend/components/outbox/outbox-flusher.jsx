"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useSocket } from "@/components/socket-provider";
import { apiPost } from "@/lib/api";
import { getSession } from "@/lib/auth";
import {
  completeOutbox,
  getOutboxSnapshot,
  getPendingOutbox,
  initOutbox,
  resetOutbox,
  setOutboxStatus,
  subscribeOutbox,
} from "@/lib/outbox";

// While pending sends exist and the browser reports a connection, keep
// prodding on a slow timer — covers flaky networks where no socket reconnect
// event fires but REST suddenly works again.
const RETRY_INTERVAL_MS = 20_000;
const PASS_COOLDOWN_MS = 3_000;

function countPending() {
  return getOutboxSnapshot().filter(
    (e) => e.status === "queued" || e.status === "failed",
  ).length;
}

// Invisible. Watches the durable outbox and pushes queued/failed messages to
// the server whenever there is a chance it will work:
//   - right after hydration (a reload while online),
//   - on the browser "online" event,
//   - on every successful socket reconnect,
//   - and on a slow timer while anything is still pending.
// A successful send hands the server message to the store ("sent" + payload);
// the open conversation swaps its optimistic bubble via its own subscription.
export function OutboxFlusher() {
  const { isConnected, reconnectNonce } = useSocket();
  const uid = getSession()?.id;
  const pendingCount = useSyncExternalStore(subscribeOutbox, countPending);
  const inFlight = useRef(false);
  const lastAttempt = useRef(0);
  const timerRef = useRef(null);

  const flush = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) return;
    const pending = getPendingOutbox().filter(
      (e) => e.status === "queued" || e.status === "failed",
    );
    if (!pending.length) return;
    const now = Date.now();
    if (now - lastAttempt.current < PASS_COOLDOWN_MS) return;
    lastAttempt.current = now;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // Oldest first keeps the conversation's message order intact.
      const ordered = [...pending].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      );
      for (const entry of ordered) {
        const current = getPendingOutbox().find(
          (x) => x.tempId === entry.tempId,
        );
        if (!current || current.status === "sent") continue;
        setOutboxStatus(entry.tempId, "sending").catch(() => {});
        try {
          const msg = await apiPost(
            `/api/v1/conversations/${entry.conversationId}/messages`,
            {
              content: entry.content || undefined,
              ...(entry.replyToMessageId && {
                replyToMessageId: entry.replyToMessageId,
              }),
            },
          );
          completeOutbox(entry.tempId, msg);
        } catch {
          // Keep it marked failed. The UI shows a manual retry, and the next
          // reconnect/timer/online trigger will try again.
          setOutboxStatus(entry.tempId, "failed").catch(() => {});
        }
      }
    } finally {
      inFlight.current = false;
      // If some sends still failed, keep the slow retry loop alive (the
      // pendingCount effect only re-arms when the count *changes*).
      const remaining = countPending();
      if (
        remaining > 0 &&
        typeof navigator !== "undefined" &&
        navigator.onLine &&
        !timerRef.current
      ) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          flush();
        }, RETRY_INTERVAL_MS);
      }
    }
  }, []);

  // Hydrate this user's queue once, then attempt an immediate flush (covers a
  // reload while online with a non-empty outbox).
  useEffect(() => {
    if (!uid) return undefined;
    initOutbox(uid)
      .then(() => {
        if (typeof navigator === "undefined" || navigator.onLine) flush();
      })
      .catch(() => {});
    return () => {
      resetOutbox();
    };
  }, [uid, flush]);

  // After a successful socket reconnect (or when the socket comes up).
  useEffect(() => {
    if (isConnected || reconnectNonce > 0) flush();
  }, [isConnected, reconnectNonce, flush]);

  // Browser online/offline events.
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onOnline = () => flush();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  // Slow retry while anything is still pending.
  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingCount) return undefined;
    timerRef.current = setTimeout(() => {
      flush();
    }, RETRY_INTERVAL_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pendingCount, flush]);

  return null;
}

export default OutboxFlusher;
