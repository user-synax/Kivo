"use client";

// Single Socket.IO connection for the logged-in user. The connection is created
// once on mount and torn down on unmount.
//
// IMPORTANT: the access token lives only in memory (see lib/auth.js) and is
// `null` after a page refresh until the app re-acquires it from the httpOnly
// refresh cookie. We therefore cannot assume getToken() is populated at mount —
// if it's missing we first do a silent refresh to obtain a token, then connect.
//
// socket.io-client is imported dynamically inside the effect so it never runs
// during SSR (it touches browser globals at construction time).
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { getToken, refreshAccessToken } from "@/lib/auth";

const SocketContext = createContext(null);

export function useSocket() {
  return useContext(SocketContext);
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    let active = true;
    let cancelled = false;
    let s = null;

    const socketUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

    const buildSocket = (token) => {
      if (!token || cancelled || !active) return;
      import("socket.io-client").then(({ io }) => {
        if (cancelled || !active) return;
        // Connect directly to the backend's Socket.IO endpoint. The frontend
        // (Next.js) and backend (Express) run on different origins/ports, so a
        // path-only client would hit the wrong origin and — because Next.js
        // rewrites do not proxy WebSocket upgrades — the connection would fail.
        s = io(socketUrl, {
          path: "/socket.io",
          auth: { token },
          transports: ["websocket", "polling"],
          withCredentials: true,
          reconnectionDelay: 800,
          reconnectionDelayMax: 4000,
        });
        socketRef.current = s;

        s.on("connect_error", async (err) => {
          // Likely an expired/refreshed token — try a silent refresh then retry.
          if (err?.message && /token/i.test(err.message)) {
            try {
              const fresh = await refreshAccessToken();
              if (!active) return;
              s.auth = { token: fresh };
              s.connect();
            } catch {
              // refresh failed: leave disconnected; api layer forces logout
            }
          }
        });

        s.on("connect", () => {
          if (active) setSocket(s);
        });
        s.on("disconnect", () => {
          if (active) setSocket(null);
        });
      });
    };

    // Acquire a token: prefer the in-memory one, otherwise restore it from the
    // refresh cookie (handles the post-refresh cold start).
    (async () => {
      let token = getToken();
      if (!token) {
        try {
          token = await refreshAccessToken();
        } catch {
          token = null;
        }
      }
      if (!active || cancelled) return;
      buildSocket(token);
    })();

    return () => {
      active = false;
      cancelled = true;
      if (s) s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export default SocketProvider;
