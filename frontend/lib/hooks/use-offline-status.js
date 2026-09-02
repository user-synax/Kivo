"use client";

import { useEffect, useState } from "react";

/**
 * Derives a single `isOffline` flag from two signals:
 *   1. navigator.onLine  (browser online/offline events)
 *   2. Socket.IO connected state (isConnected from socket-provider)
 *
 * The user is considered offline ONLY when both signals indicate disconnection.
 * This avoids flicker during brief socket reconnects when the browser still has
 * network connectivity.
 *
 * Accepts either a boolean isConnected or a legacy socket object / {isConnected}
 * for backwards compatibility during migration.
 */
export function useOfflineStatus(isConnectedInput) {
  // Normalize input: supports boolean, socket instance, or {isConnected}
  const isConnected =
    typeof isConnectedInput === "boolean"
      ? isConnectedInput
      : typeof isConnectedInput === "object" && isConnectedInput !== null
        ? ("isConnected" in isConnectedInput
            ? Boolean(isConnectedInput.isConnected)
            : "connected" in isConnectedInput
              ? Boolean(isConnectedInput.connected)
              : Boolean(isConnectedInput))
        : false;

  // navigator.onLine starts as true; updated by browser events
  const [browserOnline, setBrowserOnline] = useState(true);

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

  return !browserOnline && !isConnected;
}
