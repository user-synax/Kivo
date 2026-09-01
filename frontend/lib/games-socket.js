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
  if (gamesSocket?.connected) return gamesSocket;
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
