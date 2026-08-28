"use client";

// Single Socket.IO connection for the logged-in user. The connection is created
// once on mount (under the AuthGate, so a token is guaranteed to exist) and torn
// down on unmount. If the server rejects the handshake because the access token
// expired, we silently refresh and reconnect once.
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
    let s = null;

    const token = getToken();
    if (!token) {
      setSocket(null);
      return undefined;
    }

    let cancelled = false;
    import("socket.io-client").then(({ io }) => {
      if (cancelled) return;
      s = io({
        path: "/socket.io",
        auth: { token: getToken() },
        transports: ["websocket", "polling"],
        withCredentials: true,
        reconnectionDelay: 800,
        reconnectionDelayMax: 4000,
      });
      socketRef.current = s;

      s.on("connect_error", async (err) => {
        // Likely an expired access token — try one silent refresh then retry.
        if (err?.message && /token/i.test(err.message)) {
          try {
            const fresh = await refreshAccessToken();
            s.auth = { token: fresh };
            s.connect();
          } catch {
            // refresh failed: leave disconnected; api layer will also force logout
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
