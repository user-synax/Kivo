"use client";

// Separate Socket.IO client for /games namespace — mirrors the main socket-provider
// token handling but isolates game traffic from chat presence/typing streams.
import { getToken, refreshAccessToken } from "./auth.js";

let gamesSocket = null;
let gamesSocketPromise = null;

export function getGamesSocket() {
  return gamesSocket;
}

export async function connectGamesSocket() {
  // Return existing socket even if reconnecting — the caller listens for
  // 'connect' to re-emit join events. Creating a new socket would orphan
  // the old one and leave existing event handlers stranded.
  if (gamesSocket) return gamesSocket;
  if (gamesSocketPromise) return gamesSocketPromise;

  const socketUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  gamesSocketPromise = (async () => {
    let token = getToken();
    if (!token) {
      try {
        token = await refreshAccessToken();
      } catch {
        token = null;
      }
    }
    if (!token) throw new Error("No auth token for /games");

    const { io } = await import("socket.io-client");
    const s = io(`${socketUrl}/games`, {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionDelay: 800,
      reconnectionDelayMax: 4000,
    });

    s.on("connect_error", async (err) => {
      if (err?.message && /token/i.test(err.message)) {
        try {
          const fresh = await refreshAccessToken();
          s.auth = { token: fresh };
          s.connect();
        } catch {}
      }
    });

    s.on("disconnect", () => {
      // Clear the singleton so a future connectGamesSocket() call can create
      // a fresh socket if reconnection has given up.
      if (!s.recovered && !s.active) {
        gamesSocket = null;
      }
    });

    gamesSocket = s;
    gamesSocketPromise = null;
    return s;
  })();

  return gamesSocketPromise;
}

export function disconnectGamesSocket() {
  if (gamesSocket) {
    gamesSocket.disconnect();
    gamesSocket = null;
  }
  gamesSocketPromise = null;
}
