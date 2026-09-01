"use client";

import { useEffect, useState } from "react";

/**
 * Derives a single `isOffline` flag from two signals:
 *   1. navigator.onLine  (browser online/offline events)
 *   2. Socket.IO connected state (true when socket exists and is connected)
 *
 * The user is considered offline ONLY when both signals indicate disconnection.
 * This avoids flicker during brief socket reconnects when the browser still has
 * network connectivity.
 */
export function useOfflineStatus(socket) {
  // navigator.onLine starts as true; updated by browser events
  const [browserOnline, setBrowserOnline] = useState(true);
  // socket is non-null only when connected (see socket-provider.jsx)
  const socketConnected = Boolean(socket);

  useEffect(() => {
    const setTrue = () => setBrowserOnline(true);
    const setFalse = () => setBrowserOnline(false);
    window.addEventListener("online", setTrue);
    window.addEventListener("offline", setFalse);
    return () => {
      window.removeEventListener("online", setTrue);
      window.removeEventListener("offline", setFalse);
    };
  }, []);

  return !browserOnline && !socketConnected;
}
